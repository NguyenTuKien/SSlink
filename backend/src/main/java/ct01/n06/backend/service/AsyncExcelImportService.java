package ct01.n06.backend.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.event.AnalysisEventListener;
import ct01.n06.backend.dto.admin.JobStatus;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;
import org.springframework.util.StringUtils;

import java.io.File;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AsyncExcelImportService {

    private final RedisImportTrackerService trackerService;
    private final ClassRepository classRepository;
    private final StudentRepository studentRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static final int BATCH_SIZE = 500;

    @Async
    public void processImport(File tempFile, String batchId, String username, String lecturerId) {
        JobStatus jobStatus = trackerService.getJob(batchId);
        if (jobStatus == null) {
            log.error("Job status not found for batchId: {}", batchId);
            return;
        }

        jobStatus.setStatus("PROCESSING");
        trackerService.updateJob(jobStatus);

        try {
            Map<String, ClassEntity> classMap = classRepository.findAll().stream()
                    .filter(c -> {
                        if (!StringUtils.hasText(lecturerId)) return true; // Admin imports everything
                        return c.getLecturerEntity() != null && Objects.equals(c.getLecturerEntity().getId(), lecturerId);
                    })
                    .collect(Collectors.toMap(c -> c.getClassCode().toLowerCase(Locale.ROOT), c -> c, (c1, c2) -> c1));
            
            Set<String> existingStudentCodes = studentRepository.findAllStudentCodesLower();
            Set<String> existingEmails = userRepository.findAllEmailsLower();
            Set<String> existingUsernames = userRepository.findAllUsernamesLower();

            EasyExcel.read(tempFile, new StudentImportListener(
                    jobStatus, trackerService, classMap, existingStudentCodes, existingEmails, existingUsernames,
                    userRepository, studentRepository, passwordEncoder
            )).sheet().doRead();

            if (jobStatus.getSkippedCount() > 0) {
                jobStatus.setStatus("PARTIAL_SUCCESS");
            } else {
                jobStatus.setStatus("COMPLETED");
            }
            trackerService.updateJob(jobStatus);
        } catch (Exception e) {
            log.error("Error processing excel file for batchId: {}", batchId, e);
            jobStatus.setStatus("FAILED");
            jobStatus.getErrors().add("System error during processing: " + e.getMessage());
            trackerService.updateJob(jobStatus);
        } finally {
            if (tempFile != null && tempFile.exists()) {
                boolean deleted = tempFile.delete();
                if (!deleted) {
                    log.warn("Failed to delete temporary file: {}", tempFile.getAbsolutePath());
                }
            }
        }
    }

    private static class StudentImportListener extends AnalysisEventListener<Map<Integer, String>> {
        private final JobStatus jobStatus;
        private final RedisImportTrackerService trackerService;
        private final Map<String, ClassEntity> classMap;
        private final Set<String> existingStudentCodes;
        private final Set<String> existingEmails;
        private final Set<String> existingUsernames;
        private final UserRepository userRepository;
        private final StudentRepository studentRepository;
        private final PasswordEncoder passwordEncoder;
        private final String defaultPasswordHash;

        private final List<StudentEntity> studentBatch = new ArrayList<>();
        private final List<UserEntity> userBatch = new ArrayList<>();

        private Map<String, Integer> headerMap = new HashMap<>();
        private boolean headersParsed = false;
        private int rowIndex = 0;

        public StudentImportListener(JobStatus jobStatus, RedisImportTrackerService trackerService,
                                     Map<String, ClassEntity> classMap,
                                     Set<String> existingStudentCodes, Set<String> existingEmails, Set<String> existingUsernames,
                                     UserRepository userRepository, StudentRepository studentRepository, PasswordEncoder passwordEncoder) {
            this.jobStatus = jobStatus;
            this.trackerService = trackerService;
            this.classMap = classMap;
            this.existingStudentCodes = existingStudentCodes;
            this.existingEmails = existingEmails;
            this.existingUsernames = existingUsernames;
            this.userRepository = userRepository;
            this.studentRepository = studentRepository;
            this.passwordEncoder = passwordEncoder;
            this.defaultPasswordHash = passwordEncoder.encode("Student@123");
        }

        @Override
        public void invokeHeadMap(Map<Integer, String> headMap, AnalysisContext context) {
            for (Map.Entry<Integer, String> entry : headMap.entrySet()) {
                if (entry.getValue() != null) {
                    headerMap.put(entry.getValue().trim().toLowerCase(Locale.ROOT), entry.getKey());
                }
            }
            headersParsed = true;
        }

        @Override
        public void invoke(Map<Integer, String> data, AnalysisContext context) {
            rowIndex++;
            if (!headersParsed) {
                invokeHeadMap(data, context);
                return;
            }

            Integer classCol = getCol(Arrays.asList("mã lớp", "lớp", "classcode"));
            Integer nameCol = getCol(Arrays.asList("họ tên", "họ và tên", "fullname"));
            Integer codeCol = getCol(Arrays.asList("mã sinh viên", "mã sv", "studentcode"));
            Integer emailCol = getCol(Arrays.asList("email"));
            Integer userCol = getCol(Arrays.asList("tên đăng nhập", "username"));

            String classCodeStr = classCol != null ? sanitize(data.get(classCol)) : "";
            String fullName = nameCol != null ? sanitize(data.get(nameCol)) : "";
            String studentCode = codeCol != null ? sanitize(data.get(codeCol)) : "";
            String email = emailCol != null ? sanitize(data.get(emailCol)) : "";
            String usernameRaw = userCol != null ? sanitize(data.get(userCol)) : "";

            if (!StringUtils.hasText(fullName) && !StringUtils.hasText(studentCode)) {
                return; // Skip empty row
            }

            if (!StringUtils.hasText(fullName) || !StringUtils.hasText(studentCode) || !StringUtils.hasText(email)) {
                addError(rowIndex, "Thiếu thông tin bắt buộc (họ tên, mã sinh viên, email).");
                return;
            }

            ClassEntity classEntity = classMap.get(classCodeStr.toLowerCase(Locale.ROOT));
            if (classEntity == null) {
                addError(rowIndex, "Không tìm thấy lớp với mã: " + classCodeStr);
                return;
            }

            String stdCodeLower = studentCode.toLowerCase(Locale.ROOT);
            if (existingStudentCodes.contains(stdCodeLower)) {
                addError(rowIndex, "Mã sinh viên đã tồn tại: " + studentCode);
                return;
            }

            String emailLower = email.toLowerCase(Locale.ROOT);
            if (existingEmails.contains(emailLower)) {
                addError(rowIndex, "Email đã tồn tại: " + email);
                return;
            }

            String username = resolveUsername(usernameRaw, email, studentCode);
            String usernameLower = username.toLowerCase(Locale.ROOT);
            if (existingUsernames.contains(usernameLower)) {
                addError(rowIndex, "Username đã tồn tại: " + username);
                return;
            }

            // Valid row
            UserEntity user = UserEntity.builder()
                    .username(username)
                    .email(email)
                    .password(defaultPasswordHash)
                    .role(Role.ROLE_STUDENT)
                    .status(UserStatus.ACTIVE)
                    .build();

            StudentEntity student = StudentEntity.builder()
                    .studentCode(studentCode)
                    .fullName(fullName)
                    .classEntity(classEntity)
                    .userEntity(user)
                    .build();

            userBatch.add(user);
            studentBatch.add(student);

            existingStudentCodes.add(stdCodeLower);
            existingEmails.add(emailLower);
            existingUsernames.add(usernameLower);

            if (studentBatch.size() >= BATCH_SIZE) {
                saveBatch();
            }
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
            if (!studentBatch.isEmpty()) {
                saveBatch();
            }
        }

        private void saveBatch() {
            try {
                saveInTransaction();
                jobStatus.setImportedCount(jobStatus.getImportedCount() + studentBatch.size());
            } catch (Exception e) {
                log.error("Error saving batch", e);
                jobStatus.setSkippedCount(jobStatus.getSkippedCount() + studentBatch.size());
                jobStatus.getErrors().add("Lỗi khi lưu batch: " + e.getMessage());
            }
            studentBatch.clear();
            userBatch.clear();
            trackerService.updateJob(jobStatus);
        }

        @Transactional
        protected void saveInTransaction() {
            List<UserEntity> savedUsers = userRepository.saveAll(userBatch);
            // JPA usually updates the userEntity instances with IDs.
            for (int i = 0; i < studentBatch.size(); i++) {
                studentBatch.get(i).setUserEntity(savedUsers.get(i));
            }
            studentRepository.saveAll(studentBatch);
        }

        private void addError(int row, String msg) {
            jobStatus.setSkippedCount(jobStatus.getSkippedCount() + 1);
            jobStatus.getErrors().add("Dòng " + row + ": " + msg);
            // Optionally update tracker less frequently if errors are huge
        }

        private Integer getCol(List<String> possibleNames) {
            for (String name : possibleNames) {
                Integer col = headerMap.get(name.toLowerCase(Locale.ROOT));
                if (col != null) return col;
            }
            return null;
        }

        private String sanitize(String value) {
            if (value == null) return "";
            return value.trim();
        }

        private String resolveUsername(String username, String email, String studentCode) {
            if (StringUtils.hasText(username)) {
                return username.trim().toLowerCase(Locale.ROOT);
            }
            String base = email.contains("@") ? email.substring(0, email.indexOf("@")) : studentCode.toLowerCase(Locale.ROOT);
            String sanitized = base.replaceAll("[^a-zA-Z0-9._-]", "").toLowerCase(Locale.ROOT);
            if (!StringUtils.hasText(sanitized)) {
                sanitized = studentCode.toLowerCase(Locale.ROOT);
            }
            return sanitized.length() > 50 ? sanitized.substring(0, 50) : sanitized;
        }
    }
}
