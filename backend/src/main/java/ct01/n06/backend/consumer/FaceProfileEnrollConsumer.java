package ct01.n06.backend.consumer;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ct01.n06.backend.config.FaceProfileEnrollRabbitMQConfig;
import ct01.n06.backend.dto.face.FaceProfileEnrollProcessJob;
import ct01.n06.backend.entity.FaceProfileEntity;
import ct01.n06.backend.entity.enums.FaceProfileStatus;
import ct01.n06.backend.repository.FaceProfileRepository;
import ct01.n06.backend.service.FaceIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceProfileEnrollConsumer {

  private static final double MIN_QUALITY_SCORE = 0.75;
  private static final String SYSTEM_ACTOR = "SYSTEM_FACE_ENROLL_CONSUMER";

  private final FaceProfileRepository faceProfileRepository;
  private final FaceIntegrationService faceIntegrationService;

  @RabbitListener(queues = FaceProfileEnrollRabbitMQConfig.QUEUE_NAME)
  @Transactional
  public void process(FaceProfileEnrollProcessJob job) {
    if (job == null || job.profileId() == null || job.imageBytes() == null || job.imageBytes().length == 0) {
      log.warn("Received invalid face profile enroll job, skip.");
      return;
    }

    FaceProfileEntity profile = faceProfileRepository.findById(job.profileId()).orElse(null);
    if (profile == null) {
      log.warn("Face profile not found for enroll job: profileId={}", job.profileId());
      return;
    }
    if (profile.getStatus() != FaceProfileStatus.PENDING_APPROVAL) {
      log.info("Face profile already processed before consumer handled it: profileId={}, status={}",
          profile.getId(),
          profile.getStatus());
      return;
    }

    try {
      List<FaceIntegrationService.DetectedFace> faces = faceIntegrationService.detectFaces(job.imageBytes());
      if (faces.isEmpty() || faces.size() > 1) {
        markInvalid(profile);
        return;
      }

      FaceIntegrationService.DetectedFace face = faces.get(0);
      if (face.qualityScore() != null && face.qualityScore() < MIN_QUALITY_SCORE) {
        markInvalid(profile);
        return;
      }

      profile.setExternalFacePersistedId(face.faceId());
      profile.setQualityScore(face.qualityScore());
      profile.setStatus(FaceProfileStatus.APPROVED);
      profile.setLastVerifiedAt(LocalDateTime.now());
      profile.setUpdatedBy(SYSTEM_ACTOR);
      faceProfileRepository.save(profile);
      log.info("Face profile enroll processed successfully in background: profileId={}", profile.getId());
    } catch (RuntimeException ex) {
      log.error("Failed to process face profile enroll in background: profileId={}", profile.getId(), ex);
    }
  }

  private void markInvalid(FaceProfileEntity profile) {
    profile.setStatus(FaceProfileStatus.NOT_ENROLLED);
    profile.setAvatarUrl(null);
    profile.setExternalFacePersistedId(null);
    profile.setQualityScore(null);
    profile.setLastVerifiedAt(null);
    profile.setUpdatedBy(SYSTEM_ACTOR);
    faceProfileRepository.save(profile);
    log.info("Face profile enroll rejected by validation in background: profileId={}", profile.getId());
  }
}
