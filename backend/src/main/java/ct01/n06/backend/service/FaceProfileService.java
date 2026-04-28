package ct01.n06.backend.service;

import ct01.n06.backend.dto.face.FaceProfileResponse;
import ct01.n06.backend.dto.face.FaceProfileStatusResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestListResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestResponse;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
import org.springframework.web.multipart.MultipartFile;

public interface FaceProfileService {

  FaceProfileStatusResponse getStatus(String userId);

  FaceProfileResponse enroll(String userId, MultipartFile image, boolean confirmRealImage);

  FaceUpdateRequestResponse createUpdateRequest(String userId, MultipartFile image, String reason,
      boolean confirmRealImage);

  FaceUpdateRequestListResponse getStudentUpdateRequests(String userId, FaceUpdateRequestStatus status,
      int page, int size);
}
