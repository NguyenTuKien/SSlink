package ct01.n06.backend.dto.face;

public record FaceRecognizeBoxResponse(
    String probeFaceId,
    Integer x,
    Integer y,
    Integer width,
    Integer height,
    Double xRatio,
    Double yRatio,
    Double widthRatio,
    Double heightRatio,
    Double qualityScore,
    String qualityLabel,
    Double confidence,
    String result,
    String studentId,
    String studentCode,
    String fullName,
    boolean duplicate
) {
}
