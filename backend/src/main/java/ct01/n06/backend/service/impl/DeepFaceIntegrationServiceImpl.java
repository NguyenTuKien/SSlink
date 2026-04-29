package ct01.n06.backend.service.impl;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.fasterxml.jackson.annotation.JsonProperty;

import ct01.n06.backend.config.FaceProperties;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.service.FaceIntegrationService;
import ct01.n06.backend.util.MultipartInputStreamFileResource;

@Service
public class DeepFaceIntegrationServiceImpl implements FaceIntegrationService {

  private final FaceProperties properties;
  private final RestClient restClient;

  public DeepFaceIntegrationServiceImpl(FaceProperties properties) {
    this.properties = properties;
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(Math.max(1000, properties.getConnectTimeoutMs()));
    requestFactory.setReadTimeout(Math.max(2000, properties.getReadTimeoutMs()));
    this.restClient = RestClient.builder()
        .baseUrl(properties.getBaseUrl())
        .requestFactory(requestFactory)
        .build();
  }

  @Override
  public List<DetectedFace> detectFaces(byte[] imageBytes) {
    ensureConfigured();
    try {
      MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
      body.add("file", new MultipartInputStreamFileResource(imageBytes, "face.jpg"));
      body.add("model_name", properties.getModelName());
      body.add("detector_backend", properties.getDetectorBackend());
      body.add("enforce_detection", String.valueOf(properties.isEnforceDetection()));

      DetectResponse response = restClient.post()
          .uri("/detect")
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .headers(headers -> applyAuthHeader(headers::set))
          .body(body)
          .retrieve()
          .body(DetectResponse.class);

      if (response == null || response.faces() == null) {
        return List.of();
      }

      List<DetectedFace> faces = new ArrayList<>();
      for (DetectFaceItem item : response.faces()) {
        if (!StringUtils.hasText(item.faceId())) {
          continue;
        }
        Double qualityScore = normalizeScore(item.qualityScore());
        String qualityLabel = StringUtils.hasText(item.qualityLabel())
            ? item.qualityLabel()
            : inferQualityLabel(qualityScore);
        faces.add(new DetectedFace(
            item.faceId(),
            qualityScore,
            qualityLabel,
            toFaceBox(item.faceBox())));
      }
      return faces;
    } catch (RestClientResponseException ex) {
      if (ex.getStatusCode().value() == 400 && isNoFaceDetectedError(ex.getResponseBodyAsString())) {
        return List.of();
      }
      throw new ApiException(HttpStatus.BAD_GATEWAY,
          "DeepFace AI service trả về lỗi HTTP " + ex.getStatusCode().value() + ". "
              + truncateErrorBody(ex.getResponseBodyAsString()));
    } catch (Exception ex) {
      throw new ApiException(HttpStatus.BAD_GATEWAY,
          "Không thể gọi DeepFace AI service: " + ex.getMessage());
    }
  }

  @Override
  public VerifyResult verify(String faceId1, String faceId2) {
    ensureConfigured();
    try {
      MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
      body.add("face_id_1", faceId1);
      body.add("face_id_2", faceId2);
      body.add("model_name", properties.getModelName());
      body.add("detector_backend", properties.getDetectorBackend());
      body.add("enforce_detection", String.valueOf(properties.isEnforceDetection()));

      VerifyResponse response = restClient.post()
          .uri("/verify")
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .headers(headers -> applyAuthHeader(headers::set))
          .body(body)
          .retrieve()
          .body(VerifyResponse.class);

      if (response == null) {
        return new VerifyResult(false, 0.0);
      }
      return new VerifyResult(response.verified, normalizeScore(response.distanceToConfidence()));
    } catch (RestClientResponseException ex) {
      throw new ApiException(HttpStatus.BAD_GATEWAY,
          "DeepFace AI service trả về lỗi HTTP " + ex.getStatusCode().value() + ". "
              + truncateErrorBody(ex.getResponseBodyAsString()));
    } catch (Exception ex) {
      throw new ApiException(HttpStatus.BAD_GATEWAY,
          "Không thể gọi DeepFace AI service: " + ex.getMessage());
    }
  }

  @Override
  public List<MatchResult> match(List<String> probeFaceIds, List<String> candidateFaceIds, int topK) {
    ensureConfigured();
    if (probeFaceIds == null || probeFaceIds.isEmpty() || candidateFaceIds == null || candidateFaceIds.isEmpty()) {
      return List.of();
    }
    try {
      MatchResponse response = restClient.post()
          .uri("/match")
          .contentType(MediaType.APPLICATION_JSON)
          .headers(headers -> applyAuthHeader(headers::set))
          .body(Map.of(
              "probe_face_ids", probeFaceIds,
              "candidate_face_ids", candidateFaceIds,
              "top_k", Math.max(topK, 1)))
          .retrieve()
          .body(MatchResponse.class);

      if (response == null || response.results() == null) {
        return List.of();
      }

      return response.results().stream()
          .map(item -> new MatchResult(
              item.probeFaceId(),
              item.matches() == null ? List.of() : item.matches().stream()
                  .map(match -> new MatchCandidate(
                      match.faceId(),
                      match.verified(),
                      normalizeScore(match.confidence())))
                  .sorted(Comparator.comparing(
                      (MatchCandidate candidate) -> candidate.confidence() != null ? candidate.confidence() : 0.0)
                      .reversed())
                  .collect(Collectors.toList())))
          .collect(Collectors.toList());
    } catch (RestClientResponseException ex) {
      if (ex.getStatusCode().value() == 404) {
        // Backward compatibility for AI service images that do not expose /match yet.
        return fallbackMatchByVerify(probeFaceIds, candidateFaceIds, topK);
      }
      throw new ApiException(HttpStatus.BAD_GATEWAY,
          "DeepFace AI service trả về lỗi HTTP " + ex.getStatusCode().value() + ". "
              + truncateErrorBody(ex.getResponseBodyAsString()));
    } catch (Exception ex) {
      throw new ApiException(HttpStatus.BAD_GATEWAY,
          "Không thể gọi DeepFace AI service: " + ex.getMessage());
    }
  }

