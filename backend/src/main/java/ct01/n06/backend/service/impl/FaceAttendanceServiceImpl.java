package ct01.n06.backend.service.impl;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import ct01.n06.backend.config.FaceProperties;
import ct01.n06.backend.dto.face.ConfirmFaceAttendanceRequest;
import ct01.n06.backend.dto.face.ConfirmFaceAttendanceResponse;
import ct01.n06.backend.dto.face.CreateFaceAttendanceSessionRequest;
import ct01.n06.backend.dto.face.FaceAttendanceSessionResponse;
import ct01.n06.backend.dto.face.FaceRecognizeBoxResponse;
import ct01.n06.backend.dto.face.FaceRecognizeMatchResponse;
import ct01.n06.backend.dto.face.FaceRecognizeResponse;
import ct01.n06.backend.entity.AttendenceEntity;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.EventEntity;
import ct01.n06.backend.entity.FaceAttendanceMatchLogEntity;
import ct01.n06.backend.entity.FaceAttendanceSessionEntity;
import ct01.n06.backend.entity.FaceProfileEntity;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.SemesterEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.enums.FaceAttendanceMatchResult;
import ct01.n06.backend.entity.enums.FaceAttendanceSessionStatus;
import ct01.n06.backend.entity.enums.FaceProfileStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.AttendenceRepository;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.EventRepository;
import ct01.n06.backend.repository.FaceAttendanceMatchLogRepository;
import ct01.n06.backend.repository.FaceAttendanceSessionRepository;
import ct01.n06.backend.repository.FaceProfileRepository;
import ct01.n06.backend.repository.LecturerRepository;
import ct01.n06.backend.repository.SemesterRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.service.FaceAttendanceService;
import ct01.n06.backend.service.FaceIntegrationService;

@Service
public class FaceAttendanceServiceImpl implements FaceAttendanceService {

  private static final DateTimeFormatter UI_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

  private final LecturerRepository lecturerRepository;
  private final ClassRepository classRepository;
  private final EventRepository eventRepository;
  private final SemesterRepository semesterRepository;
  private final StudentRepository studentRepository;
  private final AttendenceRepository attendenceRepository;
  private final FaceProfileRepository faceProfileRepository;
  private final FaceAttendanceSessionRepository faceAttendanceSessionRepository;
  private final FaceAttendanceMatchLogRepository faceAttendanceMatchLogRepository;
  private final FaceIntegrationService faceIntegrationService;
  private final FaceProperties faceProperties;
  private final ConcurrentMap<Long, CachedProfileFace> profileFaceCache = new ConcurrentHashMap<>();
  private final ConcurrentMap<Long, CachedSessionCandidateRegistry> sessionCandidateRegistryCache = new ConcurrentHashMap<>();

  public FaceAttendanceServiceImpl(
      LecturerRepository lecturerRepository,
      ClassRepository classRepository,
      EventRepository eventRepository,
      SemesterRepository semesterRepository,
      StudentRepository studentRepository,
      AttendenceRepository attendenceRepository,
      FaceProfileRepository faceProfileRepository,
      FaceAttendanceSessionRepository faceAttendanceSessionRepository,
      FaceAttendanceMatchLogRepository faceAttendanceMatchLogRepository,
      FaceIntegrationService faceIntegrationService,
      FaceProperties faceProperties) {
    this.lecturerRepository = lecturerRepository;
    this.classRepository = classRepository;
    this.eventRepository = eventRepository;
    this.semesterRepository = semesterRepository;
    this.studentRepository = studentRepository;
    this.attendenceRepository = attendenceRepository;
    this.faceProfileRepository = faceProfileRepository;
    this.faceAttendanceSessionRepository = faceAttendanceSessionRepository;
    this.faceAttendanceMatchLogRepository = faceAttendanceMatchLogRepository;
    this.faceIntegrationService = faceIntegrationService;
    this.faceProperties = faceProperties;
  }

  @Override
  @Transactional
  public FaceAttendanceSessionResponse createSession(String lecturerUserId, CreateFaceAttendanceSessionRequest request) {
    LecturerEntity lecturer = lecturerRepository.findById(lecturerUserId)
      .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thông tin giảng viên."));
    ClassEntity classEntity = classRepository.findByIdAndLecturerEntityId(request.classId(), lecturerUserId)
      .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập lớp này."));
    EventEntity event = eventRepository.findById(request.eventId())
      .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Sự kiện không tồn tại."));
    SemesterEntity semester = semesterRepository.findById(request.semesterId())
      .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Học kỳ không tồn tại."));

    FaceAttendanceSessionEntity session = FaceAttendanceSessionEntity.builder()
        .lecturer(lecturer)
        .classEntity(classEntity)
        .event(event)
        .semester(semester)
        .status(FaceAttendanceSessionStatus.OPEN)
        .startedAt(LocalDateTime.now())
        .build();
    return toSessionResponse(faceAttendanceSessionRepository.save(session));
  }

