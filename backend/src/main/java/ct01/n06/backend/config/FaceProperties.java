package ct01.n06.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "face.integration")
public class FaceProperties {

  private String baseUrl = "http://localhost:8000";
  private String authToken;
  private String modelName = "Facenet512";
  private String detectorBackend = "retinaface";
  private boolean enforceDetection = true;
  private int connectTimeoutMs = 8000;
  private int readTimeoutMs = 15000;
  private double matchThreshold = 0.72;
  private double minProbeQualityScore = 0.45;
  private double qualityStrictThreshold = 0.65;
  private double lowQualityThresholdBoost = 0.04;
  private double minConfidenceGap = 0.03;
  private int maxProbeFacesPerFrame = 6;
  private boolean requireLiveness = false;
  private long maxImageSizeBytes = 2 * 1024 * 1024;
  private long profileCacheTtlSeconds = 300;
  private long sessionCandidateCacheTtlSeconds = 90;
}