  private List<MatchResult> fallbackMatchByVerify(List<String> probeFaceIds, List<String> candidateFaceIds, int topK) {
    int limit = Math.max(1, Math.min(topK, candidateFaceIds.size()));
    List<MatchResult> results = new ArrayList<>();
    for (String probeFaceId : probeFaceIds) {
      List<MatchCandidate> candidates = new ArrayList<>();
      for (String candidateFaceId : candidateFaceIds) {
        VerifyResult verifyResult = verify(probeFaceId, candidateFaceId);
        candidates.add(new MatchCandidate(candidateFaceId, verifyResult.identical(), verifyResult.confidence()));
      }
      candidates.sort(Comparator.comparing(
          MatchCandidate::confidence,
          Comparator.nullsLast(Double::compareTo)).reversed());
      if (candidates.size() > limit) {
        candidates = new ArrayList<>(candidates.subList(0, limit));
      }
      results.add(new MatchResult(probeFaceId, candidates));
    }
    return results;
  }

  private void ensureConfigured() {
    if (!StringUtils.hasText(properties.getBaseUrl())) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
          "Chưa cấu hình AI_FACE_SERVICE_BASE_URL cho DeepFace AI service.");
    }
  }

  private void applyAuthHeader(java.util.function.BiConsumer<String, String> headerSetter) {
    if (StringUtils.hasText(properties.getAuthToken())) {
      headerSetter.accept("X-AI-Service-Token", properties.getAuthToken());
    }
  }

  private Double normalizeScore(Double score) {
    if (score == null) {
      return 0.0;
    }
    return Math.max(0.0, Math.min(1.0, score));
  }

  private String inferQualityLabel(Double score) {
    if (score == null) {
      return "medium";
    }
    if (score >= 0.85) {
      return "high";
    }
    if (score >= 0.6) {
      return "medium";
    }
    return "low";
  }

  private String truncateErrorBody(String body) {
    if (!StringUtils.hasText(body)) {
      return "";
    }
    String normalized = body.replaceAll("\\s+", " ").trim();
    if (normalized.length() <= 240) {
      return normalized;
    }
    return normalized.substring(0, 240) + "...";
  }

  private FaceIntegrationService.FaceBox toFaceBox(DetectFaceBoxItem item) {
    if (item == null) {
      return null;
    }
    return new FaceIntegrationService.FaceBox(
        item.x(),
        item.y(),
        item.width(),
        item.height(),
        normalizeRatio(item.xRatio()),
        normalizeRatio(item.yRatio()),
        normalizeRatio(item.widthRatio()),
        normalizeRatio(item.heightRatio()));
  }

  private Double normalizeRatio(Double value) {
    if (value == null) {
      return null;
    }
    return Math.max(0.0, Math.min(1.0, value));
  }

  private boolean isNoFaceDetectedError(String body) {
    if (!StringUtils.hasText(body)) {
      return false;
    }
    String normalized = body.toLowerCase();
    return normalized.contains("face could not be detected")
        || normalized.contains("face detection failed");
  }

  private record DetectResponse(List<DetectFaceItem> faces) {
  }

  private record DetectFaceItem(
    @JsonProperty("face_id")
    String faceId,
    @JsonProperty("quality_score")
    Double qualityScore,
    @JsonProperty("quality_label")
    String qualityLabel,
    @JsonProperty("face_box")
    DetectFaceBoxItem faceBox) {
  }

  private record DetectFaceBoxItem(
      Integer x,
      Integer y,
      Integer width,
      Integer height,
      @JsonProperty("x_ratio")
      Double xRatio,
      @JsonProperty("y_ratio")
      Double yRatio,
      @JsonProperty("width_ratio")
      Double widthRatio,
      @JsonProperty("height_ratio")
      Double heightRatio) {
  }

  private record VerifyResponse(boolean verified, Double distance, Double threshold) {

    private Double distanceToConfidence() {
      if (distance == null || threshold == null || threshold <= 0.0) {
        return 0.0;
      }
      return 1.0 - (distance / threshold);
    }
  }

  private record MatchResponse(List<MatchResponseItem> results) {
  }

  private record MatchResponseItem(
      @JsonProperty("probe_face_id")
      String probeFaceId,
      List<MatchResponseCandidate> matches) {
  }

  private record MatchResponseCandidate(
      @JsonProperty("face_id")
      String faceId,
      boolean verified,
      Double confidence) {
  }
}
