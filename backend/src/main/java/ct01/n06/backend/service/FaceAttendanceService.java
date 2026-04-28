package ct01.n06.backend.service;

import ct01.n06.backend.dto.face.ConfirmFaceAttendanceRequest;
import ct01.n06.backend.dto.face.ConfirmFaceAttendanceResponse;
import ct01.n06.backend.dto.face.CreateFaceAttendanceSessionRequest;
import ct01.n06.backend.dto.face.FaceAttendanceSessionResponse;
import ct01.n06.backend.dto.face.FaceRecognizeResponse;
import org.springframework.web.multipart.MultipartFile;

public interface FaceAttendanceService {

  FaceAttendanceSessionResponse createSession(String lecturerUserId, CreateFaceAttendanceSessionRequest request);

  FaceRecognizeResponse recognize(String lecturerUserId, Long sessionId, MultipartFile frame);

  ConfirmFaceAttendanceResponse confirm(String lecturerUserId, Long sessionId, ConfirmFaceAttendanceRequest request);

  FaceAttendanceSessionResponse close(String lecturerUserId, Long sessionId);
}
