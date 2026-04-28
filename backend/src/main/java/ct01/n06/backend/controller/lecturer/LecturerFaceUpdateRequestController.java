package ct01.n06.backend.controller.lecturer;

import ct01.n06.backend.dto.face.FaceUpdateRequestListResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestResponse;
import ct01.n06.backend.dto.face.ReviewFaceUpdateRequest;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
import ct01.n06.backend.service.FaceUpdateRequestService;
import ct01.n06.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/lecturer/face-update-requests")
@RequiredArgsConstructor
public class LecturerFaceUpdateRequestController {

  private final FaceUpdateRequestService faceUpdateRequestService;
  private final UserService userService;

  @PreAuthorize("hasRole('LECTURER')")
  @GetMapping
  public FaceUpdateRequestListResponse getRequests(
      @RequestParam(required = false) FaceUpdateRequestStatus status,
      @RequestParam(required = false) Long classId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size
  ) {
    return faceUpdateRequestService.getLecturerRequests(userService.requireCurrentUserId(), status, classId, page,
        size);
  }

  @PreAuthorize("hasRole('LECTURER')")
  @GetMapping("/{requestId}")
  public FaceUpdateRequestResponse getRequest(@PathVariable Long requestId) {
    return faceUpdateRequestService.getLecturerRequest(userService.requireCurrentUserId(), requestId);
  }

  @PreAuthorize("hasRole('LECTURER')")
  @PostMapping("/{requestId}/approve")
  public FaceUpdateRequestResponse approve(@PathVariable Long requestId,
      @RequestBody(required = false) @Valid ReviewFaceUpdateRequest request) {
    return faceUpdateRequestService.approve(userService.requireCurrentUserId(), requestId, request);
  }

  @PreAuthorize("hasRole('LECTURER')")
  @PostMapping("/{requestId}/reject")
  public FaceUpdateRequestResponse reject(@PathVariable Long requestId,
      @RequestBody(required = false) @Valid ReviewFaceUpdateRequest request) {
    return faceUpdateRequestService.reject(userService.requireCurrentUserId(), requestId, request);
  }
}