  @Override
  @Transactional
  public FaceRecognizeResponse recognize(String lecturerUserId, Long sessionId, MultipartFile frame) {
    FaceAttendanceSessionEntity session = getOpenSession(lecturerUserId, sessionId);
    byte[] frameBytes = readImage(frame);
    List<FaceIntegrationService.DetectedFace> detectedFaces = faceIntegrationService.detectFaces(frameBytes);
    if (detectedFaces.isEmpty()) {
      logResult(session, null, 0.0, FaceAttendanceMatchResult.NOT_FOUND);
      return new FaceRecognizeResponse(List.of(), List.of(), 0, "Không phát hiện khuôn mặt trong khung hình.");
    }

    List<FaceIntegrationService.DetectedFace> probeFaces = selectProbeFaces(detectedFaces);
    List<FaceProfileEntity> profiles = faceProfileRepository.findByStudent_ClassEntity_IdAndStatus(
        session.getClassEntity().getId(), FaceProfileStatus.APPROVED);
    if (profiles.isEmpty()) {
      return new FaceRecognizeResponse(
          List.of(),
          toDefaultFaceBoxes(probeFaces, FaceAttendanceMatchResult.NOT_FOUND),
          detectedFaces.size(),
          "Lớp này chưa có sinh viên được duyệt khuôn mặt.");
    }

    List<BestMatch> bestMatches = matchFrameFacesWithRetry(session, probeFaces, profiles);
    if (bestMatches.isEmpty()) {
      return new FaceRecognizeResponse(
          List.of(),
          toDefaultFaceBoxes(probeFaces, FaceAttendanceMatchResult.NOT_FOUND),
          detectedFaces.size(),
          "Chưa tìm được kết quả so khớp phù hợp.");
    }

    List<FaceRecognizeMatchResponse> matches = new ArrayList<>();
    List<FaceRecognizeBoxResponse> faceBoxes = new ArrayList<>();
    for (int index = 0; index < probeFaces.size(); index++) {
      FaceIntegrationService.DetectedFace probeFace = probeFaces.get(index);
      BestMatch best = index < bestMatches.size() ? bestMatches.get(index) : BestMatch.empty();
      boolean poorQuality = isPoorProbeQuality(best.probeQualityScore());
      double requiredThreshold = computeRequiredThreshold(best.probeQualityScore());
      boolean lowConfidence = best.confidence() < requiredThreshold;
      boolean ambiguous = isAmbiguousMatch(best.confidence(), best.runnerUpConfidence());
      FaceAttendanceMatchResult boxResult = FaceAttendanceMatchResult.LOW_CONFIDENCE;
      StudentEntity matchedStudent = null;
      boolean duplicate = false;

      if (best.profile() == null || poorQuality || lowConfidence || ambiguous) {
        if (best.profile() == null) {
          boxResult = FaceAttendanceMatchResult.NOT_FOUND;
        }
        logResult(
            session,
            best.profile() != null ? best.profile().getStudent() : null,
            best.confidence(),
            FaceAttendanceMatchResult.LOW_CONFIDENCE);
      } else {
        matchedStudent = best.profile().getStudent();
        duplicate = faceAttendanceMatchLogRepository.existsBySession_IdAndStudent_IdAndResult(
            session.getId(),
            matchedStudent.getId(),
            FaceAttendanceMatchResult.MATCHED);
        boxResult = duplicate ? FaceAttendanceMatchResult.DUPLICATE : FaceAttendanceMatchResult.MATCHED;
        logResult(session, matchedStudent, best.confidence(), boxResult);

        matches.add(new FaceRecognizeMatchResponse(
            matchedStudent.getId(),
            matchedStudent.getStudentCode(),
            matchedStudent.getFullName(),
            best.confidence(),
            duplicate,
            boxResult.name()));
      }

      faceBoxes.add(toFaceBoxResponse(
          probeFace,
          best.confidence(),
          boxResult,
          matchedStudent,
          duplicate));
    }

    int processedFaces = probeFaces.size();
    int skippedByLimit = Math.max(0, detectedFaces.size() - processedFaces);
    String message = "Nhận diện thành công "
        + matches.size()
        + " sinh viên / "
        + processedFaces
        + " khuôn mặt đã xử lý.";
    if (skippedByLimit > 0) {
      message = message + " Bỏ qua " + skippedByLimit + " khuôn mặt do giới hạn xử lý mỗi frame.";
    }

    return new FaceRecognizeResponse(
        matches,
        faceBoxes,
        detectedFaces.size(),
        message);
  }

