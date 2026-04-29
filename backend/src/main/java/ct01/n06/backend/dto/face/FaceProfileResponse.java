package ct01.n06.backend.dto.face;

public record FaceProfileResponse(
    Long id,
    String studentId,
    String studentName,
    String avatarUrl,
    String status,
    Double qualityScore,
    String livenessLevel,
    String updatedAt
) {
}
