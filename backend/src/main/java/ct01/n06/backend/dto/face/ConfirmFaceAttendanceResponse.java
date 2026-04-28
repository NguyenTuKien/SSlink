package ct01.n06.backend.dto.face;

public record ConfirmFaceAttendanceResponse(
    int createdCount,
    int skippedCount,
    String message
) {
}
