package ct01.n06.backend.service;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import ct01.n06.backend.config.FaceProfileEnrollRabbitMQConfig;
import ct01.n06.backend.dto.face.FaceProfileEnrollProcessJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceProfileEnrollQueueService {

  private final RabbitTemplate rabbitTemplate;

  public void enqueue(Long profileId, byte[] imageBytes) {
    if (profileId == null || imageBytes == null || imageBytes.length == 0) {
      log.warn("Skip enqueue face profile enroll due to invalid payload: profileId={}", profileId);
      return;
    }

    rabbitTemplate.convertAndSend(
        FaceProfileEnrollRabbitMQConfig.EXCHANGE_NAME,
        FaceProfileEnrollRabbitMQConfig.ROUTING_KEY,
        new FaceProfileEnrollProcessJob(profileId, imageBytes));
  }
}
