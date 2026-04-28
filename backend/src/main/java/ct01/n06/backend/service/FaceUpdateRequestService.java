package ct01.n06.backend.service;

import ct01.n06.backend.dto.face.FaceUpdateRequestListResponse;
import ct01.n06.backend.dto.face.FaceUpdateRequestResponse;
import ct01.n06.backend.dto.face.ReviewFaceUpdateRequest;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;

public interface FaceUpdateRequestService {

  FaceUpdateRequestListResponse getLecturerRequests(String lecturerUserId, FaceUpdateRequestStatus status,
      Long classId, int page, int size);

  FaceUpdateRequestResponse getLecturerRequest(String lecturerUserId, Long requestId);

  FaceUpdateRequestResponse approve(String lecturerUserId, Long requestId, ReviewFaceUpdateRequest request);

  FaceUpdateRequestResponse reject(String lecturerUserId, Long requestId, ReviewFaceUpdateRequest request);
}
