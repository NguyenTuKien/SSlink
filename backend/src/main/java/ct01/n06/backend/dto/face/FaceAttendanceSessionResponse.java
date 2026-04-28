package ct01.n06.backend.dto.face;

public record FaceAttendanceSessionResponse(
    Long id,
    Long classId,
    String classCode,
    Long eventId,
    String eventTitle,
    Long semesterId,
    String status,
    String startedAt,
    String endedAt,
    Integer attendedCount,
    String message
) {
}
