package ct01.n06.backend.service;

import java.util.List;

public interface FaceIntegrationService {

  List<DetectedFace> detectFaces(byte[] imageBytes);

  VerifyResult verify(String faceId1, String faceId2);

  List<MatchResult> match(List<String> probeFaceIds, List<String> candidateFaceIds, int topK);

  record FaceBox(
      Integer x,
      Integer y,
      Integer width,
      Integer height,
      Double xRatio,
      Double yRatio,
      Double widthRatio,
      Double heightRatio) {
  }

  record DetectedFace(
      String faceId,
      Double qualityScore,
      String qualityLabel,
      FaceBox faceBox) {
  }

  record VerifyResult(boolean identical, Double confidence) {
  }

  record MatchCandidate(String faceId, boolean identical, Double confidence) {
  }

  record MatchResult(String probeFaceId, List<MatchCandidate> candidates) {
  }
}
