package ct01.n06.backend.service;

import ct01.n06.backend.dto.common.SimpleMessageResponse;
import ct01.n06.backend.dto.lecturer.CreateLecturerNotificationRequest;
import ct01.n06.backend.dto.lecturer.LecturerNotificationCreateResponse;
import ct01.n06.backend.dto.student.StudentNotificationListResponse;
import ct01.n06.backend.dto.student.StudentNotificationUnreadResponse;
import java.nio.file.Path;
import org.springframework.web.multipart.MultipartFile;

public interface NotificationService {

  LecturerNotificationCreateResponse createLecturerNotification(
      CreateLecturerNotificationRequest request,
      MultipartFile file
  );

  StudentNotificationListResponse getStudentNotifications(String userId, int page, int size);

  StudentNotificationUnreadResponse getStudentUnreadCount(String userId);

  SimpleMessageResponse markAsRead(String userId, Long recipientId);

  NotificationAttachment getStudentAttachment(String userId, Long recipientId);

  void createStudentCheckinNotification(
      ct01.n06.backend.entity.StudentEntity student,
      ct01.n06.backend.entity.EventEntity event
  );

  record NotificationAttachment(String fileName, Path filePath) {
  }
}
