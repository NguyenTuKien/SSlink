package ct01.n06.backend.dto.face;

import java.util.List;

public record FaceUpdateRequestListResponse(
    int page,
    int size,
    long totalElements,
    int totalPages,
    List<FaceUpdateRequestResponse> items
) {
}
