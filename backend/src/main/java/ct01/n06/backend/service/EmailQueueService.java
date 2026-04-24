package ct01.n06.backend.service;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import ct01.n06.backend.config.EmailRabbitMQConfig;
import ct01.n06.backend.dto.mail.NotificationEmailJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailQueueService {

  private final RabbitTemplate rabbitTemplate;

  public void enqueueNotificationEmail(NotificationEmailJob job) {
    if (job == null) {
      log.warn("Bỏ qua enqueue email vì job rỗng.");
      return;
    }

    rabbitTemplate.convertAndSend(
        EmailRabbitMQConfig.EXCHANGE_NAME,
        EmailRabbitMQConfig.ROUTING_KEY,
        job
    );
  }
}