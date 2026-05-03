package ct01.n06.backend.controller.lecturer;

import ct01.n06.backend.dto.quiz.*;
import ct01.n06.backend.dto.ResponseGeneral;
import ct01.n06.backend.service.CloudinaryService;
import ct01.n06.backend.service.LecturerService;
import ct01.n06.backend.service.QuizService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;


@RestController
@RequestMapping("/v1/lecturer/quizzes")
@RequiredArgsConstructor
public class LecturerQuizController {

    private final QuizService quizService;
    private final LecturerService lecturerService;
    private final CloudinaryService cloudinaryService;

    private static final String QUIZ_IMAGE_FOLDER = "quiz-exams";

    @GetMapping
    public ResponseGeneral<List<QuizSummaryResponse>> list(
            @RequestParam String lecturerId) {
        String resolvedId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        return ResponseGeneral.ofSuccess("Lấy danh sách đề thi thành công.",
                quizService.getLecturerQuizzes(resolvedId));
    }


    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseGeneral<QuizSummaryResponse> create(
            @RequestParam String lecturerId,
            @Valid @RequestBody CreateQuizRequest request) {
        String resolvedId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        return ResponseGeneral.ofCreated("Tạo đề thi thành công.",
                quizService.createQuiz(resolvedId, request));
    }


    @PutMapping("/{quizId}")
    public ResponseGeneral<QuizSummaryResponse> update(
            @RequestParam String lecturerId,
            @PathVariable Long quizId,
            @Valid @RequestBody UpdateQuizRequest request) {
        String resolvedId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        return ResponseGeneral.ofSuccess("Cập nhật đề thi thành công.",
                quizService.updateQuiz(resolvedId, quizId, request));
    }


    @DeleteMapping("/{quizId}")
    public ResponseGeneral<Void> delete(
            @RequestParam String lecturerId,
            @PathVariable Long quizId) {
        String resolvedId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        quizService.deleteQuiz(resolvedId, quizId);
        return ResponseGeneral.ofSuccess("Xóa đề thi thành công.", null);
    }

    @PatchMapping("/{quizId}/publish")
    public ResponseGeneral<QuizSummaryResponse> publish(
            @RequestParam String lecturerId,
            @PathVariable Long quizId) {
        String resolvedId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        return ResponseGeneral.ofSuccess("Phát hành đề thi thành công.",
                quizService.publishQuiz(resolvedId, quizId));
    }


    @PatchMapping("/{quizId}/close")
    public ResponseGeneral<QuizSummaryResponse> close(
            @RequestParam String lecturerId,
            @PathVariable Long quizId) {
        String resolvedId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        return ResponseGeneral.ofSuccess("Đóng đề thi thành công.",
                quizService.closeQuiz(resolvedId, quizId));
    }

    @GetMapping("/{quizId}/results")
    public ResponseGeneral<List<ExamResultRowResponse>> results(
            @RequestParam String lecturerId,
            @PathVariable Long quizId) {
        String resolvedId = lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        return ResponseGeneral.ofSuccess("Lấy bảng điểm thành công.",
                quizService.getExamResults(resolvedId, quizId));
    }


    @PostMapping(value = "/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseGeneral<ImageUploadResponse> uploadImage(
            @RequestParam String lecturerId,
            @RequestPart("file") MultipartFile file) {
        lecturerService.ensureLecturerAccessForCurrentUser(lecturerId);
        String url = cloudinaryService.uploadImage(file, QUIZ_IMAGE_FOLDER);
        return ResponseGeneral.ofCreated("Upload ảnh thành công.", new ImageUploadResponse(url));
    }
}
