package ct01.n06.backend.dto.face;

import java.util.List;

public record FaceRecognizeResponse(
    List<FaceRecognizeMatchResponse> matches,
    List<FaceRecognizeBoxResponse> faceBoxes,
    int detectedFaceCount,
    String message
) {
}
