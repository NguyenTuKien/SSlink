package ct01.n06.backend.dto.mail;

import java.util.List;

public record NotificationEmailJob(
    String subject,
    String content,
    String senderName,
    List<Recipient> recipients,
    String attachmentName,
    String attachmentPath
) {

  public record Recipient(String email, String fullName) {
  }
}