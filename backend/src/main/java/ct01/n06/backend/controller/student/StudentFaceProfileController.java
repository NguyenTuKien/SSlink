package ct01.n06.backend.controller.student;

import ct01.n06.backend.dto.face.FaceProfileResponse;
import ct01.n06.backend.dto.face.FaceProfileStatusResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestListResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestResponse;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
import ct01.n06.backend.service.FaceProfileService;
import ct01.n06.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/v1/student/face-profile")
@RequiredArgsConstructor
public class StudentFaceProfileController {

  private final FaceProfileService faceProfileService;
  private final UserService userService;

  @PreAuthorize("hasAnyRole('STUDENT','MONITOR')")
  @GetMapping("/status")
  public FaceProfileStatusResponse getStatus() {
    return faceProfileService.getStatus(userService.requireCurrentUserId());
  }

  @PreAuthorize("hasAnyRole('STUDENT','MONITOR')")
  @PostMapping(value = "/enroll", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public FaceProfileResponse enroll(
      @RequestPart("image") MultipartFile image,
      @RequestParam(defaultValue = "false") boolean confirmRealImage
  ) {
    return faceProfileService.enroll(userService.requireCurrentUserId(), image, confirmRealImage);
  }

  @PreAuthorize("hasAnyRole('STUDENT','MONITOR')")
  @PostMapping(value = "/update-requests", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public FaceUpdateRequestResponse createUpdateRequest(
      @RequestPart("image") MultipartFile image,
      @RequestParam(required = false) String reason,
      @RequestParam(defaultValue = "false") boolean confirmRealImage
  ) {
    return faceProfileService.createUpdateRequest(userService.requireCurrentUserId(), image, reason,
        confirmRealImage);
  }

  @PreAuthorize("hasAnyRole('STUDENT','MONITOR')")
  @GetMapping("/update-requests")
  public FaceUpdateRequestListResponse getUpdateRequests(
      @RequestParam(required = false) FaceUpdateRequestStatus status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size
  ) {
    return faceProfileService.getStudentUpdateRequests(userService.requireCurrentUserId(), status, page, size);
  }
}
