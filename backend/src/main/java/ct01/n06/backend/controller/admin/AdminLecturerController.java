package ct01.n06.backend.controller.admin;

import org.springframework.http.HttpStatus;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestController;

import ct01.n06.backend.dto.admin.AdminLecturerCreateRequest;
import ct01.n06.backend.dto.admin.AdminLecturerListResponse;
import ct01.n06.backend.dto.admin.AdminLecturerOptionsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerRowResponse;
import ct01.n06.backend.dto.admin.AdminLecturerStatsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerUpdateRequest;
import ct01.n06.backend.service.AdminLecturerService;
import lombok.RequiredArgsConstructor;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/v1/admin/lecturers")
@RequiredArgsConstructor
public class AdminLecturerController {

  private final AdminLecturerService adminLecturerService;
  private final ct01.n06.backend.service.AsyncLecturerExcelImportService asyncLecturerExcelImportService;
  private final ct01.n06.backend.service.RedisImportTrackerService redisImportTrackerService;

  @GetMapping("/options")
  public AdminLecturerOptionsResponse options() {
    return adminLecturerService.getOptions();
  }

  @GetMapping
  public AdminLecturerListResponse list(
      @RequestParam(required = false) Long facultyId,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword
  ) {
    return adminLecturerService.getLecturers(facultyId, status, keyword);
  }

  @GetMapping("/stats")
  public AdminLecturerStatsResponse stats() {
    return adminLecturerService.getStats();
  }

  @PostMapping
  public AdminLecturerRowResponse create(@RequestBody AdminLecturerCreateRequest request) {
    return adminLecturerService.createLecturer(request);
  }

  @PutMapping("/{lecturerId}")
  public AdminLecturerRowResponse update(
      @PathVariable String lecturerId,
      @RequestBody AdminLecturerUpdateRequest request
  ) {
    return adminLecturerService.updateLecturer(lecturerId, request);
  }

  @DeleteMapping("/{lecturerId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String lecturerId) {
    adminLecturerService.deleteLecturer(lecturerId);
  }

  @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public java.util.Map<String, String> importExcel(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
    if (file.isEmpty()) {
      throw new ct01.n06.backend.exception.ApiException(HttpStatus.BAD_REQUEST, "File Excel trống.");
    }

    try {
      java.io.File tempFile = java.io.File.createTempFile("lecturer_import_", ".xlsx");
      file.transferTo(tempFile);

      String batchId = java.util.UUID.randomUUID().toString();
      String username = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();

      ct01.n06.backend.dto.admin.JobStatus jobStatus = new ct01.n06.backend.dto.admin.JobStatus(
          batchId, "QUEUED", 0, 0, username, new java.util.ArrayList<>());
      redisImportTrackerService.initJob(jobStatus);

      asyncLecturerExcelImportService.processImport(tempFile, batchId, username);

      return java.util.Map.of("batchId", batchId);
    } catch (java.io.IOException e) {
      throw new ct01.n06.backend.exception.ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu file tạm.");
    }
  }

  @GetMapping("/import/{batchId}")
  public ct01.n06.backend.dto.admin.JobStatus importStatus(@PathVariable String batchId) {
    String username = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
    ct01.n06.backend.dto.admin.JobStatus status = redisImportTrackerService.getJob(batchId);

    if (status == null) {
      throw new ct01.n06.backend.exception.ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy phiên import.");
    }
    if (!status.getUsername().equals(username)) {
      throw new ct01.n06.backend.exception.ApiException(HttpStatus.FORBIDDEN, "Không có quyền xem phiên import này.");
    }

    return status;
  }

  @GetMapping("/export")
  public ResponseEntity<byte[]> exportExcel() {
    byte[] fileBytes = adminLecturerService.exportLecturersExcel();
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .header(HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename("admin-danh-sach-giang-vien.xlsx").build().toString())
        .body(fileBytes);
  }
}
