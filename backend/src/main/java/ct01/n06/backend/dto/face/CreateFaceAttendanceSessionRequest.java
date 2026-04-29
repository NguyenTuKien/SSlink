package ct01.n06.backend.dto.face;

import jakarta.validation.constraints.NotNull;

public record CreateFaceAttendanceSessionRequest(
    @NotNull Long classId,
    @NotNull Long eventId,
    @NotNull Long semesterId
) {
}