  @Override
  @Transactional
  public ConfirmFaceAttendanceResponse confirm(
      String lecturerUserId,
      Long sessionId,
      ConfirmFaceAttendanceRequest request) {
    FaceAttendanceSessionEntity session = getOpenSession(lecturerUserId, sessionId);
    Set<String> selectedIds = request.selectedStudentIds().stream()
        .filter(StringUtils::hasText)
        .map(String::trim)
        .collect(Collectors.toCollection(LinkedHashSet::new));
    if (selectedIds.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Danh sách sinh viên xác nhận điểm danh đang rỗng.");
    }

    List<FaceAttendanceMatchLogEntity> matchedLogs =
        faceAttendanceMatchLogRepository.findBySession_IdAndStudent_IdInAndResultIn(
            sessionId,
            selectedIds,
            EnumSet.of(FaceAttendanceMatchResult.MATCHED, FaceAttendanceMatchResult.DUPLICATE));
    Set<String> matchedStudentIds = matchedLogs.stream()
        .filter(log -> log.getStudent() != null && StringUtils.hasText(log.getStudent().getId()))
        .map(log -> log.getStudent().getId())
        .collect(Collectors.toSet());

    int confirmed = 0;
    int skipped = 0;
    for (String studentId : selectedIds) {
      if (!matchedStudentIds.contains(studentId)) {
        skipped++;
        continue;
      }
        StudentEntity student = studentRepository.findById(studentId)
          .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Sinh viên không tồn tại: " + studentId));
      if (student.getClassEntity() == null || !session.getClassEntity().getId().equals(student.getClassEntity().getId())) {
        skipped++;
        continue;
      }
      if (attendenceRepository.existsByEventIdAndStudentId(session.getEvent().getId(), studentId)) {
        confirmed++;
        continue;
      }
      attendenceRepository.save(AttendenceEntity.builder()
          .event(session.getEvent())
          .student(student)
          .build());
      confirmed++;
    }

    return new ConfirmFaceAttendanceResponse(
      confirmed,
      skipped,
      "Đã xác nhận điểm danh "
        + confirmed
        + " sinh viên.");
  }

