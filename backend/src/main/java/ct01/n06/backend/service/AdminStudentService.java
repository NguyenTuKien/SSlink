package ct01.n06.backend.service;

import ct01.n06.backend.dto.admin.AdminStudentCreateRequest;
import ct01.n06.backend.dto.admin.AdminStudentListResponse;
import ct01.n06.backend.dto.admin.AdminStudentOptionsResponse;
import ct01.n06.backend.dto.admin.AdminStudentRowResponse;
import ct01.n06.backend.dto.admin.AdminStudentStatsResponse;
import ct01.n06.backend.dto.admin.AdminStudentUpdateRequest;
public interface AdminStudentService {

  AdminStudentOptionsResponse getOptions();

  AdminStudentListResponse getStudents(Long facultyId, Long classId, String status, String keyword);

  AdminStudentStatsResponse getStats();

  AdminStudentRowResponse createStudent(AdminStudentCreateRequest request);

  AdminStudentRowResponse updateStudent(String studentId, AdminStudentUpdateRequest request);

  void deleteStudent(String studentId);


  byte[] exportStudentsExcel();
}
