package ct01.n06.backend.dto.face;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ConfirmFaceAttendanceRequest(
    @NotEmpty List<String> selectedStudentIds
) {
}
