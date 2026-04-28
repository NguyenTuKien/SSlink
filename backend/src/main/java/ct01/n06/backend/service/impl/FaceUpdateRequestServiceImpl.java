package ct01.n06.backend.service.impl;

import ct01.n06.backend.dto.face.FaceUpdateRequestListResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestResponse;
import ct01.n06.backend.dto.face.ReviewFaceUpdateRequest;
import ct01.n06.backend.entity.FaceProfileEntity;
import ct01.n06.backend.entity.FaceUpdateRequestEntity;
import ct01.n06.backend.entity.NotificationEntity;
import ct01.n06.backend.entity.NotificationRecipientEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.FaceProfileStatus;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
import ct01.n06.backend.entity.enums.NotificationType;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.FaceProfileRepository;
import ct01.n06.backend.repository.FaceUpdateRequestRepository;
import ct01.n06.backend.repository.NotificationRecipientRepository;
import ct01.n06.backend.repository.NotificationRepository;
import ct01.n06.backend.service.FaceUpdateRequestService;
import ct01.n06.backend.service.UserService;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class FaceUpdateRequestServiceImpl implements FaceUpdateRequestService {

  private static final DateTimeFormatter UI_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
  private static final int MAX_PAGE_SIZE = 100;

  private final FaceUpdateRequestRepository faceUpdateRequestRepository;
  private final FaceProfileRepository faceProfileRepository;
  private final NotificationRepository notificationRepository;
  private final NotificationRecipientRepository notificationRecipientRepository;
  private final UserService userService;

  public FaceUpdateRequestServiceImpl(FaceUpdateRequestRepository faceUpdateRequestRepository,
      FaceProfileRepository faceProfileRepository,
      NotificationRepository notificationRepository,
      NotificationRecipientRepository notificationRecipientRepository,
      UserService userService) {
    this.faceUpdateRequestRepository = faceUpdateRequestRepository;
    this.faceProfileRepository = faceProfileRepository;
    this.notificationRepository = notificationRepository;
    this.notificationRecipientRepository = notificationRecipientRepository;
    this.userService = userService;
  }

  @Override
  @Transactional(readOnly = true)
  public FaceUpdateRequestListResponse getLecturerRequests(String lecturerUserId, FaceUpdateRequestStatus status,
      Long classId, int page, int size) {
    PageRequest pageRequest = buildPageRequest(page, size);
    Page<FaceUpdateRequestEntity> requests;
    if (classId != null && status != null) {
      requests = faceUpdateRequestRepository
          .findByStudent_ClassEntity_LecturerEntity_IdAndStudent_ClassEntity_IdAndStatus(
              lecturerUserId, classId, status, pageRequest);
    } else if (classId != null) {
      requests = faceUpdateRequestRepository
          .findByStudent_ClassEntity_LecturerEntity_IdAndStudent_ClassEntity_Id(lecturerUserId, classId, pageRequest);
    } else if (status != null) {
      requests = faceUpdateRequestRepository
          .findByStudent_ClassEntity_LecturerEntity_IdAndStatus(lecturerUserId, status, pageRequest);
    } else {
      requests = faceUpdateRequestRepository.findByStudent_ClassEntity_LecturerEntity_Id(lecturerUserId, pageRequest);
    }
    return toListResponse(requests);
  }

  @Override
  @Transactional(readOnly = true)
  public FaceUpdateRequestResponse getLecturerRequest(String lecturerUserId, Long requestId) {
    return toResponse(getLecturerRequestOrThrow(lecturerUserId, requestId));
  }

  @Override
  @Transactional
  public FaceUpdateRequestResponse approve(String lecturerUserId, Long requestId, ReviewFaceUpdateRequest request) {
    FaceUpdateRequestEntity updateRequest = getLecturerRequestOrThrow(lecturerUserId, requestId);
    ensurePending(updateRequest);
    UserEntity reviewer = userService.requireCurrentUser();

    FaceProfileEntity profile = faceProfileRepository.findByStudent_Id(updateRequest.getStudent().getId())
        .orElseGet(() -> FaceProfileEntity.builder().student(updateRequest.getStudent()).build());
    profile.setAvatarUrl(updateRequest.getNewAvatarUrl());
    profile.setStatus(FaceProfileStatus.APPROVED);
    profile.setUpdatedBy(reviewer.getId());
    profile.setLastVerifiedAt(LocalDateTime.now());
    faceProfileRepository.save(profile);

    updateRequest.setStatus(FaceUpdateRequestStatus.APPROVED);
    updateRequest.setReviewNote(normalizeReviewNote(request));
    updateRequest.setReviewedBy(reviewer);
    updateRequest.setReviewedAt(LocalDateTime.now());
    FaceUpdateRequestEntity saved = faceUpdateRequestRepository.save(updateRequest);
    createResultNotification(saved, true, reviewer);
    return toResponse(saved);
  }

  @Override
  @Transactional
  public FaceUpdateRequestResponse reject(String lecturerUserId, Long requestId, ReviewFaceUpdateRequest request) {
    FaceUpdateRequestEntity updateRequest = getLecturerRequestOrThrow(lecturerUserId, requestId);
    ensurePending(updateRequest);
    UserEntity reviewer = userService.requireCurrentUser();

    updateRequest.setStatus(FaceUpdateRequestStatus.REJECTED);
    updateRequest.setReviewNote(normalizeReviewNote(request));
    updateRequest.setReviewedBy(reviewer);
    updateRequest.setReviewedAt(LocalDateTime.now());
    FaceUpdateRequestEntity saved = faceUpdateRequestRepository.save(updateRequest);
    createResultNotification(saved, false, reviewer);
    return toResponse(saved);
  }

  private FaceUpdateRequestEntity getLecturerRequestOrThrow(String lecturerUserId, Long requestId) {
    return faceUpdateRequestRepository.findByIdAndStudent_ClassEntity_LecturerEntity_Id(requestId, lecturerUserId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu cập nhật ảnh khuôn mặt."));
  }

  private void ensurePending(FaceUpdateRequestEntity request) {
    if (request.getStatus() != FaceUpdateRequestStatus.PENDING) {
      throw new ApiException(HttpStatus.CONFLICT, "Yêu cầu này đã được xử lý.");
    }
  }

  private void createResultNotification(FaceUpdateRequestEntity request, boolean approved, UserEntity reviewer) {
    StudentEntity student = request.getStudent();
    if (student == null) {
      return;
    }

    String title = "Kết quả duyệt ảnh khuôn mặt";
    String content = approved
        ? "Yêu cầu cập nhật ảnh khuôn mặt của bạn đã được duyệt."
        : "Yêu cầu cập nhật ảnh khuôn mặt của bạn bị từ chối.";
    if (!approved && StringUtils.hasText(request.getReviewNote())) {
      content += " Lý do: " + request.getReviewNote();
    }

    NotificationEntity notification = NotificationEntity.builder()
        .sender(reviewer)
        .title(title)
        .content(content)
        .targetType(NotificationType.STUDENT)
        .classEntity(student.getClassEntity())
        .attachmentName(null)
        .attachmentPath(null)
        .build();
    NotificationEntity saved = notificationRepository.save(notification);
    notificationRecipientRepository.save(NotificationRecipientEntity.builder()
        .notification(saved)
        .student(student)
        .read(false)
        .readAt(null)
        .build());
  }

  private FaceUpdateRequestListResponse toListResponse(Page<FaceUpdateRequestEntity> page) {
    return new FaceUpdateRequestListResponse(page.getNumber(), page.getSize(), page.getTotalElements(),
        page.getTotalPages(), page.getContent().stream().map(this::toResponse).toList());
  }

  private FaceUpdateRequestResponse toResponse(FaceUpdateRequestEntity request) {
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

  private String normalizeReviewNote(ReviewFaceUpdateRequest request) {
    if (request == null || !StringUtils.hasText(request.reviewNote())) {
      return null;
    }
    return request.reviewNote().trim();
  }

  private String format(LocalDateTime value) {
    return value != null ? value.format(UI_TIME_FORMAT) : null;
  }
}
