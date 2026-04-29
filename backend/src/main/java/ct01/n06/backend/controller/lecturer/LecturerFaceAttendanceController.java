package ct01.n06.backend.controller.lecturer;

import ct01.n06.backend.dto.face.ConfirmFaceAttendanceRequest;
import ct01.n06.backend.dto.face.ConfirmFaceAttendanceResponse;
import ct01.n06.backend.dto.face.CreateFaceAttendanceSessionRequest;
import ct01.n06.backend.dto.face.FaceAttendanceSessionResponse;
import ct01.n06.backend.dto.face.FaceRecognizeResponse;
import ct01.n06.backend.service.FaceAttendanceService;
import ct01.n06.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/v1/lecturer/face-attendance")
@RequiredArgsConstructor
public class LecturerFaceAttendanceController {

  private final FaceAttendanceService faceAttendanceService;
  private final UserService userService;

  @PreAuthorize("hasRole('LECTURER')")
  @PostMapping("/sessions")
  public FaceAttendanceSessionResponse createSession(@RequestBody @Valid CreateFaceAttendanceSessionRequest request) {
    return faceAttendanceService.createSession(userService.requireCurrentUserId(), request);
  }

  @PreAuthorize("hasRole('LECTURER')")
  @PostMapping(value = "/sessions/{sessionId}/recognize", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public FaceRecognizeResponse recognize(@PathVariable Long sessionId,
      @RequestPart("frame") MultipartFile frame) {
    return faceAttendanceService.recognize(userService.requireCurrentUserId(), sessionId, frame);
  }

  @PreAuthorize("hasRole('LECTURER')")
  @PostMapping("/sessions/{sessionId}/confirm")
  public ConfirmFaceAttendanceResponse confirm(@PathVariable Long sessionId,
      @RequestBody @Valid ConfirmFaceAttendanceRequest request) {
    return faceAttendanceService.confirm(userService.requireCurrentUserId(), sessionId, request);
  }

  @PreAuthorize("hasRole('LECTURER')")
  @PostMapping("/sessions/{sessionId}/close")
  public FaceAttendanceSessionResponse close(@PathVariable Long sessionId) {
    return faceAttendanceService.close(userService.requireCurrentUserId(), sessionId);
  }
}
