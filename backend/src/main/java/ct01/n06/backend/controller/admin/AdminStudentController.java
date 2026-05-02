package ct01.n06.backend.controller.admin;

import ct01.n06.backend.dto.admin.AdminStudentCreateRequest;
import ct01.n06.backend.dto.admin.AdminStudentListResponse;
import ct01.n06.backend.dto.admin.AdminStudentOptionsResponse;
import ct01.n06.backend.dto.admin.AdminStudentRowResponse;
import ct01.n06.backend.dto.admin.AdminStudentStatsResponse;
import ct01.n06.backend.dto.admin.AdminStudentUpdateRequest;
import ct01.n06.backend.service.AdminStudentService;
import ct01.n06.backend.service.AsyncExcelImportService;
import ct01.n06.backend.service.RedisImportTrackerService;
import ct01.n06.backend.dto.admin.JobStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.context.SecurityContextHolder;
import ct01.n06.backend.exception.ApiException;
import java.io.File;
import java.io.IOException;
import java.util.UUID;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/v1/admin/students")
@RequiredArgsConstructor
public class AdminStudentController {

  private final AdminStudentService adminStudentService;
  private final AsyncExcelImportService asyncExcelImportService;
  private final RedisImportTrackerService redisImportTrackerService;

  @GetMapping("/options")
  public AdminStudentOptionsResponse options() {
    return adminStudentService.getOptions();
  }

  @GetMapping
  public AdminStudentListResponse list(
      @RequestParam(required = false) Long facultyId,
      @RequestParam(required = false) Long classId,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword
  ) {
    return adminStudentService.getStudents(facultyId, classId, status, keyword);
  }

  @GetMapping("/stats")
  public AdminStudentStatsResponse stats() {
    return adminStudentService.getStats();
  }

  @PostMapping
  public AdminStudentRowResponse create(@RequestBody AdminStudentCreateRequest request) {
    return adminStudentService.createStudent(request);
  }

  @PutMapping("/{studentId}")
  public AdminStudentRowResponse update(
      @PathVariable String studentId,
      @RequestBody AdminStudentUpdateRequest request
  ) {
    return adminStudentService.updateStudent(studentId, request);
  }

  @DeleteMapping("/{studentId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String studentId) {
    adminStudentService.deleteStudent(studentId);
  }

  @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAnyRole('ADMIN', 'LECTURER')")
  public Map<String, String> importExcel(@RequestParam("file") MultipartFile file) {
    if (file.isEmpty() || file.getSize() > 10 * 1024 * 1024) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "File không hợp lệ hoặc vượt quá 10MB");
    }
    String contentType = file.getContentType();
    String originalFilename = file.getOriginalFilename();
    boolean isExcel = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(contentType) 
            || "application/vnd.ms-excel".equals(contentType)
            || (originalFilename != null && originalFilename.endsWith(".xlsx"));
            
    if (!isExcel) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Chỉ chấp nhận file Excel (.xlsx)");
    }

    String batchId = UUID.randomUUID().toString();
    String username = SecurityContextHolder.getContext().getAuthentication().getName();

    JobStatus jobStatus = JobStatus.builder()
            .batchId(batchId)
            .status("PENDING")
            .importedCount(0)
            .skippedCount(0)
            .username(username)
            .build();

    redisImportTrackerService.initJob(jobStatus);

    try {
        File tempFile = File.createTempFile("import_" + UUID.randomUUID().toString(), ".xlsx");
        file.transferTo(tempFile);
        asyncExcelImportService.processImport(tempFile, batchId, username, null);
    } catch (IOException e) {
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi lưu file tải lên");
    }

    return Map.of("batchId", batchId);
  }

  @GetMapping("/import/{batchId}/status")
  @PreAuthorize("hasAnyRole('ADMIN', 'LECTURER')")
  public JobStatus importStatus(@PathVariable String batchId) {
    JobStatus jobStatus = redisImportTrackerService.getJob(batchId);
    if (jobStatus == null) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy batch import");
    }
    String username = SecurityContextHolder.getContext().getAuthentication().getName();
    if (!jobStatus.getUsername().equals(username)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem trạng thái này");
    }
    return jobStatus;
  }

  @GetMapping("/export")
  public ResponseEntity<byte[]> exportExcel() {
    byte[] fileBytes = adminStudentService.exportStudentsExcel();
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .header(HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename("admin-danh-sach-sinh-vien.xlsx").build().toString())
        .body(fileBytes);
  }


}
