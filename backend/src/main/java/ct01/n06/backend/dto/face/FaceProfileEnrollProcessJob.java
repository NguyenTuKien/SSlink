package ct01.n06.backend.dto.face;

public record FaceProfileEnrollProcessJob(
    Long profileId,
    byte[] imageBytes
) {
}
