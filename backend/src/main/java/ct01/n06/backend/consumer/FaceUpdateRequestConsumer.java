package ct01.n06.backend.consumer;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ct01.n06.backend.config.FaceUpdateRabbitMQConfig;
import ct01.n06.backend.dto.face.FaceUpdateProcessJob;
import ct01.n06.backend.entity.FaceUpdateRequestEntity;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
import ct01.n06.backend.repository.FaceUpdateRequestRepository;
import ct01.n06.backend.service.FaceIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceUpdateRequestConsumer {

  private static final double MIN_QUALITY_SCORE = 0.75;

  private final FaceUpdateRequestRepository faceUpdateRequestRepository;
  private final FaceIntegrationService faceIntegrationService;

  @RabbitListener(queues = FaceUpdateRabbitMQConfig.QUEUE_NAME)
  @Transactional
  public void process(FaceUpdateProcessJob job) {
    if (job == null || job.requestId() == null || job.imageBytes() == null || job.imageBytes().length == 0) {
      log.warn("Nhận face update job không hợp lệ, bỏ qua.");
      return;
    }

    FaceUpdateRequestEntity request = faceUpdateRequestRepository.findById(job.requestId()).orElse(null);
    if (request == null) {
      log.warn("Không tìm thấy yêu cầu cập nhật khuôn mặt để xử lý nền: requestId={}", job.requestId());
      return;
    }
    if (request.getStatus() != FaceUpdateRequestStatus.PENDING) {
      log.info("Yêu cầu cập nhật khuôn mặt đã được xử lý trước đó: requestId={}, status={}",
          request.getId(),
          request.getStatus());
      return;
    }

    try {
      List<FaceIntegrationService.DetectedFace> faces = faceIntegrationService.detectFaces(job.imageBytes());
      if (faces.isEmpty()) {
        rejectInvalidRequest(request, "Ảnh không hợp lệ: không phát hiện khuôn mặt.");
        return;
      }
      if (faces.size() > 1) {
        rejectInvalidRequest(request, "Ảnh không hợp lệ: chỉ được chứa một khuôn mặt.");
        return;
      }

      FaceIntegrationService.DetectedFace face = faces.get(0);
      if (face.qualityScore() != null && face.qualityScore() < MIN_QUALITY_SCORE) {
        rejectInvalidRequest(request, "Ảnh không hợp lệ: chất lượng khuôn mặt chưa đạt.");
        return;
      }

      request.setNewFaceReferenceId(face.faceId());
      request.setReviewNote(null);
      faceUpdateRequestRepository.save(request);
      log.info("Đã xử lý nền yêu cầu cập nhật khuôn mặt: requestId={}", request.getId());
    } catch (RuntimeException ex) {
      log.error("Lỗi xử lý nền yêu cầu cập nhật khuôn mặt: requestId={}", request.getId(), ex);
    }
  }

  private void rejectInvalidRequest(FaceUpdateRequestEntity request, String note) {
    request.setStatus(FaceUpdateRequestStatus.REJECTED);
    request.setReviewNote(note);
    request.setReviewedAt(LocalDateTime.now());
    faceUpdateRequestRepository.save(request);
    log.info("Tự động từ chối yêu cầu cập nhật khuôn mặt không hợp lệ: requestId={}, note={}",
        request.getId(),
        note);
  }
}
