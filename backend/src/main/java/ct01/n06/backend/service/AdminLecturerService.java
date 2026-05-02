package ct01.n06.backend.service;

import ct01.n06.backend.dto.admin.AdminLecturerCreateRequest;
import ct01.n06.backend.dto.admin.AdminLecturerListResponse;
import ct01.n06.backend.dto.admin.AdminLecturerOptionsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerRowResponse;
import ct01.n06.backend.dto.admin.AdminLecturerStatsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerUpdateRequest;
public interface AdminLecturerService {

  AdminLecturerOptionsResponse getOptions();

  AdminLecturerListResponse getLecturers(Long facultyId, String status, String keyword);

  AdminLecturerStatsResponse getStats();

  AdminLecturerRowResponse createLecturer(AdminLecturerCreateRequest request);

  AdminLecturerRowResponse updateLecturer(String lecturerId, AdminLecturerUpdateRequest request);

  void deleteLecturer(String lecturerId);


  byte[] exportLecturersExcel();
}
