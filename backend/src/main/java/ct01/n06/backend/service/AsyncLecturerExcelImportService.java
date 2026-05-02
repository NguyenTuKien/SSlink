package ct01.n06.backend.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.event.AnalysisEventListener;
import ct01.n06.backend.dto.admin.JobStatus;
import ct01.n06.backend.entity.FacultyEntity;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.repository.FacultyRepository;
import ct01.n06.backend.repository.LecturerRepository;
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
public class AsyncLecturerExcelImportService {

    private final RedisImportTrackerService trackerService;
    private final FacultyRepository facultyRepository;
    private final LecturerRepository lecturerRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static final int BATCH_SIZE = 500;

    @Async
    public void processImport(File tempFile, String batchId, String username) {
        JobStatus jobStatus = trackerService.getJob(batchId);
        if (jobStatus == null) {
            log.error("Job status not found for batchId: {}", batchId);
            return;
        }

        jobStatus.setStatus("PROCESSING");
        trackerService.updateJob(jobStatus);

        try {
            Map<String, FacultyEntity> facultyMap = facultyRepository.findAll().stream()
                    .collect(Collectors.toMap(f -> f.getCode().toLowerCase(Locale.ROOT), f -> f, (f1, f2) -> f1));
            
            Set<String> existingLecturerCodes = lecturerRepository.findAllLecturerCodesLower();
            Set<String> existingEmails = userRepository.findAllEmailsLower();
            Set<String> existingUsernames = userRepository.findAllUsernamesLower();

            EasyExcel.read(tempFile, new LecturerImportListener(
                    jobStatus, trackerService, facultyMap, existingLecturerCodes, existingEmails, existingUsernames,
                    userRepository, lecturerRepository, passwordEncoder
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

    private static class LecturerImportListener extends AnalysisEventListener<Map<Integer, String>> {
        private final JobStatus jobStatus;
        private final RedisImportTrackerService trackerService;
        private final Map<String, FacultyEntity> facultyMap;
        private final Set<String> existingLecturerCodes;
        private final Set<String> existingEmails;
        private final Set<String> existingUsernames;
        private final UserRepository userRepository;
        private final LecturerRepository lecturerRepository;
        private final PasswordEncoder passwordEncoder;
        private final String defaultPasswordHash;

        private final List<LecturerEntity> lecturerBatch = new ArrayList<>();
        private final List<UserEntity> userBatch = new ArrayList<>();

        private Map<String, Integer> headerMap = new HashMap<>();
        private boolean headersParsed = false;
        private int rowIndex = 0;

        public LecturerImportListener(JobStatus jobStatus, RedisImportTrackerService trackerService,
                                      Map<String, FacultyEntity> facultyMap,
                                      Set<String> existingLecturerCodes, Set<String> existingEmails, Set<String> existingUsernames,
                                      UserRepository userRepository, LecturerRepository lecturerRepository, PasswordEncoder passwordEncoder) {
            this.jobStatus = jobStatus;
            this.trackerService = trackerService;
            this.facultyMap = facultyMap;
            this.existingLecturerCodes = existingLecturerCodes;
            this.existingEmails = existingEmails;
            this.existingUsernames = existingUsernames;
            this.userRepository = userRepository;
            this.lecturerRepository = lecturerRepository;
            this.passwordEncoder = passwordEncoder;
            this.defaultPasswordHash = passwordEncoder.encode("Lecturer@123");
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

            Integer facultyCol = getCol(Arrays.asList("mã khoa", "khoa", "facultycode", "faculty"));
            Integer nameCol = getCol(Arrays.asList("họ tên", "họ và tên", "fullname"));
            Integer codeCol = getCol(Arrays.asList("mã giảng viên", "mã gv", "lecturercode"));
            Integer emailCol = getCol(Arrays.asList("email"));
            Integer userCol = getCol(Arrays.asList("tên đăng nhập", "username"));

            String facultyCodeStr = facultyCol != null ? sanitize(data.get(facultyCol)) : "";
            String fullName = nameCol != null ? sanitize(data.get(nameCol)) : "";
            String lecturerCode = codeCol != null ? sanitize(data.get(codeCol)) : "";
            String email = emailCol != null ? sanitize(data.get(emailCol)) : "";
            String usernameRaw = userCol != null ? sanitize(data.get(userCol)) : "";

            if (!StringUtils.hasText(fullName) && !StringUtils.hasText(lecturerCode)) {
                return; // Skip empty row
            }

            if (!StringUtils.hasText(fullName) || !StringUtils.hasText(lecturerCode) || !StringUtils.hasText(email)) {
                addError(rowIndex, "Thiếu thông tin bắt buộc (họ tên, mã giảng viên, email).");
                return;
            }

            FacultyEntity facultyEntity = null;
            if (StringUtils.hasText(facultyCodeStr)) {
                facultyEntity = facultyMap.get(facultyCodeStr.toLowerCase(Locale.ROOT));
                if (facultyEntity == null) {
                    addError(rowIndex, "Không tìm thấy khoa với mã: " + facultyCodeStr);
                    return;
                }
            }

            String lecCodeLower = lecturerCode.toLowerCase(Locale.ROOT);
            if (existingLecturerCodes.contains(lecCodeLower)) {
                addError(rowIndex, "Mã giảng viên đã tồn tại: " + lecturerCode);
                return;
            }

            String emailLower = email.toLowerCase(Locale.ROOT);
            if (existingEmails.contains(emailLower)) {
                addError(rowIndex, "Email đã tồn tại: " + email);
                return;
            }

            String username = resolveUsername(usernameRaw, email, lecturerCode);
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
                    .role(Role.ROLE_LECTURER)
                    .status(UserStatus.ACTIVE)
                    .build();

            LecturerEntity lecturer = LecturerEntity.builder()
                    .lecturerCode(lecturerCode)
                    .fullName(fullName)
                    .facultyEntity(facultyEntity)
                    .userEntity(user)
                    .build();

            userBatch.add(user);
            lecturerBatch.add(lecturer);

            existingLecturerCodes.add(lecCodeLower);
            existingEmails.add(emailLower);
            existingUsernames.add(usernameLower);

            if (lecturerBatch.size() >= BATCH_SIZE) {
                saveBatch();
            }
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
            if (!lecturerBatch.isEmpty()) {
                saveBatch();
            }
        }

        private void saveBatch() {
            try {
                saveInTransaction();
                jobStatus.setImportedCount(jobStatus.getImportedCount() + lecturerBatch.size());
            } catch (Exception e) {
                log.error("Error saving batch", e);
                jobStatus.setSkippedCount(jobStatus.getSkippedCount() + lecturerBatch.size());
                jobStatus.getErrors().add("Lỗi khi lưu batch: " + e.getMessage());
            }
            lecturerBatch.clear();
            userBatch.clear();
            trackerService.updateJob(jobStatus);
        }

        @Transactional
        protected void saveInTransaction() {
            List<UserEntity> savedUsers = userRepository.saveAll(userBatch);
            for (int i = 0; i < lecturerBatch.size(); i++) {
                lecturerBatch.get(i).setUserEntity(savedUsers.get(i));
            }
            lecturerRepository.saveAll(lecturerBatch);
        }

        private void addError(int row, String msg) {
            jobStatus.setSkippedCount(jobStatus.getSkippedCount() + 1);
            jobStatus.getErrors().add("Dòng " + row + ": " + msg);
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

        private String resolveUsername(String username, String email, String lecturerCode) {
            if (StringUtils.hasText(username)) {
                return username.trim().toLowerCase(Locale.ROOT);
            }
            String base = email.contains("@") ? email.substring(0, email.indexOf("@")) : lecturerCode.toLowerCase(Locale.ROOT);
            String sanitized = base.replaceAll("[^a-zA-Z0-9._-]", "").toLowerCase(Locale.ROOT);
            if (!StringUtils.hasText(sanitized)) {
                sanitized = lecturerCode.toLowerCase(Locale.ROOT);
            }
            return sanitized.length() > 50 ? sanitized.substring(0, 50) : sanitized;
        }
    }
}
