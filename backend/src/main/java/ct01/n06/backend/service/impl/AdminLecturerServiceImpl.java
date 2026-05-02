package ct01.n06.backend.service.impl;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import ct01.n06.backend.dto.admin.AdminLecturerCreateRequest;
import ct01.n06.backend.dto.admin.AdminLecturerListResponse;
import ct01.n06.backend.dto.admin.AdminLecturerOptionsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerRowResponse;
import ct01.n06.backend.dto.admin.AdminLecturerStatsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerUpdateRequest;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.FacultyEntity;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.FacultyRepository;
import ct01.n06.backend.repository.LecturerRepository;
import ct01.n06.backend.repository.UserRepository;
import ct01.n06.backend.service.AdminLecturerService;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminLecturerServiceImpl implements AdminLecturerService {

  private static final DateTimeFormatter UI_DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

  private final LecturerRepository lecturerRepository;
  private final FacultyRepository facultyRepository;
  private final ClassRepository classRepository;
  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  @Override
  @Transactional(readOnly = true)
  public AdminLecturerOptionsResponse getOptions() {
    List<AdminLecturerOptionsResponse.FacultyOptionItem> faculties = facultyRepository.findAllByOrderByCodeAsc()
        .stream()
        .map(faculty -> new AdminLecturerOptionsResponse.FacultyOptionItem(
            faculty.getId(),
            faculty.getCode(),
            faculty.getName()))
        .toList();

    List<AdminLecturerOptionsResponse.ClassOptionItem> classes = classRepository.findAllByOrderByClassCodeAsc()
      .stream()
      .map(classEntity -> new AdminLecturerOptionsResponse.ClassOptionItem(
        classEntity.getId(),
        classEntity.getClassCode(),
        classEntity.getFacultyEntity() != null ? classEntity.getFacultyEntity().getId() : null,
        classEntity.getFacultyEntity() != null ? classEntity.getFacultyEntity().getCode() : null,
        classEntity.getFacultyEntity() != null ? classEntity.getFacultyEntity().getName() : null,
        classEntity.getLecturerEntity() != null ? classEntity.getLecturerEntity().getFullName() : null))
      .toList();

    return new AdminLecturerOptionsResponse(faculties, classes);
  }

  @Override
  @Transactional(readOnly = true)
  public AdminLecturerListResponse getLecturers(Long facultyId, String status, String keyword) {
    List<LecturerEntity> lecturers = loadLecturers();
    Map<String, List<ClassEntity>> classAssignmentsMap = buildClassAssignmentsMap();
    Map<String, Integer> classCountMap = buildClassCountMap(classAssignmentsMap);
    UserStatus statusFilter = AdminServiceUtils.parseStatus(status, false);
    String normalizedKeyword = AdminServiceUtils.normalizeKeyword(keyword);

    List<LecturerEntity> filtered = lecturers.stream()
        .filter(lecturer -> facultyId == null || (lecturer.getFacultyEntity() != null
            && Objects.equals(lecturer.getFacultyEntity().getId(), facultyId)))
        .filter(lecturer -> {
          UserStatus userStatus = AdminServiceUtils.normalizeStatus(
              lecturer.getUserEntity().getStatus());
          return statusFilter == null || userStatus == statusFilter;
        })
        .filter(lecturer -> matchesKeyword(lecturer, normalizedKeyword))
        .sorted(Comparator.comparing(LecturerEntity::getFullName, String.CASE_INSENSITIVE_ORDER))
        .toList();

    List<AdminLecturerRowResponse> rows = filtered.stream()
      .map(lecturer -> toRow(lecturer, classCountMap, classAssignmentsMap))
        .toList();

    return new AdminLecturerListResponse(
        rows.size(),
        (int) rows.stream().filter(row -> "ACTIVE".equals(row.status())).count(),
        (int) rows.stream().filter(row -> "LOCKED".equals(row.status())).count(),
        (int) rows.stream().filter(row -> "DELETED".equals(row.status())).count(),
        rows
    );
  }

  @Override
  @Transactional(readOnly = true)
  public AdminLecturerStatsResponse getStats() {
    List<LecturerEntity> lecturers = loadLecturers();
    Map<String, List<ClassEntity>> classAssignmentsMap = buildClassAssignmentsMap();
    Map<String, Integer> classCountMap = buildClassCountMap(classAssignmentsMap);
    Map<Long, FacultyAccumulator> facultyBreakdown = new LinkedHashMap<>();

    for (LecturerEntity lecturer : lecturers) {
      FacultyEntity faculty = lecturer.getFacultyEntity();
      if (faculty == null) {
        continue;
      }

      FacultyAccumulator accumulator = facultyBreakdown.computeIfAbsent(
          faculty.getId(),
          ignored -> new FacultyAccumulator(faculty.getId(), faculty.getCode(), faculty.getName())
      );
      accumulator.lecturerCount++;
      accumulator.classCount += classCountMap.getOrDefault(lecturer.getId(), 0);
    }

    List<AdminLecturerRowResponse> recentLecturers = lecturers.stream()
        .sorted(Comparator.comparing(
            (LecturerEntity lecturer) -> lecturer.getUserEntity().getCreatedAt(),
            Comparator.nullsLast(Comparator.naturalOrder()))
            .reversed())
        .limit(5)
          .map(lecturer -> toRow(lecturer, classCountMap, classAssignmentsMap))
        .toList();

    int assignedClasses = Math.toIntExact(classRepository.countByLecturerEntityIsNotNull());

    int unassignedLecturers = (int) lecturers.stream()
        .filter(lecturer -> classCountMap.getOrDefault(lecturer.getId(), 0) == 0)
        .count();

    List<AdminLecturerStatsResponse.FacultyBreakdownItem> facultyItems = facultyBreakdown.values().stream()
        .map(item -> new AdminLecturerStatsResponse.FacultyBreakdownItem(
            item.facultyId,
            item.facultyCode,
            item.facultyName,
            item.lecturerCount,
            item.classCount))
        .toList();

    return new AdminLecturerStatsResponse(
        lecturers.size(),
        (int) lecturers.stream().filter(lecturer -> AdminServiceUtils.normalizeStatus(
            lecturer.getUserEntity().getStatus()) == UserStatus.ACTIVE).count(),
        (int) lecturers.stream().filter(lecturer -> AdminServiceUtils.normalizeStatus(
            lecturer.getUserEntity().getStatus()) == UserStatus.LOCKED).count(),
        (int) lecturers.stream().filter(lecturer -> AdminServiceUtils.normalizeStatus(
            lecturer.getUserEntity().getStatus()) == UserStatus.DELETED).count(),
        Math.toIntExact(facultyRepository.count()),
        assignedClasses,
        unassignedLecturers,
        facultyItems,
        recentLecturers
    );
  }

  @Override
  @Transactional
  public AdminLecturerRowResponse createLecturer(AdminLecturerCreateRequest request) {
    if (request == null || !StringUtils.hasText(request.fullName()) || !StringUtils.hasText(request.lecturerCode())
        || !StringUtils.hasText(request.email()) || request.facultyId() == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu thông tin bắt buộc: họ tên, mã giảng viên, email, khoa.");
    }

    FacultyEntity faculty = facultyRepository.findById(request.facultyId())
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy khoa được chọn."));

    String fullName = request.fullName().trim();
    String lecturerCode = request.lecturerCode().trim().toUpperCase(Locale.ROOT);
    String email = request.email().trim().toLowerCase(Locale.ROOT);
    String username = resolveUsername(request.username(), email, lecturerCode);
    UserStatus status = AdminServiceUtils.parseStatus(request.status(), true);

    validateCreateUniqueness(email, username, lecturerCode);

    UserEntity user = UserEntity.builder()
        .username(username)
        .email(email)
        .password(passwordEncoder.encode(resolvePassword(request.password())))
        .role(Role.ROLE_LECTURER)
        .status(status)
        .build();

    try {
      UserEntity savedUser = userRepository.save(user);
      LecturerEntity savedLecturer = lecturerRepository.save(LecturerEntity.builder()
          .userEntity(savedUser)
          .lecturerCode(lecturerCode)
          .fullName(fullName)
          .facultyEntity(faculty)
          .build());

        syncLecturerClasses(savedLecturer, request.classIds());

        Map<String, List<ClassEntity>> classAssignmentsMap = buildClassAssignmentsMap();
        return toRow(savedLecturer, buildClassCountMap(classAssignmentsMap), classAssignmentsMap);
    } catch (DataIntegrityViolationException ex) {
      throw new ApiException(HttpStatus.CONFLICT, "Dữ liệu giảng viên bị trùng hoặc không hợp lệ.");
    }
  }

  @Override
  @Transactional
  public AdminLecturerRowResponse updateLecturer(String lecturerId, AdminLecturerUpdateRequest request) {
    if (!StringUtils.hasText(lecturerId)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu mã giảng viên cần cập nhật.");
    }
    if (request == null || !StringUtils.hasText(request.fullName()) || !StringUtils.hasText(request.lecturerCode())
        || !StringUtils.hasText(request.email()) || request.facultyId() == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu thông tin bắt buộc: họ tên, mã giảng viên, email, khoa.");
    }

    LecturerEntity lecturer = lecturerRepository.findById(lecturerId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy giảng viên."));
    UserEntity user = lecturer.getUserEntity();
    if (user == null || user.getRole() != Role.ROLE_LECTURER) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Tài khoản không phải giảng viên hợp lệ.");
    }

    FacultyEntity faculty = facultyRepository.findById(request.facultyId())
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy khoa được chọn."));

    String fullName = request.fullName().trim();
    String lecturerCode = request.lecturerCode().trim().toUpperCase(Locale.ROOT);
    String email = request.email().trim().toLowerCase(Locale.ROOT);
    String username = StringUtils.hasText(request.username())
        ? request.username().trim().toLowerCase(Locale.ROOT)
        : user.getUsername();
    UserStatus status = AdminServiceUtils.parseStatus(request.status(), true);

    validateUpdateUniqueness(lecturer, user, email, username, lecturerCode);

    lecturer.setFullName(fullName);
    lecturer.setLecturerCode(lecturerCode);
    lecturer.setFacultyEntity(faculty);

    user.setEmail(email);
    user.setUsername(username);
    user.setStatus(status);
    if (StringUtils.hasText(request.password())) {
      user.setPassword(passwordEncoder.encode(request.password().trim()));
    }

    try {
      userRepository.save(user);
      LecturerEntity savedLecturer = lecturerRepository.save(lecturer);
      syncLecturerClasses(savedLecturer, request.classIds());

      Map<String, List<ClassEntity>> classAssignmentsMap = buildClassAssignmentsMap();
      return toRow(savedLecturer, buildClassCountMap(classAssignmentsMap), classAssignmentsMap);
    } catch (DataIntegrityViolationException ex) {
      throw new ApiException(HttpStatus.CONFLICT, "Dữ liệu giảng viên bị trùng hoặc không hợp lệ.");
    }
  }

  @Override
  @Transactional
  public void deleteLecturer(String lecturerId) {
    if (!StringUtils.hasText(lecturerId)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu mã giảng viên cần xóa.");
    }

    LecturerEntity lecturer = lecturerRepository.findById(lecturerId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy giảng viên."));
    UserEntity user = lecturer.getUserEntity();
    if (user == null) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản giảng viên.");
    }

    user.setStatus(UserStatus.DELETED);
    userRepository.save(user);
  }


  @Override
  @Transactional(readOnly = true)
  public byte[] exportLecturersExcel() {
    List<AdminLecturerRowResponse> rows = getLecturers(null, null, null).lecturers();
    try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Lecturers");

      Row header = sheet.createRow(0);
      String[] headers = {"lecturerCode", "fullName", "email", "facultyCode", "status", "classCodes", "username"};
      for (int i = 0; i < headers.length; i++) {
        header.createCell(i).setCellValue(headers[i]);
      }

      int rowIndex = 1;
      for (AdminLecturerRowResponse row : rows) {
        Row excelRow = sheet.createRow(rowIndex++);
        excelRow.createCell(0).setCellValue(defaultValue(row.lecturerCode()));
        excelRow.createCell(1).setCellValue(defaultValue(row.fullName()));
        excelRow.createCell(2).setCellValue(defaultValue(row.email()));
        excelRow.createCell(3).setCellValue(defaultValue(row.facultyCode()));
        excelRow.createCell(4).setCellValue(defaultValue(row.status()));
        excelRow.createCell(5).setCellValue(String.join(", ", row.classCodes() == null ? List.of() : row.classCodes()));
        excelRow.createCell(6).setCellValue(defaultValue(row.username()));
      }

      for (int i = 0; i < headers.length; i++) {
        sheet.autoSizeColumn(i);
      }

      workbook.write(output);
      return output.toByteArray();
    } catch (Exception ex) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể xuất file Excel giảng viên.");
    }
  }

  private List<LecturerEntity> loadLecturers() {
    return lecturerRepository.findAllByUserEntity_Role(Role.ROLE_LECTURER);
  }

  private Map<String, List<ClassEntity>> buildClassAssignmentsMap() {
    Map<String, List<ClassEntity>> assignmentsMap = new LinkedHashMap<>();

    for (ClassEntity classEntity : classRepository.findAll()) {
      LecturerEntity lecturer = classEntity.getLecturerEntity();
      if (lecturer == null || lecturer.getUserEntity() == null || lecturer.getUserEntity().getRole() != Role.ROLE_LECTURER) {
        continue;
      }

      assignmentsMap.computeIfAbsent(lecturer.getId(), ignored -> new ArrayList<>()).add(classEntity);
    }

    assignmentsMap.values().forEach(classes -> classes.sort(Comparator.comparing(ClassEntity::getClassCode, String.CASE_INSENSITIVE_ORDER)));
    return assignmentsMap;
  }

  private Map<String, Integer> buildClassCountMap(Map<String, List<ClassEntity>> classAssignmentsMap) {
    Map<String, Integer> classCountMap = new LinkedHashMap<>();

    for (Map.Entry<String, List<ClassEntity>> entry : classAssignmentsMap.entrySet()) {
      classCountMap.put(entry.getKey(), entry.getValue().size());
    }

    return classCountMap;
  }

  private AdminLecturerRowResponse toRow(
      LecturerEntity lecturer,
      Map<String, Integer> classCountMap,
      Map<String, List<ClassEntity>> classAssignmentsMap
  ) {
    UserEntity user = lecturer.getUserEntity();
    String createdAt = user.getCreatedAt() != null ? user.getCreatedAt().format(UI_DATE_TIME) : "";
    List<ClassEntity> classAssignments = classAssignmentsMap.getOrDefault(lecturer.getId(), List.of());

    return new AdminLecturerRowResponse(
        lecturer.getId(),
        lecturer.getLecturerCode(),
        lecturer.getFullName(),
        user.getEmail(),
        user.getUsername(),
        AdminServiceUtils.normalizeStatus(user.getStatus()).name(),
        lecturer.getFacultyEntity() != null ? lecturer.getFacultyEntity().getId() : null,
        lecturer.getFacultyEntity() != null ? lecturer.getFacultyEntity().getCode() : null,
        lecturer.getFacultyEntity() != null ? lecturer.getFacultyEntity().getName() : null,
        classCountMap.getOrDefault(lecturer.getId(), 0),
        classAssignments.stream().map(ClassEntity::getId).toList(),
        classAssignments.stream().map(ClassEntity::getClassCode).toList(),
        createdAt
    );
  }

  private void syncLecturerClasses(LecturerEntity lecturer, List<Long> classIds) {
    if (classIds == null) {
      return;
    }

    List<ClassEntity> currentAssignments = classRepository.findByLecturerEntityId(lecturer.getId());
    Map<Long, ClassEntity> selectedAssignments = classRepository.findAllById(classIds).stream()
        .collect(LinkedHashMap::new, (map, classEntity) -> map.put(classEntity.getId(), classEntity), Map::putAll);

    if (selectedAssignments.size() != List.copyOf(classIds).stream().distinct().count()) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Có lớp được chọn không tồn tại.");
    }

    List<ClassEntity> toSave = new ArrayList<>();
    for (ClassEntity classEntity : currentAssignments) {
      if (!selectedAssignments.containsKey(classEntity.getId())) {
        classEntity.setLecturerEntity(null);
        toSave.add(classEntity);
      }
    }

    for (ClassEntity classEntity : selectedAssignments.values()) {
      if (!Objects.equals(classEntity.getLecturerEntity(), lecturer)) {
        classEntity.setLecturerEntity(lecturer);
        toSave.add(classEntity);
      }
    }

    if (!toSave.isEmpty()) {
      classRepository.saveAll(toSave);
    }
  }

  private boolean matchesKeyword(LecturerEntity lecturer, String keyword) {
    if (keyword == null) {
      return true;
    }

    UserEntity user = lecturer.getUserEntity();
    return AdminServiceUtils.contains(lecturer.getFullName(), keyword)
        || AdminServiceUtils.contains(lecturer.getLecturerCode(), keyword)
        || AdminServiceUtils.contains(user.getEmail(), keyword)
        || AdminServiceUtils.contains(user.getUsername(), keyword)
        || AdminServiceUtils.contains(
            lecturer.getFacultyEntity() != null ? lecturer.getFacultyEntity().getName() : null,
            keyword)
        || AdminServiceUtils.contains(
            lecturer.getFacultyEntity() != null ? lecturer.getFacultyEntity().getCode() : null,
            keyword);
  }

  private String resolvePassword(String password) {
    return StringUtils.hasText(password) ? password.trim() : "Lecturer@123";
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

  private FacultyEntity resolveFaculty(
      String facultyCode,
      String facultyName,
      Map<String, FacultyEntity> facultyByCode,
      Map<String, FacultyEntity> facultyByName
  ) {
    if (StringUtils.hasText(facultyCode)) {
      FacultyEntity byCode = facultyByCode.get(facultyCode.trim().toUpperCase(Locale.ROOT));
      if (byCode != null) {
        return byCode;
      }
    }
    if (StringUtils.hasText(facultyName)) {
      return facultyByName.get(facultyName.trim().toLowerCase(Locale.ROOT));
    }
    return null;
  }

  private List<Long> resolveClassIds(String classCodesRaw, Map<String, ClassEntity> classByCode) {
    if (!StringUtils.hasText(classCodesRaw)) {
      return List.of();
    }

    List<Long> classIds = new ArrayList<>();
    String[] tokens = classCodesRaw.split("[,;\\n]");
    for (String token : tokens) {
      if (!StringUtils.hasText(token)) {
        continue;
      }
      ClassEntity classEntity = classByCode.get(token.trim().toUpperCase(Locale.ROOT));
      if (classEntity == null) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Không tìm thấy lớp theo mã " + token.trim() + ".");
      }
      classIds.add(classEntity.getId());
    }
    return classIds.stream().distinct().toList();
  }


  private String defaultValue(String value) {
    return value == null ? "" : value;
  }

  private void validateCreateUniqueness(String email, String username, String lecturerCode) {
    if (userRepository.existsByEmailIgnoreCase(email)) {
      throw new ApiException(HttpStatus.CONFLICT, "Email đã tồn tại: " + email);
    }
    if (userRepository.existsByUsernameIgnoreCase(username)) {
      throw new ApiException(HttpStatus.CONFLICT, "Username đã tồn tại: " + username);
    }
    if (lecturerRepository.existsByLecturerCodeIgnoreCase(lecturerCode)) {
      throw new ApiException(HttpStatus.CONFLICT, "Mã giảng viên đã tồn tại: " + lecturerCode);
    }
  }

  private void validateUpdateUniqueness(
      LecturerEntity currentLecturer,
      UserEntity currentUser,
      String email,
      String username,
      String lecturerCode
  ) {
    userRepository.findByEmailIgnoreCase(email)
        .filter(other -> !Objects.equals(other.getId(), currentUser.getId()))
        .ifPresent(other -> {
          throw new ApiException(HttpStatus.CONFLICT, "Email đã tồn tại: " + email);
        });

    userRepository.findByUsernameIgnoreCase(username)
        .filter(other -> !Objects.equals(other.getId(), currentUser.getId()))
        .ifPresent(other -> {
          throw new ApiException(HttpStatus.CONFLICT, "Username đã tồn tại: " + username);
        });

    String currentLecturerCode = currentLecturer.getLecturerCode();
    boolean sameCode = currentLecturerCode != null && currentLecturerCode.equalsIgnoreCase(lecturerCode);
    if (!sameCode && lecturerRepository.existsByLecturerCodeIgnoreCase(lecturerCode)) {
      throw new ApiException(HttpStatus.CONFLICT, "Mã giảng viên đã tồn tại: " + lecturerCode);
    }
  }

  private static final class FacultyAccumulator {
    private final Long facultyId;
    private final String facultyCode;
    private final String facultyName;
    private int lecturerCount;
    private int classCount;

    private FacultyAccumulator(Long facultyId, String facultyCode, String facultyName) {
      this.facultyId = facultyId;
      this.facultyCode = facultyCode;
      this.facultyName = facultyName;
    }
  }
}
