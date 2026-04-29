package ct01.n06.backend.dto.face;

public record FaceUpdateProcessJob(
    Long requestId,
    byte[] imageBytes
) {
}
