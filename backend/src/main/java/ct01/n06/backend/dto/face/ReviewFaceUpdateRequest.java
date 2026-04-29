package ct01.n06.backend.dto.face;

import jakarta.validation.constraints.Size;

public record ReviewFaceUpdateRequest(
    @Size(max = 1000)
    String reviewNote
) {
}
