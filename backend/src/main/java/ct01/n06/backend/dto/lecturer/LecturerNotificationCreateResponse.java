package ct01.n06.backend.dto.lecturer;

public record LecturerNotificationCreateResponse(
    Long notificationId,
    int totalRecipients,
    int queuedEmailCount,
    int failedQueueCount,
    String createdAt,
    String attachmentName
) {
}
