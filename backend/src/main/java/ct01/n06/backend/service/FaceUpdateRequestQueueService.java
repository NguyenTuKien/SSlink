package ct01.n06.backend.service;

import ct01.n06.backend.config.FaceUpdateRabbitMQConfig;
import ct01.n06.backend.dto.face.FaceUpdateProcessJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceUpdateRequestQueueService {

  private final RabbitTemplate rabbitTemplate;

  public void enqueue(Long requestId, byte[] imageBytes) {
    if (requestId == null || imageBytes == null || imageBytes.length == 0) {
      log.warn("Bỏ qua enqueue xử lý ảnh khuôn mặt vì dữ liệu không hợp lệ: requestId={}", requestId);
      return;
    }

    rabbitTemplate.convertAndSend(
        FaceUpdateRabbitMQConfig.EXCHANGE_NAME,
        FaceUpdateRabbitMQConfig.ROUTING_KEY,
        new FaceUpdateProcessJob(requestId, imageBytes));
  }
}
