package ct01.n06.backend.service;

import ct01.n06.backend.dto.common.SimpleMessageResponse;
import ct01.n06.backend.dto.lecturer.LecturerDashboardSummaryResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentListResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentOptionsResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentRowResponse;
import ct01.n06.backend.dto.lecturer.ManualCreateStudentRequest;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.UserEntity;

public interface LecturerService {

  LecturerEntity getLecturerByUsername(String username);

  String ensureLecturerAccessForCurrentUser(String requestedLecturerId);

  LecturerStudentOptionsResponse getOptions(String lecturerId);

  LecturerDashboardSummaryResponse getDashboardSummary();

  LecturerStudentListResponse getStudents(
      String lecturerId,
      Long facultyId,
      Long classId,
      String status,
      String keyword
  );

  LecturerStudentRowResponse createManualStudent(String lecturerId, ManualCreateStudentRequest request);


  LecturerStudentRowResponse assignMonitor(String lecturerId, String studentId);

  LecturerStudentRowResponse updateStudentStatus(String lecturerId, String studentId, String status);

  SimpleMessageResponse deleteStudent(String lecturerId, String studentId);

  LecturerEntity getLecturerByUser(UserEntity userEntity);
}
