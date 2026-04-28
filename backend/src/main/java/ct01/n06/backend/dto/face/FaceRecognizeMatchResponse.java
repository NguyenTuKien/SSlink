package ct01.n06.backend.dto.face;

public record FaceRecognizeMatchResponse(
    String studentId,
    String studentCode,
    String fullName,
    Double confidence,
    boolean duplicate,
    String result
) {
}
