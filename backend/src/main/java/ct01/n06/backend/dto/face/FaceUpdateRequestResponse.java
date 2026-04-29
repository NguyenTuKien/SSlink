package ct01.n06.backend.dto.face;

public record FaceUpdateRequestResponse(
    Long id,
    String studentId,
    String studentName,
    Long classId,
    String classCode,
    String oldAvatarUrl,
    String newAvatarUrl,
    String reason,
    String status,
    String reviewNote,
    String reviewedBy,
    String reviewedAt,
    String createdAt
) {
}