  @Override
  @Transactional
  public FaceAttendanceSessionResponse close(String lecturerUserId, Long sessionId) {
    FaceAttendanceSessionEntity session = faceAttendanceSessionRepository.findByIdAndLecturer_Id(sessionId, lecturerUserId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy phiên điểm danh."));
    if (session.getStatus() != FaceAttendanceSessionStatus.OPEN) {
      throw new ApiException(HttpStatus.CONFLICT, "Phiên điểm danh đã đóng.");
    }

    int attendedCount = autoConfirmMatchedStudents(session);

    session.setStatus(FaceAttendanceSessionStatus.CLOSED);
    session.setEndedAt(LocalDateTime.now());
    FaceAttendanceSessionEntity saved = faceAttendanceSessionRepository.save(session);
    sessionCandidateRegistryCache.remove(sessionId);
    return toSessionResponse(
        saved,
        attendedCount,
        "Đã đóng phiên điểm danh. Có " + attendedCount + " sinh viên đã điểm danh.");
  }
  private int autoConfirmMatchedStudents(FaceAttendanceSessionEntity session) {
    List<FaceAttendanceMatchLogEntity> matchedLogs = faceAttendanceMatchLogRepository.findBySession_IdAndResultIn(
        session.getId(),
        EnumSet.of(FaceAttendanceMatchResult.MATCHED, FaceAttendanceMatchResult.DUPLICATE));
    if (matchedLogs.isEmpty()) {
      return 0;
    }

    Map<String, StudentEntity> matchedStudentsById = matchedLogs.stream()
        .map(FaceAttendanceMatchLogEntity::getStudent)
        .filter(student -> student != null && StringUtils.hasText(student.getId()))
        .collect(Collectors.toMap(StudentEntity::getId, Function.identity(), (left, right) -> left));

    int confirmed = 0;
    for (StudentEntity student : matchedStudentsById.values()) {
      if (student.getClassEntity() == null
          || !session.getClassEntity().getId().equals(student.getClassEntity().getId())) {
        continue;
      }
      if (attendenceRepository.existsByEventIdAndStudentId(session.getEvent().getId(), student.getId())) {
        confirmed++;
        continue;
      }
      attendenceRepository.save(AttendenceEntity.builder()
          .event(session.getEvent())
          .student(student)
          .build());
      confirmed++;
    }

    return confirmed;
  }
  private List<BestMatch> matchFrameFacesWithRetry(
      FaceAttendanceSessionEntity session,
      List<FaceIntegrationService.DetectedFace> frameFaces,
      List<FaceProfileEntity> profiles) {
    try {
      return matchFrameFaces(session, frameFaces, profiles, false);
    } catch (ApiException ex) {
      if (!isExpiredFaceIdError(ex)) {
        throw ex;
      }
      invalidateCachedProfiles(profiles);
      sessionCandidateRegistryCache.remove(session.getId());
      return matchFrameFaces(session, frameFaces, profiles, true);
    }
  }

  private List<BestMatch> matchFrameFaces(
      FaceAttendanceSessionEntity session,
      List<FaceIntegrationService.DetectedFace> frameFaces,
      List<FaceProfileEntity> profiles,
      boolean forceRefreshCache) {
    CandidateRegistry registry = resolveCandidateRegistry(session, profiles, forceRefreshCache);
    if (registry.candidateFaceIds().isEmpty()) {
      return List.of();
    }

    List<FaceIntegrationService.MatchResult> results = faceIntegrationService.match(
        frameFaces.stream().map(FaceIntegrationService.DetectedFace::faceId).toList(),
        registry.candidateFaceIds(),
        2);

    Map<String, FaceIntegrationService.MatchResult> resultByProbeId = results.stream()
        .collect(Collectors.toMap(
            FaceIntegrationService.MatchResult::probeFaceId,
            result -> result,
            (left, right) -> left));

    List<BestMatch> bestMatches = new ArrayList<>();
    for (FaceIntegrationService.DetectedFace frameFace : frameFaces) {
      FaceIntegrationService.MatchResult matchResult = resultByProbeId.get(frameFace.faceId());
      if (matchResult == null || matchResult.candidates() == null || matchResult.candidates().isEmpty()) {
        bestMatches.add(BestMatch.empty());
        continue;
      }
      FaceIntegrationService.MatchCandidate topCandidate = matchResult.candidates().get(0);
      FaceProfileEntity profile = registry.profileByFaceId().get(topCandidate.faceId());
      double confidence = topCandidate.confidence() != null ? topCandidate.confidence() : 0.0;
      double runnerUpConfidence = 0.0;
      if (matchResult.candidates().size() > 1) {
        FaceIntegrationService.MatchCandidate runnerUp = matchResult.candidates().get(1);
        runnerUpConfidence = runnerUp.confidence() != null ? runnerUp.confidence() : 0.0;
      }
      bestMatches.add(new BestMatch(
          profile,
          confidence,
          runnerUpConfidence,
          frameFace.qualityScore(),
          frameFace.qualityLabel()));
    }
    return bestMatches;
  }

  private CandidateRegistry resolveCandidateRegistry(
      FaceAttendanceSessionEntity session,
      List<FaceProfileEntity> profiles,
      boolean forceRefreshCache) {
    if (session == null || session.getId() == null) {
      return buildCandidateRegistry(profiles, forceRefreshCache);
    }
    long now = System.currentTimeMillis();
    if (!forceRefreshCache) {
      CachedSessionCandidateRegistry cached = sessionCandidateRegistryCache.get(session.getId());
      if (cached != null && cached.expiresAtEpochMs() > now) {
        return cached.registry();
      }
    }
    CandidateRegistry registry = buildCandidateRegistry(profiles, forceRefreshCache);
    long ttlMs = Math.max(15, faceProperties.getSessionCandidateCacheTtlSeconds()) * 1000L;
    sessionCandidateRegistryCache.put(session.getId(), new CachedSessionCandidateRegistry(registry, now + ttlMs));
    return registry;
  }

  private CandidateRegistry buildCandidateRegistry(List<FaceProfileEntity> profiles, boolean forceRefreshCache) {
    Map<String, FaceProfileEntity> profileByFaceId = new HashMap<>();
    List<String> candidateFaceIds = new ArrayList<>();
    for (FaceProfileEntity profile : profiles) {
      String faceId = resolveProfileFaceId(profile, forceRefreshCache);
      if (!StringUtils.hasText(faceId)) {
        continue;
      }
      profileByFaceId.put(faceId, profile);
      candidateFaceIds.add(faceId);
    }
    return new CandidateRegistry(profileByFaceId, candidateFaceIds);
  }

  private String resolveProfileFaceId(FaceProfileEntity profile, boolean forceRefreshCache) {
    if (profile == null || profile.getId() == null || !StringUtils.hasText(profile.getAvatarUrl())) {
      return null;
    }

    CachedProfileFace cached = profileFaceCache.get(profile.getId());
    String avatarFingerprint = buildAvatarFingerprint(profile);
    long now = System.currentTimeMillis();
    if (!forceRefreshCache
        && cached != null
        && cached.expiresAtEpochMs() > now
        && avatarFingerprint.equals(cached.avatarFingerprint())) {
      return cached.faceId();
    }

    byte[] avatarBytes = decodeDataUrl(profile.getAvatarUrl());
    List<FaceIntegrationService.DetectedFace> profileFaces = faceIntegrationService.detectFaces(avatarBytes);
    if (profileFaces.size() != 1 || !StringUtils.hasText(profileFaces.get(0).faceId())) {
      profileFaceCache.remove(profile.getId());
      return null;
    }

    String faceId = profileFaces.get(0).faceId();
    long ttlMs = Math.max(30, faceProperties.getProfileCacheTtlSeconds()) * 1000L;
    profileFaceCache.put(profile.getId(), new CachedProfileFace(faceId, avatarFingerprint, now + ttlMs));
    return faceId;
  }

  private void invalidateCachedProfiles(List<FaceProfileEntity> profiles) {
    for (FaceProfileEntity profile : profiles) {
      if (profile != null && profile.getId() != null) {
        profileFaceCache.remove(profile.getId());
      }
    }
  }

  private String buildAvatarFingerprint(FaceProfileEntity profile) {
    String updatedAt = profile.getUpdatedAt() != null ? profile.getUpdatedAt().toString() : "null";
    return updatedAt + ":" + profile.getAvatarUrl().hashCode();
  }

  private boolean isExpiredFaceIdError(ApiException ex) {
    return ex != null
        && ex.getMessage() != null
        && ex.getMessage().toLowerCase().contains("face_id not found or expired");
  }

  private List<FaceIntegrationService.DetectedFace> selectProbeFaces(List<FaceIntegrationService.DetectedFace> detectedFaces) {
    if (detectedFaces == null || detectedFaces.isEmpty()) {
      return List.of();
    }
    int limit = Math.max(1, faceProperties.getMaxProbeFacesPerFrame());
    if (detectedFaces.size() <= limit) {
      return detectedFaces;
    }
    return detectedFaces.stream()
        .sorted(Comparator.comparing(
            (FaceIntegrationService.DetectedFace face) -> face.qualityScore() != null ? face.qualityScore() : 0.0)
            .reversed())
        .limit(limit)
        .toList();
  }

  private boolean isPoorProbeQuality(Double score) {
    if (score == null) {
      return false;
    }
    return score < clamp01(faceProperties.getMinProbeQualityScore());
  }

  private double computeRequiredThreshold(Double qualityScore) {
    double threshold = clamp01(faceProperties.getMatchThreshold());
    if (qualityScore != null && qualityScore < clamp01(faceProperties.getQualityStrictThreshold())) {
      threshold = clamp01(threshold + Math.max(0.0, faceProperties.getLowQualityThresholdBoost()));
    }
    return threshold;
  }

  private boolean isAmbiguousMatch(double topConfidence, double runnerUpConfidence) {
    if (topConfidence <= 0.0 || runnerUpConfidence <= 0.0) {
      return false;
    }
    double gap = topConfidence - runnerUpConfidence;
    return gap < clamp01(faceProperties.getMinConfidenceGap());
  }

  private double clamp01(double value) {
    return Math.max(0.0, Math.min(1.0, value));
  }

  private FaceAttendanceSessionEntity getOpenSession(String lecturerUserId, Long sessionId) {
    FaceAttendanceSessionEntity session = faceAttendanceSessionRepository.findByIdAndLecturer_Id(sessionId, lecturerUserId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy phiên điểm danh."));
    if (session.getStatus() != FaceAttendanceSessionStatus.OPEN) {
      throw new ApiException(HttpStatus.CONFLICT, "Phiên điểm danh đã đóng.");
    }
    return session;
  }

  private byte[] readImage(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Vui lòng gửi khung hình.");
    }
    if (file.getSize() > faceProperties.getMaxImageSizeBytes()) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "Ảnh vượt quá giới hạn kích thước: " + (faceProperties.getMaxImageSizeBytes() / (1024 * 1024)) + "MB.");
    }
    try {
      return file.getBytes();
    } catch (IOException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Không đọc được khung hình.");
    }
  }

  private byte[] decodeDataUrl(String dataUrl) {
    if (!StringUtils.hasText(dataUrl)) {
      return new byte[0];
    }
    int commaIndex = dataUrl.indexOf(',');
    String payload = commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl;
    return Base64.getDecoder().decode(payload);
  }

  private void logResult(
      FaceAttendanceSessionEntity session,
      StudentEntity student,
      Double confidence,
      FaceAttendanceMatchResult result) {
    faceAttendanceMatchLogRepository.save(FaceAttendanceMatchLogEntity.builder()
        .session(session)
        .student(student)
        .confidence(confidence)
        .result(result)
        .snapshotUrl(null)
        .build());
  }

  private List<FaceRecognizeBoxResponse> toDefaultFaceBoxes(
      List<FaceIntegrationService.DetectedFace> probeFaces,
      FaceAttendanceMatchResult result) {
    if (probeFaces == null || probeFaces.isEmpty()) {
      return List.of();
    }
    return probeFaces.stream()
        .map(face -> toFaceBoxResponse(face, null, result, null, false))
        .toList();
  }

  private FaceRecognizeBoxResponse toFaceBoxResponse(
      FaceIntegrationService.DetectedFace probeFace,
      Double confidence,
      FaceAttendanceMatchResult result,
      StudentEntity student,
      boolean duplicate) {
    FaceIntegrationService.FaceBox faceBox = probeFace != null ? probeFace.faceBox() : null;
    return new FaceRecognizeBoxResponse(
        probeFace != null ? probeFace.faceId() : null,
        faceBox != null ? faceBox.x() : null,
        faceBox != null ? faceBox.y() : null,
        faceBox != null ? faceBox.width() : null,
        faceBox != null ? faceBox.height() : null,
        faceBox != null ? faceBox.xRatio() : null,
        faceBox != null ? faceBox.yRatio() : null,
        faceBox != null ? faceBox.widthRatio() : null,
        faceBox != null ? faceBox.heightRatio() : null,
        probeFace != null ? probeFace.qualityScore() : null,
        probeFace != null ? probeFace.qualityLabel() : null,
        confidence,
        result != null ? result.name() : null,
        student != null ? student.getId() : null,
        student != null ? student.getStudentCode() : null,
        student != null ? student.getFullName() : null,
        duplicate);
  }

  private FaceAttendanceSessionResponse toSessionResponse(FaceAttendanceSessionEntity session) {
    return toSessionResponse(session, null, null);
  }

  private FaceAttendanceSessionResponse toSessionResponse(
      FaceAttendanceSessionEntity session,
      Integer attendedCount,
      String message) {
    return new FaceAttendanceSessionResponse(
        session.getId(),
        session.getClassEntity() != null ? session.getClassEntity().getId() : null,
        session.getClassEntity() != null ? session.getClassEntity().getClassCode() : null,
        session.getEvent() != null ? session.getEvent().getId() : null,
        session.getEvent() != null ? session.getEvent().getTitle() : null,
        session.getSemester() != null ? session.getSemester().getId() : null,
        session.getStatus() != null ? session.getStatus().name() : null,
        format(session.getStartedAt()),
        format(session.getEndedAt()),
        attendedCount,
        message);
  }

  private String format(LocalDateTime value) {
    return value != null ? value.format(UI_TIME_FORMAT) : null;
  }

  private record BestMatch(
      FaceProfileEntity profile,
      double confidence,
      double runnerUpConfidence,
      Double probeQualityScore,
      String probeQualityLabel) {
    static BestMatch empty() {
      return new BestMatch(null, 0.0, 0.0, null, null);
    }
  }

  private record CachedProfileFace(String faceId, String avatarFingerprint, long expiresAtEpochMs) {
  }

  private record CachedSessionCandidateRegistry(CandidateRegistry registry, long expiresAtEpochMs) {
  }

  private record CandidateRegistry(Map<String, FaceProfileEntity> profileByFaceId, List<String> candidateFaceIds) {
  }
}
