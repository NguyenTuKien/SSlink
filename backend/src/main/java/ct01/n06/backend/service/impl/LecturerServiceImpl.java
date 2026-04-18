package ct01.n06.backend.service.impl;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import ct01.n06.backend.dto.common.SimpleMessageResponse;
import ct01.n06.backend.dto.lecturer.ImportStudentsResponse;
import ct01.n06.backend.dto.lecturer.LecturerDashboardSummaryResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentListResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentOptionsResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentOptionsResponse.ClassOptionItem;
import ct01.n06.backend.dto.lecturer.LecturerStudentOptionsResponse.FacultyOptionItem;
import ct01.n06.backend.dto.lecturer.LecturerStudentRowResponse;
import ct01.n06.backend.dto.lecturer.ManualCreateStudentRequest;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.EventEntity;
import ct01.n06.backend.entity.FacultyEntity;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.RecordEntity;
import ct01.n06.backend.entity.SemesterEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.StudentSemesterEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.RecordStatus;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.exception.business.ResourceNotFoundException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.EventRepository;
import ct01.n06.backend.repository.LecturerRepository;
import ct01.n06.backend.repository.RecordRepository;
import ct01.n06.backend.repository.SemesterRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.repository.StudentSemesterRepository;
import ct01.n06.backend.repository.UserRepository;
import ct01.n06.backend.service.LecturerService;
import ct01.n06.backend.service.UserService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@AllArgsConstructor
public class LecturerServiceImpl implements LecturerService {

  private static final DateTimeFormatter UI_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
  private static final DateTimeFormatter UI_TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

  private final LecturerRepository lecturerRepository;
  private final ClassRepository classRepository;
  private final StudentRepository studentRepository;
  private final UserRepository userRepository;
  private final SemesterRepository semesterRepository;
  private final StudentSemesterRepository studentSemesterRepository;
  private final EventRepository eventRepository;
  private final RecordRepository recordRepository;
  private final PasswordEncoder passwordEncoder;
  private final UserService userService;

  @Override
  @Transactional
  public String ensureLecturerAccessForCurrentUser(String requestedLecturerId) {
    UserEntity currentUser = userService.requireCurrentUser();
    String currentUserId = currentUser.getId();
    LecturerEntity lecturer = lecturerRepository.findByUserEntityId(currentUserId)
        .orElseGet(() -> provisionLecturerProfile(currentUser));

    boolean matchesLecturerId = Objects.equals(lecturer.getId(), requestedLecturerId);
    boolean matchesUserId = Objects.equals(currentUserId, requestedLecturerId);

    if (!matchesLecturerId && !matchesUserId) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập dữ liệu này.");
    }

