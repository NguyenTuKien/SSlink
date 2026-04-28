package ct01.n06.backend.dto.face;

public record FaceProfileStatusResponse(
    String status,
    String avatarUrl,
    boolean canRequestUpdate,
    String warningMessage,
    Double qualityScore
) {
}
