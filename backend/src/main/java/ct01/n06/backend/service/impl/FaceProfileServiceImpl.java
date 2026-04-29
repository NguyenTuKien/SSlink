package ct01.n06.backend.service.impl;

import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import ct01.n06.backend.config.FaceProperties;
import ct01.n06.backend.dto.face.FaceProfileResponse;
import ct01.n06.backend.dto.face.FaceProfileStatusResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestListResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestResponse;
import ct01.n06.backend.entity.FaceProfileEntity;
import ct01.n06.backend.entity.FaceUpdateRequestEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.enums.FaceProfileStatus;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.FaceProfileRepository;
import ct01.n06.backend.repository.FaceUpdateRequestRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.service.FaceProfileEnrollQueueService;
import ct01.n06.backend.service.FaceProfileService;
import ct01.n06.backend.service.FaceUpdateRequestQueueService;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class FaceProfileServiceImpl implements FaceProfileService {

  private static final DateTimeFormatter UI_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
  private static final int MAX_PAGE_SIZE = 100;

  private final StudentRepository studentRepository;
  private final FaceProfileRepository faceProfileRepository;
  private final FaceUpdateRequestRepository faceUpdateRequestRepository;
  private final FaceProperties faceProperties;
  private final FaceUpdateRequestQueueService faceUpdateRequestQueueService;
  private final FaceProfileEnrollQueueService faceProfileEnrollQueueService;

  public FaceProfileServiceImpl(StudentRepository studentRepository,
      FaceProfileRepository faceProfileRepository,
      FaceUpdateRequestRepository faceUpdateRequestRepository,
      FaceProperties faceProperties,
      FaceUpdateRequestQueueService faceUpdateRequestQueueService,
      FaceProfileEnrollQueueService faceProfileEnrollQueueService) {
    this.studentRepository = studentRepository;
    this.faceProfileRepository = faceProfileRepository;
    this.faceUpdateRequestRepository = faceUpdateRequestRepository;
    this.faceProperties = faceProperties;
    this.faceUpdateRequestQueueService = faceUpdateRequestQueueService;
    this.faceProfileEnrollQueueService = faceProfileEnrollQueueService;
  }

  @Override
  @Transactional(readOnly = true)
  public FaceProfileStatusResponse getStatus(String userId) {
    StudentEntity student = getStudentByUserId(userId);
    FaceProfileEntity profile = faceProfileRepository.findByStudent_Id(student.getId()).orElse(null);
    if (profile == null) {
      return new FaceProfileStatusResponse(FaceProfileStatus.NOT_ENROLLED.name(), null, false,
          "Bạn chưa có ảnh khuôn mặt. Vui lòng tải ảnh thật của mình để tiếp tục.",
          null);
    }

    boolean canRequestUpdate = profile.getStatus() == FaceProfileStatus.APPROVED
        && !faceUpdateRequestRepository.existsByStudent_IdAndStatus(student.getId(), FaceUpdateRequestStatus.PENDING);

    String warningMessage = null;
    if (profile.getStatus() == FaceProfileStatus.PENDING_APPROVAL) {
      warningMessage = "Ảnh khuôn mặt đang được xử lý ở chế độ nền. Bạn có thể tiếp tục dùng các chức năng khác.";
    } else if (profile.getStatus() == FaceProfileStatus.NOT_ENROLLED) {
      warningMessage = "Ảnh khuôn mặt chưa hợp lệ. Vui lòng tải lại ảnh rõ mặt và chỉ chứa một khuôn mặt.";
    } else if (profile.getStatus() == FaceProfileStatus.LOCKED) {
      warningMessage = "Hồ sơ khuôn mặt đang bị khóa. Vui lòng liên hệ quản trị viên.";
    }

    return new FaceProfileStatusResponse(
        profile.getStatus().name(),
        profile.getAvatarUrl(),
        canRequestUpdate,
        warningMessage,
        profile.getQualityScore());
  }

  @Override
  @Transactional
  public FaceProfileResponse enroll(String userId, MultipartFile image, boolean confirmRealImage) {
    StudentEntity student = getStudentByUserId(userId);
    if (!confirmRealImage) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Bạn phải xác nhận đây là ảnh thật của mình.");
    }

    ImagePayload payload = readImage(image);
    FaceProfileEntity profile = faceProfileRepository.findByStudent_Id(student.getId()).orElse(null);

    if (profile != null) {
      if (profile.getStatus() == FaceProfileStatus.APPROVED) {
        throw new ApiException(HttpStatus.CONFLICT, "Bạn đã có hồ sơ khuôn mặt đã duyệt.");
      }
      if (profile.getStatus() == FaceProfileStatus.PENDING_APPROVAL) {
        throw new ApiException(HttpStatus.CONFLICT, "Ảnh khuôn mặt đang được xử lý. Vui lòng chờ trong giây lát.");
      }
      if (profile.getStatus() == FaceProfileStatus.LOCKED) {
        throw new ApiException(HttpStatus.CONFLICT, "Hồ sơ khuôn mặt đang bị khóa, không thể đăng ký lại.");
      }
    } else {
      profile = FaceProfileEntity.builder().student(student).build();
    }

    profile.setAvatarUrl(payload.dataUrl());
    profile.setStatus(FaceProfileStatus.PENDING_APPROVAL);
    profile.setQualityScore(null);
    profile.setLivenessLevel(faceProperties.isRequireLiveness() ? "REQUIRED_NOT_IMPLEMENTED" : "NOT_REQUIRED");
    profile.setLastVerifiedAt(null);
    profile.setExternalFacePersistedId(null);
    profile.setUpdatedBy(student.getId());

    FaceProfileEntity saved = faceProfileRepository.save(profile);
    try {
      faceProfileEnrollQueueService.enqueue(saved.getId(), payload.bytes());
    } catch (RuntimeException ex) {
      log.error("Cannot enqueue background enrollment job for face profile: profileId={}", saved.getId(), ex);
    }

    return toProfileResponse(saved);
  }

  @Override
  @Transactional
  public FaceUpdateRequestResponse createUpdateRequest(String userId, MultipartFile image, String reason,
      boolean confirmRealImage) {
    StudentEntity student = getStudentByUserId(userId);
    FaceProfileEntity profile = faceProfileRepository.findByStudent_Id(student.getId())
        .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Bạn chưa có hồ sơ khuôn mặt để cập nhật."));
    if (profile.getStatus() != FaceProfileStatus.APPROVED) {
      throw new ApiException(HttpStatus.CONFLICT, "Chỉ có thể yêu cầu cập nhật khi ảnh hiện tại đã được duyệt.");
    }
    if (faceUpdateRequestRepository.existsByStudent_IdAndStatus(student.getId(), FaceUpdateRequestStatus.PENDING)) {
      throw new ApiException(HttpStatus.CONFLICT, "Bạn đang có yêu cầu cập nhật ảnh chờ duyệt.");
    }
    if (!confirmRealImage) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Bạn phải xác nhận đây là ảnh thật của mình.");
    }

    ImagePayload payload = readImage(image);
    FaceUpdateRequestEntity request = FaceUpdateRequestEntity.builder()
        .student(student)
        .oldAvatarUrl(profile.getAvatarUrl())
        .newAvatarUrl(payload.dataUrl())
        .newFaceReferenceId(null)
        .reason(normalize(reason))
        .status(FaceUpdateRequestStatus.PENDING)
        .build();
    FaceUpdateRequestEntity saved = faceUpdateRequestRepository.save(request);

    try {
      faceUpdateRequestQueueService.enqueue(saved.getId(), payload.bytes());
    } catch (RuntimeException ex) {
      // Keep request available for manual lecturer review even if queue is temporarily unavailable.
      log.error("Không thể enqueue xử lý nền cho yêu cầu cập nhật khuôn mặt: requestId={}", saved.getId(), ex);
    }

    return toRequestResponse(saved);
  }

  @Override
  @Transactional(readOnly = true)
  public FaceUpdateRequestListResponse getStudentUpdateRequests(String userId, FaceUpdateRequestStatus status,
      int page, int size) {
    StudentEntity student = getStudentByUserId(userId);
    PageRequest pageRequest = buildPageRequest(page, size);
    Page<FaceUpdateRequestEntity> requests = status == null
        ? faceUpdateRequestRepository.findByStudent_Id(student.getId(), pageRequest)
        : faceUpdateRequestRepository.findByStudent_IdAndStatus(student.getId(), status, pageRequest);
    return toListResponse(requests);
  }

  private ImagePayload readImage(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Vui lòng chọn ảnh khuôn mặt.");
    }
    if (file.getSize() > faceProperties.getMaxImageSizeBytes()) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "Ảnh vượt quá giới hạn " + (faceProperties.getMaxImageSizeBytes() / (1024 * 1024)) + "MB.");
    }
    String contentType = StringUtils.hasText(file.getContentType()) ? file.getContentType() : "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Tệp tải lên phải là ảnh.");
    }
    try {
      byte[] bytes = file.getBytes();
      String dataUrl = "data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(bytes);
      return new ImagePayload(bytes, dataUrl);
    } catch (IOException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Không đọc được tệp ảnh.");
    }
  }

  private StudentEntity getStudentByUserId(String userId) {
    return studentRepository.findByUserEntityId(userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thông tin sinh viên."));
  }

  private FaceUpdateRequestListResponse toListResponse(Page<FaceUpdateRequestEntity> page) {
    return new FaceUpdateRequestListResponse(page.getNumber(), page.getSize(), page.getTotalElements(),
        page.getTotalPages(), page.getContent().stream().map(this::toRequestResponse).toList());
  }

  private FaceProfileResponse toProfileResponse(FaceProfileEntity profile) {
    return new FaceProfileResponse(profile.getId(), profile.getStudent().getId(),
        profile.getStudent().getFullName(), profile.getAvatarUrl(), profile.getStatus().name(),
        profile.getQualityScore(), profile.getLivenessLevel(), format(profile.getUpdatedAt()));
  }

  private FaceUpdateRequestResponse toRequestResponse(FaceUpdateRequestEntity request) {
    StudentEntity student = request.getStudent();
    return new FaceUpdateRequestResponse(request.getId(), student != null ? student.getId() : null,
        student != null ? student.getFullName() : null,
        student != null && student.getClassEntity() != null ? student.getClassEntity().getId() : null,
        student != null && student.getClassEntity() != null ? student.getClassEntity().getClassCode() : null,
        request.getOldAvatarUrl(), request.getNewAvatarUrl(), request.getReason(),
        request.getStatus() != null ? request.getStatus().name() : null, request.getReviewNote(),
        request.getReviewedBy() != null ? request.getReviewedBy().getUsername() : null,
        format(request.getReviewedAt()), format(request.getCreatedAt()));
  }

  private PageRequest buildPageRequest(int page, int size) {
    return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
  }

  private String normalize(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private String format(java.time.LocalDateTime value) {
    return value != null ? value.format(UI_TIME_FORMAT) : null;
  }

  private record ImagePayload(byte[] bytes, String dataUrl) {
  }
}
