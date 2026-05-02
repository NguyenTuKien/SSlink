package ct01.n06.backend.controller;

import ct01.n06.backend.dto.common.SimpleMessageResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentListResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentOptionsResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentRowResponse;
import ct01.n06.backend.dto.lecturer.ManualCreateStudentRequest;
import ct01.n06.backend.dto.lecturer.UpdateStudentStatusRequest;
import ct01.n06.backend.service.LecturerService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/lecturer/students")
public class LecturerController {

  private final LecturerService lecturerService;
  private final ct01.n06.backend.service.AsyncExcelImportService asyncExcelImportService;
  private final ct01.n06.backend.service.RedisImportTrackerService redisImportTrackerService;

  public LecturerController(
      LecturerService lecturerService,
      ct01.n06.backend.service.AsyncExcelImportService asyncExcelImportService,
      ct01.n06.backend.service.RedisImportTrackerService redisImportTrackerService
  ) {
    this.lecturerService = lecturerService;
    this.asyncExcelImportService = asyncExcelImportService;
    this.redisImportTrackerService = redisImportTrackerService;
  }

  @GetMapping("/options")
  public LecturerStudentOptionsResponse options(@RequestParam String lecturerId) {
    String resolvedLecturerId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
    return lecturerService.getOptions(resolvedLecturerId);
  }

  @GetMapping
  public LecturerStudentListResponse list(
      @RequestParam String lecturerId,
      @RequestParam(required = false) Long facultyId,
      @RequestParam(required = false) Long classId,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword
  ) {
    String resolvedLecturerId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
    return lecturerService.getStudents(resolvedLecturerId, facultyId, classId, status, keyword);
  }

  @PostMapping("/manual")
  public LecturerStudentRowResponse createManual(
      @RequestParam String lecturerId,
      @RequestBody ManualCreateStudentRequest request
  ) {
    String resolvedLecturerId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
    return lecturerService.createManualStudent(resolvedLecturerId, request);
  }

  @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public java.util.Map<String, String> importExcel(
      @RequestParam String lecturerId,
      @RequestParam("file") org.springframework.web.multipart.MultipartFile file
  ) {
    if (file.isEmpty()) {
      throw new ct01.n06.backend.exception.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "File Excel trống.");
    }
    String resolvedLecturerId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);

    try {
      java.io.File tempFile = java.io.File.createTempFile("lecturer_student_import_", ".xlsx");
      file.transferTo(tempFile);

      String batchId = java.util.UUID.randomUUID().toString();
      String username = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();

      ct01.n06.backend.dto.admin.JobStatus jobStatus = new ct01.n06.backend.dto.admin.JobStatus(
          batchId, "QUEUED", 0, 0, username, new java.util.ArrayList<>());
      redisImportTrackerService.initJob(jobStatus);

      asyncExcelImportService.processImport(tempFile, batchId, username, resolvedLecturerId);

      return java.util.Map.of("batchId", batchId);
    } catch (java.io.IOException e) {
      throw new ct01.n06.backend.exception.ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu file tạm.");
    }
  }

  @GetMapping("/import/{batchId}")
  public ct01.n06.backend.dto.admin.JobStatus importStatus(
      @RequestParam String lecturerId,
      @PathVariable String batchId
  ) {
    lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
    String username = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
    ct01.n06.backend.dto.admin.JobStatus status = redisImportTrackerService.getJob(batchId);

    if (status == null) {
      throw new ct01.n06.backend.exception.ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "Không tìm thấy phiên import.");
    }
    if (!status.getUsername().equals(username)) {
      throw new ct01.n06.backend.exception.ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "Không có quyền xem phiên import này.");
    }

    return status;
  }

  @PutMapping("/{studentId}/monitor")
  public LecturerStudentRowResponse assignMonitor(
      @RequestParam String lecturerId,
      @PathVariable String studentId
  ) {
    String resolvedLecturerId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
    return lecturerService.assignMonitor(resolvedLecturerId, studentId);
  }

  @PutMapping("/{studentId}/status")
  public LecturerStudentRowResponse updateStatus(
      @RequestParam String lecturerId,
      @PathVariable String studentId,
      @RequestBody UpdateStudentStatusRequest request
  ) {
    String resolvedLecturerId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
    return lecturerService.updateStudentStatus(resolvedLecturerId, studentId, request.status());
  }

  @DeleteMapping("/{studentId}")
  public SimpleMessageResponse delete(
      @RequestParam String lecturerId,
      @PathVariable String studentId
  ) {
    String resolvedLecturerId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
    return lecturerService.deleteStudent(resolvedLecturerId, studentId);
  }


}

