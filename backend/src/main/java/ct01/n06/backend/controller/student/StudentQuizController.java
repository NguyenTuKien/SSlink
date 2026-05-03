package ct01.n06.backend.controller.student;

import ct01.n06.backend.dto.quiz.*;
import ct01.n06.backend.dto.ResponseGeneral;
import ct01.n06.backend.service.QuizService;
import ct01.n06.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/v1/student/quizzes")
@RequiredArgsConstructor
public class StudentQuizController {

    private final QuizService quizService;
    private final UserService userService;

    @GetMapping
    public ResponseGeneral<StudentQuizListResponse> list() {
        String studentId = userService.requireCurrentUserId();
        return ResponseGeneral.ofSuccess("Lấy danh sách đề thi thành công.",
                quizService.getStudentQuizzes(studentId));
    }

    @GetMapping("/{quizId}")
    public ResponseGeneral<QuizDetailResponse> detail(@PathVariable Long quizId) {
        String studentId = userService.requireCurrentUserId();
        return ResponseGeneral.ofSuccess("Lấy thông tin đề thi thành công.",
                quizService.getQuizDetail(studentId, quizId));
    }

    @PostMapping("/{quizId}/attempt")
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseGeneral<QuizAttemptResponse> startOrResume(@PathVariable Long quizId) {
        String studentId = userService.requireCurrentUserId();
        return ResponseGeneral.ofCreated("Vào phòng thi thành công.",
                quizService.startOrResumeAttempt(studentId, quizId));
    }

    @PatchMapping("/{quizId}/attempt/{attemptId}/answer")
    public ResponseGeneral<QuizAttemptResponse> saveAnswer(
            @PathVariable Long quizId,
            @PathVariable Long attemptId,
            @Valid @RequestBody SaveAnswerRequest request) {
        String studentId = userService.requireCurrentUserId();
        return ResponseGeneral.ofSuccess("Lưu đáp án thành công.",
                quizService.saveAnswer(studentId, quizId, attemptId, request));
    }


    @PostMapping("/{quizId}/attempt/{attemptId}/submit")
    public ResponseGeneral<AttemptResultResponse> submit(
            @PathVariable Long quizId,
            @PathVariable Long attemptId) {
        String studentId = userService.requireCurrentUserId();
        return ResponseGeneral.ofSuccess("Nộp bài thành công.",
                quizService.submitAttempt(studentId, quizId, attemptId));
    }


    @GetMapping("/{quizId}/result")
    public ResponseGeneral<AttemptResultResponse> result(@PathVariable Long quizId) {
        String studentId = userService.requireCurrentUserId();
        return ResponseGeneral.ofSuccess("Lấy kết quả thành công.",
                quizService.getAttemptResult(studentId, quizId));
    }
}
