package ct01.n06.backend.consumer;

import java.nio.file.Path;
import java.util.List;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import ct01.n06.backend.config.EmailRabbitMQConfig;
import ct01.n06.backend.dto.mail.NotificationEmailJob;
import ct01.n06.backend.service.EmailService;
import ct01.n06.backend.service.EmailService.EmailRecipient;
import ct01.n06.backend.service.EmailService.EmailSendSummary;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailNotificationConsumer {

  private final EmailService emailService;

  @RabbitListener(queues = EmailRabbitMQConfig.QUEUE_NAME)
  public void processNotificationEmail(NotificationEmailJob job) {
    if (job == null) {
      log.warn("Nhận email job rỗng, bỏ qua.");
      return;
    }

    List<EmailRecipient> recipients = job.recipients() == null
        ? List.of()
        : job.recipients().stream()
            .filter(recipient -> recipient != null && StringUtils.hasText(recipient.email()))
            .map(recipient -> new EmailRecipient(recipient.email().trim(), recipient.fullName()))
            .toList();

    if (recipients.isEmpty()) {
      log.warn("Email job không có người nhận hợp lệ: subject={}", job.subject());
      return;
    }

    Path attachmentPath = StringUtils.hasText(job.attachmentPath()) ? Path.of(job.attachmentPath()) : null;
    EmailSendSummary summary = emailService.sendNotificationEmail(
        job.subject(),
        job.content(),
        job.senderName(),
        recipients,
        job.attachmentName(),
        attachmentPath
    );

    log.info(
        "Đã xử lý email job: subject={}, recipients={}, sent={}, failed={}",
        job.subject(),
        recipients.size(),
        summary.sentCount(),
        summary.failedCount()
    );
  }
}