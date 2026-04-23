package ct01.n06.backend.service.impl;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import ct01.n06.backend.dto.common.SimpleMessageResponse;
import ct01.n06.backend.dto.lecturer.CreateLecturerNotificationRequest;
import ct01.n06.backend.dto.lecturer.LecturerNotificationCreateResponse;
import ct01.n06.backend.dto.student.StudentNotificationListResponse;
import ct01.n06.backend.dto.student.StudentNotificationListResponse.StudentNotificationItem;
import ct01.n06.backend.dto.student.StudentNotificationUnreadResponse;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.EventEntity;
import ct01.n06.backend.entity.NotificationEntity;
import ct01.n06.backend.entity.NotificationRecipientEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.NotificationType;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.LecturerRepository;
import ct01.n06.backend.repository.NotificationRecipientRepository;
import ct01.n06.backend.repository.NotificationRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.service.EmailService;
import ct01.n06.backend.service.EmailService.EmailRecipient;
import ct01.n06.backend.service.EmailService.EmailSendSummary;
import ct01.n06.backend.service.NotificationService;
import ct01.n06.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

  private static final DateTimeFormatter UI_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

  private final UserService userService;
  private final StudentRepository studentRepository;
  private final ClassRepository classRepository;
  private final NotificationRepository notificationRepository;
  private final NotificationRecipientRepository notificationRecipientRepository;
  private final LecturerRepository lecturerRepository;
  private final EmailService emailService;

  @Value("${notification.attachment.dir:./backend/storage/notifications}")
  private String attachmentDirectory;

  @Value("${notification.attachment.max-size-bytes:10485760}")
  private long maxAttachmentSizeBytes;

  @Override
  @Transactional
  public LecturerNotificationCreateResponse createLecturerNotification(
      CreateLecturerNotificationRequest request,
      MultipartFile file
  ) {
    if (request == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu dữ liệu thông báo.");
    }

    UserEntity sender = userService.requireCurrentUser();
    NotificationType targetType = normalizeTargetType(request.targetType());

    String title = request.title() != null ? request.title().trim() : "";
    String content = request.content() != null ? request.content().trim() : "";

    if (!StringUtils.hasText(title)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Tiêu đề không được để trống.");
    }
    if (!StringUtils.hasText(content)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Nội dung không được để trống.");
    }

    ClassEntity classEntity = resolveTargetClass(targetType, request.classId(), sender.getId());
    List<StudentEntity> recipients = resolveRecipients(sender.getId(), targetType, classEntity);

    if (recipients.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Không tìm thấy sinh viên hợp lệ để nhận thông báo.");
    }

    StoredAttachment attachment = storeAttachment(file);

    NotificationEntity notification = NotificationEntity.builder()
        .sender(sender)
        .title(title)
        .content(content)
        .targetType(targetType)
        .classEntity(classEntity)
        .attachmentName(attachment != null ? attachment.fileName() : null)
        .attachmentPath(attachment != null ? attachment.absolutePath().toString() : null)
        .build();
    NotificationEntity savedNotification = notificationRepository.save(notification);

    List<NotificationRecipientEntity> recipientEntities = recipients.stream()
        .map(student -> NotificationRecipientEntity.builder()
            .notification(savedNotification)
            .student(student)
            .read(false)
            .build())
        .toList();
    notificationRecipientRepository.saveAll(recipientEntities);

    EmailSendSummary emailSummary = sendNotificationEmail(savedNotification, recipients, attachment);

    String createdAt = savedNotification.getCreatedAt() != null
        ? savedNotification.getCreatedAt().format(UI_TIME_FORMAT)
        : LocalDateTime.now().format(UI_TIME_FORMAT);

    return new LecturerNotificationCreateResponse(
        savedNotification.getId(),
        recipients.size(),
        emailSummary.sentCount(),
        emailSummary.failedCount(),
        createdAt,
        savedNotification.getAttachmentName()
    );
  }

  @Override
  @Transactional(readOnly = true)
  public StudentNotificationListResponse getStudentNotifications(String userId, int page, int size) {
    StudentEntity student = getStudentByUserId(userId);
    int normalizedPage = Math.max(page, 0);
    int normalizedSize = Math.min(Math.max(size, 1), 100);

    var notificationPage = notificationRecipientRepository.findByStudent_IdOrderByCreatedAtDesc(
        student.getId(),
        PageRequest.of(normalizedPage, normalizedSize)
    );

    List<StudentNotificationItem> items = notificationPage.getContent().stream()
        .map(this::toStudentNotificationItem)
        .toList();

    long unreadCount = notificationRecipientRepository.countByStudent_IdAndReadFalse(student.getId());

    return new StudentNotificationListResponse(
        normalizedPage,
        normalizedSize,
        notificationPage.getTotalElements(),
        notificationPage.getTotalPages(),
        unreadCount,
        items
    );
  }

  @Override
  @Transactional(readOnly = true)
  public StudentNotificationUnreadResponse getStudentUnreadCount(String userId) {
    StudentEntity student = getStudentByUserId(userId);
    long unreadCount = notificationRecipientRepository.countByStudent_IdAndReadFalse(student.getId());
    return new StudentNotificationUnreadResponse(unreadCount);
  }

  @Override
  @Transactional
  public SimpleMessageResponse markAsRead(String userId, Long recipientId) {
    StudentEntity student = getStudentByUserId(userId);
    NotificationRecipientEntity recipient = notificationRecipientRepository
        .findByIdAndStudent_Id(recipientId, student.getId())
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo."));

    if (!recipient.isRead()) {
      recipient.setRead(true);
      recipient.setReadAt(LocalDateTime.now());
      notificationRecipientRepository.save(recipient);
    }

    return new SimpleMessageResponse("Đã đánh dấu thông báo là đã đọc.");
  }

  @Override
  @Transactional(readOnly = true)
  public NotificationAttachment getStudentAttachment(String userId, Long recipientId) {
    StudentEntity student = getStudentByUserId(userId);
    NotificationRecipientEntity recipient = notificationRecipientRepository
        .findByIdAndStudent_Id(recipientId, student.getId())
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo."));

    NotificationEntity notification = recipient.getNotification();
    if (!StringUtils.hasText(notification.getAttachmentPath())
        || !StringUtils.hasText(notification.getAttachmentName())) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Thông báo này không có file đính kèm.");
    }

    Path filePath = Path.of(notification.getAttachmentPath());
    if (!Files.exists(filePath)) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy file đính kèm.");
    }

    return new NotificationAttachment(notification.getAttachmentName(), filePath);
  }

  @Override
  @Transactional
  public void createStudentCheckinNotification(StudentEntity student, EventEntity event) {
    if (student == null || event == null) {
      log.warn("Bỏ qua gửi thông báo check-in vì thiếu dữ liệu: student={}, event={}", student, event);
      return;
    }

    StudentEntity resolvedStudent = studentRepository.findById(student.getId())
        .orElse(student);

    String eventTitle = StringUtils.hasText(event.getTitle()) ? event.getTitle() : "sự kiện";
    String checkinTime = LocalDateTime.now().format(UI_TIME_FORMAT);
    String title = "Điểm danh thành công";
    String content = "Bạn đã điểm danh thành công cho " + eventTitle + " lúc " + checkinTime + ".";

    NotificationEntity notification = NotificationEntity.builder()
        .sender(null)
        .title(title)
        .content(content)
        .targetType(NotificationType.STUDENT)
        .classEntity(resolvedStudent.getClassEntity())
        .build();
    NotificationEntity savedNotification = notificationRepository.save(notification);

    NotificationRecipientEntity recipient = NotificationRecipientEntity.builder()
        .notification(savedNotification)
        .student(resolvedStudent)
        .read(false)
        .build();
    notificationRecipientRepository.save(recipient);

    try {
      UserEntity user = resolvedStudent.getUserEntity();
      if (user == null || user.getStatus() == UserStatus.DELETED) {
        return;
      }

      String email = user.getEmail();
      if (!StringUtils.hasText(email)) {
        return;
      }

      String recipientName = StringUtils.hasText(resolvedStudent.getFullName()) ? resolvedStudent.getFullName() : "Bạn";
      emailService.sendNotificationEmail(
          "[UniPoint] " + title,
          content,
          "Hệ thống UniPoint",
          List.of(new EmailRecipient(email.trim(), recipientName)),
          null,
          null
      );
    } catch (Exception ex) {
      log.warn("Gửi email thông báo check-in thất bại: studentId={}, eventId={}",
          student.getId(),
          event.getId(),
          ex);
    }
  }

  private NotificationType normalizeTargetType(NotificationType targetType) {
    if (targetType == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Loại đối tượng nhận là bắt buộc.");
    }

    if (targetType != NotificationType.ALL && targetType != NotificationType.CLASS) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Chỉ hỗ trợ gửi theo ALL hoặc CLASS.");
    }

    return targetType;
  }

  private ClassEntity resolveTargetClass(NotificationType targetType, Long classId, String lecturerId) {
    if (targetType == NotificationType.ALL) {
      return null;
    }

    if (classId == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Phải chọn lớp khi gửi theo CLASS.");
    }

    return classRepository.findByIdAndLecturerEntityId(classId, lecturerId)
        .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền gửi thông báo cho lớp này."));
  }

  private List<StudentEntity> resolveRecipients(
      String lecturerId,
      NotificationType targetType,
      ClassEntity classEntity
  ) {
    List<StudentEntity> students;
    if (targetType == NotificationType.ALL) {
      // Gửi cho tất cả sinh viên trong hệ thống
      students = studentRepository.findAllByOrderByFullNameAsc();
    } else {
      // Gửi cho sinh viên của lớp cụ thể
      students = studentRepository.findAllByClassEntityId(classEntity.getId());
    }

    List<StudentEntity> filtered = new ArrayList<>();
    for (StudentEntity student : students) {
      if (student == null || student.getUserEntity() == null) {
        continue;
      }

      UserStatus status = student.getUserEntity().getStatus();
      if (status == UserStatus.DELETED) {
        continue;
      }

      String email = student.getUserEntity().getEmail();
      if (!StringUtils.hasText(email)) {
        continue;
      }

      filtered.add(student);
    }

    return filtered;
  }

  private EmailSendSummary sendNotificationEmail(
      NotificationEntity notification,
      List<StudentEntity> recipients,
      StoredAttachment attachment
  ) {
    Map<String, EmailRecipient> uniqueRecipients = new LinkedHashMap<>();

    for (StudentEntity student : recipients) {
      String email = student.getUserEntity().getEmail();
      String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
      uniqueRecipients.putIfAbsent(normalizedEmail, new EmailRecipient(email.trim(), student.getFullName()));
    }

    String senderName = "Giảng viên";
    if (notification.getSender() != null) {
      var lecturer = lecturerRepository.findById(notification.getSender().getId());
      if (lecturer.isPresent() && StringUtils.hasText(lecturer.get().getFullName())) {
        senderName = lecturer.get().getFullName();
      }
    }

    return emailService.sendNotificationEmail(
        "[UniPoint] " + notification.getTitle(),
        notification.getContent(),
        senderName,
        new ArrayList<>(uniqueRecipients.values()),
        attachment != null ? attachment.fileName() : null,
        attachment != null ? attachment.absolutePath() : null
    );
  }

  private StoredAttachment storeAttachment(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      return null;
    }

    if (file.getSize() > maxAttachmentSizeBytes) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "File đính kèm vượt quá giới hạn " + (maxAttachmentSizeBytes / (1024 * 1024)) + "MB.");
    }

    try {
      Path directoryPath = Path.of(attachmentDirectory).toAbsolutePath().normalize();
      Files.createDirectories(directoryPath);

      String originalFileName = StringUtils.cleanPath(
          StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "tep-dinh-kem"
      );
      String safeFileName = originalFileName.replaceAll("[^a-zA-Z0-9._-]", "_");
      if (!StringUtils.hasText(safeFileName)) {
        safeFileName = "tep-dinh-kem";
      }

      String storedFileName = UUID.randomUUID() + "_" + safeFileName;
      Path targetPath = directoryPath.resolve(storedFileName).normalize();
      if (!targetPath.startsWith(directoryPath)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Tên file đính kèm không hợp lệ.");
      }

      try (InputStream inputStream = file.getInputStream()) {
        Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
      }

      return new StoredAttachment(originalFileName, targetPath);
    } catch (IOException ex) {
      log.error("Không thể lưu file đính kèm thông báo", ex);
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu file đính kèm.");
    }
  }

  private StudentNotificationItem toStudentNotificationItem(NotificationRecipientEntity recipient) {
    NotificationEntity notification = recipient.getNotification();
    ClassEntity targetClass = notification.getClassEntity();

    String senderName = notification.getSender() != null && StringUtils.hasText(notification.getSender().getUsername())
        ? notification.getSender().getUsername()
        : "Giảng viên";

    String createdAt = notification.getCreatedAt() != null
        ? notification.getCreatedAt().format(UI_TIME_FORMAT)
        : null;

    String downloadUrl = StringUtils.hasText(notification.getAttachmentPath())
        ? "/v1/student/notifications/" + recipient.getId() + "/attachment"
        : null;

    return new StudentNotificationItem(
        recipient.getId(),
        notification.getId(),
        notification.getTitle(),
        notification.getContent(),
        senderName,
        notification.getTargetType().name(),
        targetClass != null ? targetClass.getId() : null,
        targetClass != null ? targetClass.getClassCode() : null,
        recipient.isRead(),
        createdAt,
        notification.getAttachmentName(),
        downloadUrl
    );
  }

  private StudentEntity getStudentByUserId(String userId) {
    return studentRepository.findByUserEntityId(userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy thông tin sinh viên."));
  }

  private record StoredAttachment(String fileName, Path absolutePath) {
  }
}