    return lecturer.getId();
  }

  @Override
  @Transactional(readOnly = true)
  public LecturerStudentOptionsResponse getOptions(String lecturerId) {
    ensureLecturerExists(lecturerId);

    List<ClassEntity> lecturerClasses = classRepository.findByLecturerEntityId(lecturerId);
    Map<Long, FacultyOptionItem> facultyMap = new LinkedHashMap<>();
    List<ClassOptionItem> classItems = new ArrayList<>();

    for (ClassEntity classEntity : lecturerClasses) {
      FacultyEntity faculty = classEntity.getFacultyEntity();
      if (faculty != null && !facultyMap.containsKey(faculty.getId())) {
        facultyMap.put(faculty.getId(),
            new FacultyOptionItem(faculty.getId(), faculty.getCode(), faculty.getName()));
      }
      classItems.add(new ClassOptionItem(
          classEntity.getId(),
          classEntity.getClassCode(),
          faculty != null ? faculty.getId() : null,
          faculty != null ? faculty.getCode() : null
      ));
    }

    classItems.sort(Comparator.comparing(ClassOptionItem::classCode, String.CASE_INSENSITIVE_ORDER));
    return new LecturerStudentOptionsResponse(new ArrayList<>(facultyMap.values()), classItems);
  }

  @Override
  @Transactional(readOnly = true)
  public LecturerDashboardSummaryResponse getDashboardSummary() {
    String currentUserId = userService.requireCurrentUserId();
    String lecturerId = ensureLecturerAccessForCurrentUser(currentUserId);

    List<StudentEntity> students = studentRepository.findAllByLecturerIdWithDetails(lecturerId);
    List<String> studentIds = students.stream().map(StudentEntity::getId).toList();
    Optional<SemesterEntity> activeSemesterOpt = semesterRepository.findFirstByIsActiveTrueOrderByStartDateDesc();

    long totalEvents = eventRepository.countByCreatedBy_Id(currentUserId);
    long totalStudents = students.size();
    long participatingStudents = 0;
    long pendingEvidence = 0;

    if (activeSemesterOpt.isPresent() && !studentIds.isEmpty()) {
      Long semesterId = activeSemesterOpt.get().getId();
      List<RecordEntity> approvedRecords =
          recordRepository.findBySemester_IdAndStudent_IdInAndEventIsNotNullAndStatus(
              semesterId,
              studentIds,
              RecordStatus.APPROVED
          );
      participatingStudents = approvedRecords.stream()
          .map(record -> record.getStudent().getId())
          .distinct()
          .count();

      pendingEvidence = recordRepository.countBySemester_IdAndStudent_IdInAndEventIsNotNullAndStatus(
          semesterId,
          studentIds,
          RecordStatus.PENDING
      );
    }

    // Lecturer does not have an inbox notification flow, so this metric is always zero.
    long newNotifications = 0;
    DashboardScoreSnapshot scoreSnapshot = buildDashboardScoreSnapshot(students, activeSemesterOpt);
    List<LecturerDashboardSummaryResponse.UpcomingEventItem> upcomingEvents =
        buildUpcomingDashboardEvents(currentUserId);

    return new LecturerDashboardSummaryResponse(
        totalEvents,
      totalStudents,
        participatingStudents,
        pendingEvidence,
        newNotifications,
        scoreSnapshot.passRate(),
        scoreSnapshot.distribution(),
        upcomingEvents
    );
  }

  @Override
  @Transactional(readOnly = true)
  public LecturerStudentListResponse getStudents(
      String lecturerId,
      Long facultyId,
      Long classId,
      String status,
      String keyword
  ) {
    ensureLecturerExists(lecturerId);
    List<StudentEntity> students = studentRepository.findAllByLecturerIdWithDetails(lecturerId);

    UserStatus statusFilter = parseUserStatus(status, false);
    String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim().toLowerCase(Locale.ROOT)
        : null;

    List<StudentEntity> filtered = students.stream()
        .filter(student -> facultyId == null || (student.getClassEntity() != null
            && student.getClassEntity().getFacultyEntity() != null
            && Objects.equals(student.getClassEntity().getFacultyEntity().getId(), facultyId)))
        .filter(student -> classId == null || (student.getClassEntity() != null
            && Objects.equals(student.getClassEntity().getId(), classId)))
        .filter(student -> statusFilter == null || normalizeStatus(student.getUserEntity().getStatus())
            == statusFilter)
        .filter(student -> matchesKeyword(student, normalizedKeyword))
        .toList();

    Optional<SemesterEntity> activeSemesterOpt = semesterRepository.findFirstByIsActiveTrueOrderByStartDateDesc();
    Map<String, Integer> scoreByStudent = buildScoreMap(filtered, activeSemesterOpt);
    Map<String, Integer> joinedMandatoryMap = buildMandatoryAttendanceMap(filtered, activeSemesterOpt);
    int mandatoryEvents = activeSemesterOpt.map(semester -> (int) eventRepository.countBySemester_Id(
        semester.getId())).orElse(0);

    List<LecturerStudentRowResponse> rows = filtered.stream()
        .map(student -> toRow(student, scoreByStudent, joinedMandatoryMap, mandatoryEvents))
        .sorted(Comparator.comparing(LecturerStudentRowResponse::fullName, String.CASE_INSENSITIVE_ORDER))
        .toList();

    int activeCount = (int) rows.stream().filter(row -> "ACTIVE".equals(row.accountStatus())).count();
    int lockedCount = (int) rows.stream().filter(row -> "LOCKED".equals(row.accountStatus())).count();
    int monitorCount = (int) rows.stream().filter(row -> "MONITOR".equals(row.role())).count();

    return new LecturerStudentListResponse(rows.size(), activeCount, lockedCount, monitorCount, rows);
  }

  @Override
  @Transactional
  public LecturerStudentRowResponse createManualStudent(String lecturerId,
      ManualCreateStudentRequest request) {
    if (request == null || request.classId() == null || !StringUtils.hasText(request.fullName())
        || !StringUtils.hasText(request.email()) || !StringUtils.hasText(request.studentCode())) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "Thiếu thông tin bắt buộc: lớp, họ tên, email, mã sinh viên.");
    }

    validateManualCreateRequest(request);

    log.info("Manual student create requested: lecturerId={}, classId={}, studentCode={}, email={}",
        lecturerId, request.classId(), request.studentCode(), request.email());

    ClassEntity classEntity = classRepository.findByIdAndLecturerEntityId(request.classId(), lecturerId)
        .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN,
            "Bạn không có quyền thêm sinh viên vào lớp này."));

    StudentEntity student = createStudentRecord(
        classEntity,
        request.fullName(),
        request.email(),
        request.studentCode(),
        request.username(),
        request.password(),
        false
    );

    return toRow(student, Map.of(), Map.of(), 0);
  }

  @Override
  @Transactional
  public ImportStudentsResponse importStudents(String lecturerId, MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Vui lòng chọn file Excel để import.");
    }

    ensureLecturerExists(lecturerId);

    int importedCount = 0;
    int skippedCount = 0;
    List<String> errors = new ArrayList<>();

    Map<String, ClassEntity> classByCode = classRepository.findByLecturerEntityId(lecturerId).stream()
        .collect(Collectors.toMap(
            classEntity -> classEntity.getClassCode().toUpperCase(Locale.ROOT),
            classEntity -> classEntity
        ));

    if (classByCode.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Giảng viên chưa được phân lớp để import.");
    }

    DataFormatter formatter = new DataFormatter();
    try (InputStream inputStream = file.getInputStream();
        Workbook workbook = WorkbookFactory.create(inputStream)) {
      Sheet sheet = workbook.getSheetAt(0);
      for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
        Row row = sheet.getRow(rowIndex);
        if (row == null || isEmptyRow(row, formatter)) {
          continue;
        }

        String studentCode = getCellValue(row.getCell(0), formatter);
        String fullName = getCellValue(row.getCell(1), formatter);
        String email = getCellValue(row.getCell(2), formatter);
        String classCode = getCellValue(row.getCell(3), formatter);
        String username = getCellValue(row.getCell(4), formatter);
        String password = getCellValue(row.getCell(5), formatter);

        if (!StringUtils.hasText(studentCode) || !StringUtils.hasText(fullName)
            || !StringUtils.hasText(email) || !StringUtils.hasText(classCode)) {
          skippedCount++;
          errors.add("Dòng " + (rowIndex + 1)
              + ": Thiếu cột bắt buộc (studentCode, fullName, email, classCode).");
          continue;
        }

        ClassEntity classEntity = classByCode.get(classCode.trim().toUpperCase(Locale.ROOT));
        if (classEntity == null) {
          skippedCount++;
          errors.add("Dòng " + (rowIndex + 1) + ": Class code không thuộc giảng viên (" + classCode
              + ").");
          continue;
        }

        try {
          createStudentRecord(classEntity, fullName, email, studentCode, username, password, true);
          importedCount++;
        } catch (ApiException ex) {
          skippedCount++;
          errors.add("Dòng " + (rowIndex + 1) + ": " + ex.getMessage());
        }
      }
    } catch (Exception ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Không đọc được file Excel: " + ex.getMessage());
    }

    return new ImportStudentsResponse(importedCount, skippedCount, errors);
  }

  @Override
  @Transactional
  public LecturerStudentRowResponse assignMonitor(String lecturerId, String studentId) {
    StudentEntity student = studentRepository.findById(studentId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy sinh viên."));

    ClassEntity classEntity = assertStudentBelongsToLecturer(student, lecturerId);
    classEntity.setMonitor(student);
    classRepository.save(classEntity);

    return toRow(student, Map.of(), Map.of(), 0);
  }

  @Override
  @Transactional
  public LecturerStudentRowResponse updateStudentStatus(String lecturerId, String studentId, String status) {
    UserStatus nextStatus = parseUserStatus(status, true);

    StudentEntity student = studentRepository.findById(studentId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy sinh viên."));
    ClassEntity classEntity = assertStudentBelongsToLecturer(student, lecturerId);

    UserEntity user = student.getUserEntity();
    user.setStatus(nextStatus);
    userRepository.save(user);

    if (nextStatus == UserStatus.DELETED && classEntity.getMonitor() != null
        && Objects.equals(classEntity.getMonitor().getId(), student.getId())) {
      classEntity.setMonitor(null);
      classRepository.save(classEntity);
    }

    return toRow(student, Map.of(), Map.of(), 0);
  }

  @Override
  @Transactional
  public SimpleMessageResponse deleteStudent(String lecturerId, String studentId) {
    updateStudentStatus(lecturerId, studentId, UserStatus.DELETED.name());
    return new SimpleMessageResponse("Đã xóa mềm tài khoản sinh viên.");
  }

  private StudentEntity createStudentRecord(
      ClassEntity classEntity,
      String fullName,
      String email,
      String studentCode,
      String username,
      String password,
      boolean skipWhenDuplicate
  ) {
    String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
    String normalizedStudentCode = studentCode.trim().toUpperCase(Locale.ROOT);
    String normalizedUsername = normalizeUsername(username, normalizedEmail);

    if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
      throw duplicateException(skipWhenDuplicate, "Email đã tồn tại: " + normalizedEmail);
    }
    if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
      throw duplicateException(skipWhenDuplicate, "Username đã tồn tại: " + normalizedUsername);
    }
    if (studentRepository.findByStudentCodeIgnoreCase(normalizedStudentCode).isPresent()) {
      throw duplicateException(skipWhenDuplicate, "Mã sinh viên đã tồn tại: " + normalizedStudentCode);
    }

    String rawPassword = StringUtils.hasText(password) ? password.trim() : "UniPoint@123";
    UserEntity user = UserEntity.builder()
        .username(normalizedUsername)
        .email(normalizedEmail)
        .password(passwordEncoder.encode(rawPassword))
        .role(Role.ROLE_STUDENT)
        .status(UserStatus.ACTIVE)
        .build();
    try {
      UserEntity savedUser = userRepository.save(user);

      StudentEntity student = StudentEntity.builder()
          .userEntity(savedUser)
          .studentCode(normalizedStudentCode)
          .fullName(fullName.trim())
          .classEntity(classEntity)
          .build();
      StudentEntity savedStudent = studentRepository.save(student);
      log.info("Manual student created successfully: lecturerId={}, studentId={}, userId={}, studentCode={}, email={}",
          classEntity.getLecturerEntity() != null ? classEntity.getLecturerEntity().getId() : null,
          savedStudent.getId(),
          savedUser.getId(),
          savedStudent.getStudentCode(),
          savedUser.getEmail());
      return savedStudent;
    } catch (DataIntegrityViolationException ex) {
      log.warn("Manual student create failed due to data integrity violation: lecturerId={}, classId={}, studentCode={}, email={}, message={}",
          classEntity.getLecturerEntity() != null ? classEntity.getLecturerEntity().getId() : null,
          classEntity.getId(),
          normalizedStudentCode,
          normalizedEmail,
          ex.getMessage());
      throw duplicateException(skipWhenDuplicate,
          "Dữ liệu không hợp lệ hoặc đã tồn tại: email, username hoặc mã sinh viên.");
    }
  }

  private void validateManualCreateRequest(ManualCreateStudentRequest request) {
    String fullName = request.fullName().trim();
    String email = request.email().trim();
    String studentCode = request.studentCode().trim();

    if (fullName.length() > 100) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Họ tên không được vượt quá 100 ký tự.");
    }
    if (studentCode.length() > 20) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Mã sinh viên không được vượt quá 20 ký tự.");
    }
    if (email.length() > 100) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Email không được vượt quá 100 ký tự.");
    }

    int atIndex = email.indexOf('@');
    if (atIndex <= 0 || atIndex >= email.length() - 1) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Email không hợp lệ.");
    }

    if (StringUtils.hasText(request.username()) && request.username().trim().length() > 50) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Username không được vượt quá 50 ký tự.");
    }

    if (StringUtils.hasText(request.password()) && request.password().trim().length() > 255) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu không được vượt quá 255 ký tự.");
    }
  }

  private ApiException duplicateException(boolean skipWhenDuplicate, String message) {
    HttpStatus status = skipWhenDuplicate ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT;
    return new ApiException(status, message);
  }

  private String normalizeUsername(String username, String email) {
    String normalizedUsername;
    if (StringUtils.hasText(username)) {
      normalizedUsername = username.trim().toLowerCase(Locale.ROOT);
    } else {
      int atIndex = email.indexOf('@');
      if (atIndex <= 0) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Email không hợp lệ để sinh username.");
      }
      normalizedUsername = email.substring(0, atIndex).toLowerCase(Locale.ROOT);
    }

    if (normalizedUsername.length() > 50) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "Username vượt quá 50 ký tự. Vui lòng nhập username ngắn hơn.");
    }

    return normalizedUsername;
  }

  private ClassEntity assertStudentBelongsToLecturer(StudentEntity student, String lecturerId) {
    ClassEntity classEntity = student.getClassEntity();
    if (classEntity == null || classEntity.getLecturerEntity() == null || !Objects.equals(
        classEntity.getLecturerEntity().getId(), lecturerId)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền thao tác với sinh viên này.");
    }
    return classEntity;
  }

  private void ensureLecturerExists(String lecturerId) {
    if (lecturerId == null || lecturerRepository.findById(lecturerId).isEmpty()) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy giảng viên.");
    }
  }

  private LecturerEntity provisionLecturerProfile(UserEntity user) {
    if (user.getRole() != Role.ROLE_LECTURER && user.getRole() != Role.ROLE_ADMIN) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền giảng viên.");
    }

    String displayName = StringUtils.hasText(user.getUsername())
        ? user.getUsername()
        : ("Giảng viên " + user.getId());
    String lecturerCode = "LC" + user.getId();

    LecturerEntity lecturer = LecturerEntity.builder()
        .userEntity(user)
        .lecturerCode(lecturerCode)
        .fullName(displayName)
        .build();

    return lecturerRepository.save(lecturer);
  }

  private boolean matchesKeyword(StudentEntity student, String keyword) {
    if (!StringUtils.hasText(keyword)) {
      return true;
    }
    String fullName = StringUtils.hasText(student.getFullName()) ? student.getFullName()
        .toLowerCase(Locale.ROOT) : "";
    String studentCode = StringUtils.hasText(student.getStudentCode()) ? student.getStudentCode()
        .toLowerCase(Locale.ROOT) : "";
    String email = student.getUserEntity() != null && StringUtils.hasText(student.getUserEntity().getEmail())
        ? student.getUserEntity().getEmail().toLowerCase(Locale.ROOT) : "";
    return fullName.contains(keyword) || studentCode.contains(keyword) || email.contains(keyword);
  }

  private DashboardScoreSnapshot buildDashboardScoreSnapshot(
      List<StudentEntity> students,
      Optional<SemesterEntity> activeSemesterOpt
  ) {
    if (students.isEmpty()) {
      return new DashboardScoreSnapshot(
          0,
          List.of(
              new LecturerDashboardSummaryResponse.ScoreDistributionItem("excellent", "Xuất sắc", 0),
              new LecturerDashboardSummaryResponse.ScoreDistributionItem("good", "Tốt", 0),
              new LecturerDashboardSummaryResponse.ScoreDistributionItem("fair", "Khá", 0),
              new LecturerDashboardSummaryResponse.ScoreDistributionItem("average", "Trung bình", 0)
          )
      );
    }

    Map<String, Integer> scoreByStudent = buildScoreMap(students, activeSemesterOpt);
    long excellent = 0;
    long good = 0;
    long fair = 0;
    long average = 0;
    long passCount = 0;

    for (StudentEntity student : students) {
      int score = scoreByStudent.getOrDefault(student.getId(), 0);
      if (score >= 90) {
        excellent++;
      } else if (score >= 80) {
        good++;
      } else if (score >= 65) {
        fair++;
      } else {
        average++;
      }

      if (score >= 50) {
        passCount++;
      }
    }

    long total = students.size();
    return new DashboardScoreSnapshot(
        toPercent(passCount, total),
        List.of(
            new LecturerDashboardSummaryResponse.ScoreDistributionItem(
                "excellent",
                "Xuất sắc",
                toPercent(excellent, total)
            ),
            new LecturerDashboardSummaryResponse.ScoreDistributionItem(
                "good",
                "Tốt",
                toPercent(good, total)
            ),
            new LecturerDashboardSummaryResponse.ScoreDistributionItem(
                "fair",
                "Khá",
                toPercent(fair, total)
            ),
            new LecturerDashboardSummaryResponse.ScoreDistributionItem(
                "average",
                "Trung bình",
                toPercent(average, total)
            )
        )
    );
  }

  private List<LecturerDashboardSummaryResponse.UpcomingEventItem> buildUpcomingDashboardEvents(
      String currentUserId
  ) {
    LocalDateTime now = LocalDateTime.now();
    List<EventEntity> lecturerEvents = eventRepository
        .findTop5ByCreatedBy_IdAndStartTimeAfterOrderByStartTimeAsc(currentUserId, now);
    List<EventEntity> globalEvents = eventRepository.findTop5ByStartTimeAfterOrderByStartTimeAsc(now);
    Map<Long, EventEntity> upcomingEventById = new LinkedHashMap<>();

    for (EventEntity event : lecturerEvents) {
      if (upcomingEventById.size() >= 5) {
        break;
      }
      upcomingEventById.putIfAbsent(event.getId(), event);
    }

    for (EventEntity event : globalEvents) {
      if (upcomingEventById.size() >= 5) {
        break;
      }
      upcomingEventById.putIfAbsent(event.getId(), event);
    }

    List<EventEntity> upcomingEvents = new ArrayList<>(upcomingEventById.values());
    Map<Long, Long> attendeeCountByEventId = buildApprovedAttendeeCountMap(upcomingEvents);

    return upcomingEvents.stream()
        .map(event -> toUpcomingDashboardEventItem(
            event,
            attendeeCountByEventId.getOrDefault(event.getId(), 0L)
        ))
        .toList();
  }

  private Map<Long, Long> buildApprovedAttendeeCountMap(List<EventEntity> events) {
    if (events.isEmpty()) {
      return Map.of();
    }

    List<Long> eventIds = events.stream()
        .map(EventEntity::getId)
        .toList();

    return recordRepository.countDistinctStudentsByEventIdsAndStatus(eventIds, RecordStatus.APPROVED)
        .stream()
        .collect(Collectors.toMap(
            RecordRepository.EventAttendeeCountProjection::getEventId,
            RecordRepository.EventAttendeeCountProjection::getAttendeeCount
        ));
  }

  private LecturerDashboardSummaryResponse.UpcomingEventItem toUpcomingDashboardEventItem(
      EventEntity event,
      long attendeeCount
  ) {
    String dateLabel = event.getStartTime() != null ? event.getStartTime().format(UI_DATE_FORMAT) : "";
    String startTime = event.getStartTime() != null ? event.getStartTime().format(UI_TIME_FORMAT) : "--:--";
    String endTime = event.getEndTime() != null ? event.getEndTime().format(UI_TIME_FORMAT) : "--:--";
    String timeLabel = startTime + " - " + endTime;

    return new LecturerDashboardSummaryResponse.UpcomingEventItem(
        event.getId(),
        event.getTitle(),
        event.getLocation(),
        dateLabel,
        timeLabel,
        attendeeCount
    );
  }

  private double toPercent(long value, long total) {
    if (total <= 0) {
      return 0;
    }
    return Math.round((value * 1000.0) / total) / 10.0;
  }

  private Map<String, Integer> buildScoreMap(List<StudentEntity> students,
      Optional<SemesterEntity> activeSemesterOpt) {
    if (students.isEmpty() || activeSemesterOpt.isEmpty()) {
      return Map.of();
    }
    List<String> studentIds = students.stream().map(StudentEntity::getId).toList();
    return studentSemesterRepository.findBySemester_IdAndStudent_IdIn(activeSemesterOpt.get().getId(),
            studentIds)
        .stream()
        .filter(eval -> eval.getStudent() != null
            && eval.getStudent().getId() != null
            && eval.getFinalScore() != null)
        .collect(Collectors.toMap(
            eval -> eval.getStudent().getId(),
            StudentSemesterEntity::getFinalScore,
            (first, second) -> first
        ));
  }

  private record DashboardScoreSnapshot(
      double passRate,
      List<LecturerDashboardSummaryResponse.ScoreDistributionItem> distribution
  ) {
  }

  private Map<String, Integer> buildMandatoryAttendanceMap(List<StudentEntity> students,
      Optional<SemesterEntity> activeSemesterOpt) {
    if (students.isEmpty() || activeSemesterOpt.isEmpty()) {
      return Map.of();
    }
    List<String> studentIds = students.stream().map(StudentEntity::getId).toList();
    List<RecordEntity> records =
      recordRepository.findBySemester_IdAndStudent_IdInAndEventIsNotNullAndStatus(
            activeSemesterOpt.get().getId(),
            studentIds,
        RecordStatus.APPROVED
        );
    Map<String, Integer> joinedMap = new HashMap<>();
    for (RecordEntity record : records) {
      String studentId = record.getStudent().getId();
      joinedMap.put(studentId, joinedMap.getOrDefault(studentId, 0) + 1);
    }
    return joinedMap;
  }

  private LecturerStudentRowResponse toRow(
      StudentEntity student,
      Map<String, Integer> scoreByStudent,
      Map<String, Integer> joinedMandatoryMap,
      int mandatoryEvents
  ) {
    ClassEntity classEntity = student.getClassEntity();
    boolean isMonitor = classEntity != null && classEntity.getMonitor() != null
        && Objects.equals(classEntity.getMonitor().getId(), student.getId());

    Integer score = scoreByStudent.getOrDefault(student.getId(), 0);
    int joined = joinedMandatoryMap.getOrDefault(student.getId(), 0);
    String mandatoryStatus = mandatoryEvents > 0
        ? joined + "/" + mandatoryEvents + (joined >= mandatoryEvents ? " (Đạt)" : " (Thiếu)")
        : "Không có sự kiện bắt buộc";

    UserStatus status = normalizeStatus(student.getUserEntity().getStatus());
    FacultyEntity faculty = classEntity != null ? classEntity.getFacultyEntity() : null;

    return new LecturerStudentRowResponse(
        student.getId(),
        student.getFullName(),
        student.getUserEntity().getEmail(),
        student.getStudentCode(),
        classEntity != null ? classEntity.getId() : null,
        classEntity != null ? classEntity.getClassCode() : null,
        faculty != null ? faculty.getCode() : null,
        faculty != null ? faculty.getName() : null,
        isMonitor ? "MONITOR" : "STUDENT",
        status.name(),
        score,
        mandatoryStatus
    );
  }

  private UserStatus normalizeStatus(UserStatus status) {
    return status == null ? UserStatus.ACTIVE : status;
  }

  private UserStatus parseUserStatus(String status, boolean required) {
    if (!StringUtils.hasText(status)) {
      if (required) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Status là bắt buộc.");
      }
      return null;
    }
    try {
      return UserStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "Status không hợp lệ. Chỉ chấp nhận ACTIVE/LOCKED/DELETED.");
    }
  }

  private boolean isEmptyRow(Row row, DataFormatter formatter) {
    for (int i = 0; i <= 5; i++) {
      Cell cell = row.getCell(i);
      if (StringUtils.hasText(getCellValue(cell, formatter))) {
        return false;
      }
    }
    return true;
  }

    @Override
    public LecturerEntity getLecturerByUser(UserEntity userEntity) {
        return lecturerRepository.findByUserEntity(userEntity).orElseThrow();
    }

      @Override
      public LecturerEntity getLecturerByUsername(final String username) {
        return this.lecturerRepository.findByUserEntity_Username(username)
            .orElseThrow(() -> new ResourceNotFoundException("Lecturer profile for user: " + username));
      }

  private String getCellValue(Cell cell, DataFormatter formatter) {
    if (cell == null) {
      return "";
    }
    String value = formatter.formatCellValue(cell);
    return value == null ? "" : value.trim();
  }
}


