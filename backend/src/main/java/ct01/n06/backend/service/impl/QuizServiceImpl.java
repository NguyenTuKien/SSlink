package ct01.n06.backend.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import ct01.n06.backend.dto.quiz.*;
import ct01.n06.backend.entity.*;
import ct01.n06.backend.entity.enums.*;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.*;
import ct01.n06.backend.service.QuizService;
import ct01.n06.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class QuizServiceImpl implements QuizService {

    private final QuizRepository quizRepository;
    private final QuizAnswerKeyRepository answerKeyRepository;
    private final QuizAssignmentRepository assignmentRepository;
    private final QuizAttemptRepository attemptRepository;
    private final ClassRepository classRepository;
    private final StudentRepository studentRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public QuizSummaryResponse createQuiz(String lecturerId, CreateQuizRequest req) {
        validateCreateRequest(req);
        UserEntity creator = userService.requireCurrentUser();

        QuizStatus status = parseStatus(req.status(), QuizStatus.DRAFT);

        QuizEntity quiz = QuizEntity.builder()
                .title(req.title().trim())
                .subject(req.subject())
                .type(QuizType.valueOf(req.type()))
                .examImageUrl(req.examImageUrl().trim())
                .totalQuestions(req.totalQuestions())
                .timeLimitMinutes(req.timeLimitMinutes())
                .maxAttempts(QuizType.EXAM.name().equals(req.type()) ? 1 : null)
                .startTime(req.startTime())
                .endTime(req.endTime())
                .status(status)
                .createdBy(creator)
                .build();

        QuizEntity saved = quizRepository.save(quiz);
        saveAnswerKeys(saved, req.answerKeys());
        saveAssignments(saved, req.classIds(), lecturerId);

        return toSummary(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuizSummaryResponse> getLecturerQuizzes(String lecturerId) {
        return quizRepository.findByCreatedBy_IdOrderByCreatedAtDesc(lecturerId)
                .stream().map(this::toSummary).toList();
    }

    @Override
    @Transactional
    public QuizSummaryResponse updateQuiz(String lecturerId, Long quizId, UpdateQuizRequest req) {
        QuizEntity quiz = requireOwned(lecturerId, quizId);
        if (quiz.getStatus() != QuizStatus.DRAFT) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Chỉ được chỉnh sửa đề ở trạng thái DRAFT.");
        }

        quiz.setTitle(req.title().trim());
        quiz.setSubject(req.subject());
        quiz.setExamImageUrl(req.examImageUrl().trim());
        quiz.setTotalQuestions(req.totalQuestions());
        quiz.setTimeLimitMinutes(req.timeLimitMinutes());
        quiz.setStartTime(req.startTime());
        quiz.setEndTime(req.endTime());
        if (req.status() != null) {
            quiz.setStatus(parseStatus(req.status(), quiz.getStatus()));
        }

        answerKeyRepository.deleteByQuiz_Id(quizId);
        assignmentRepository.deleteByQuiz_Id(quizId);
        answerKeyRepository.flush();
        assignmentRepository.flush();
        
        saveAnswerKeys(quiz, req.answerKeys());
        saveAssignments(quiz, req.classIds(), lecturerId);

        return toSummary(quizRepository.save(quiz));
    }

    @Override
    @Transactional
    public void deleteQuiz(String lecturerId, Long quizId) {
        QuizEntity quiz = requireOwned(lecturerId, quizId);
        quizRepository.delete(quiz);
    }

    @Override
    @Transactional
    public QuizSummaryResponse publishQuiz(String lecturerId, Long quizId) {
        QuizEntity quiz = requireOwned(lecturerId, quizId);
        quiz.setStatus(QuizStatus.PUBLISHED);
        return toSummary(quizRepository.save(quiz));
    }

    @Override
    @Transactional
    public QuizSummaryResponse closeQuiz(String lecturerId, Long quizId) {
        QuizEntity quiz = requireOwned(lecturerId, quizId);
        quiz.setStatus(QuizStatus.CLOSED);
        return toSummary(quizRepository.save(quiz));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExamResultRowResponse> getExamResults(String lecturerId, Long quizId) {
        QuizEntity quiz = requireOwned(lecturerId, quizId);
        if (quiz.getType() != QuizType.EXAM) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Chỉ đề EXAM mới có bảng điểm.");
        }

        List<QuizAnswerKeyEntity> keys = answerKeyRepository
                .findByQuiz_IdOrderByQuestionNumberAsc(quizId);
        Map<Integer, String> answerMap = toAnswerMap(keys);

        return attemptRepository
                .findByQuiz_IdAndStatusOrderByEndTimeDesc(quizId, AttemptStatus.COMPLETED)
                .stream()
                .map(att -> toExamRow(att, answerMap, quiz.getTotalQuestions()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public StudentQuizListResponse getStudentQuizzes(String studentId) {
        StudentEntity student = requireStudent(studentId);
        if (student.getClassEntity() == null) {
            return new StudentQuizListResponse(List.of(), List.of());
        }
        Long classId = student.getClassEntity().getId();
        List<QuizEntity> quizzes = quizRepository
                .findPublishedQuizzesByClassId(classId, QuizStatus.PUBLISHED);

        LocalDateTime now = LocalDateTime.now();
        List<StudentQuizListResponse.StudentQuizItem> active = new ArrayList<>();
        List<StudentQuizListResponse.StudentQuizItem> closed = new ArrayList<>();

        for (QuizEntity q : quizzes) {
            long attemptCount = attemptRepository.countByQuiz_IdAndStudent_Id(q.getId(), studentId);
            Optional<QuizAttemptEntity> lastCompleted =
                    attemptRepository.findFirstByQuiz_IdAndStudent_IdAndStatusOrderByStartTimeDesc(
                            q.getId(), studentId, AttemptStatus.COMPLETED);

            boolean withinWindow = q.getStartTime() != null && !now.isBefore(q.getStartTime())
                    && (q.getEndTime() == null || now.isBefore(q.getEndTime()));
            boolean underMaxAttempts = q.getMaxAttempts() == null
                    || attemptCount < q.getMaxAttempts();
            boolean canAttempt = withinWindow && underMaxAttempts;
            boolean hasResult = lastCompleted.isPresent();
            boolean isExpired = q.getEndTime() != null && now.isAfter(q.getEndTime());

            StudentQuizListResponse.StudentQuizItem item = new StudentQuizListResponse.StudentQuizItem(
                    q.getId(), q.getTitle(), q.getSubject(),
                    q.getType().name(),
                    q.getTotalQuestions(), q.getTimeLimitMinutes(),
                    q.getStartTime(), q.getEndTime(),
                    q.getStatus().name(),
                    lastCompleted.map(a -> a.getStatus().name()).orElse(null),
                    lastCompleted.map(QuizAttemptEntity::getScore).orElse(null),
                    canAttempt, hasResult
            );

            if (isExpired || !underMaxAttempts) {
                closed.add(item);
            } else {
                active.add(item);
            }
        }
        return new StudentQuizListResponse(active, closed);
    }

    @Override
    @Transactional(readOnly = true)
    public QuizDetailResponse getQuizDetail(String studentId, Long quizId) {
        QuizEntity quiz = requireAccessibleToStudent(studentId, quizId);
        Long remaining = computeRemainingSeconds(quiz);
        return new QuizDetailResponse(
                quiz.getId(), quiz.getTitle(), quiz.getSubject(),
                quiz.getType().name(), quiz.getExamImageUrl(),
                quiz.getTotalQuestions(), quiz.getTimeLimitMinutes(),
                quiz.getStartTime(), quiz.getEndTime(),
                quiz.getStatus().name(), remaining
        );
    }

    @Override
    @Transactional
    public QuizAttemptResponse startOrResumeAttempt(String studentId, Long quizId) {
        QuizEntity quiz = requireAccessibleToStudent(studentId, quizId);
        LocalDateTime now = LocalDateTime.now();

        if (quiz.getStartTime() != null && now.isBefore(quiz.getStartTime())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Đề thi chưa đến giờ mở.");
        }
        if (quiz.getEndTime() != null && now.isAfter(quiz.getEndTime())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Đề thi đã hết thời gian.");
        }

        Optional<QuizAttemptEntity> inProgress =
                attemptRepository.findFirstByQuiz_IdAndStudent_IdAndStatusOrderByStartTimeDesc(
                        quizId, studentId, AttemptStatus.IN_PROGRESS);
        if (inProgress.isPresent()) {
            return toAttemptResponse(inProgress.get());
        }

        long count = attemptRepository.countByQuiz_IdAndStudent_Id(quizId, studentId);
        if (quiz.getMaxAttempts() != null && count >= quiz.getMaxAttempts()) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Bạn đã hết số lần làm bài cho phép.");
        }

        StudentEntity student = requireStudent(studentId);
        QuizAttemptEntity attempt = QuizAttemptEntity.builder()
                .quiz(quiz)
                .student(student)
                .startTime(now)
                .status(AttemptStatus.IN_PROGRESS)
                .studentAnswers(new HashMap<>())
                .build();
        return toAttemptResponse(attemptRepository.save(attempt));
    }

    @Override
    @Transactional
    public QuizAttemptResponse saveAnswer(String studentId, Long quizId, Long attemptId,
            SaveAnswerRequest req) {
        QuizAttemptEntity attempt = requireAttemptOwner(attemptId, studentId);
        if (attempt.getStatus() == AttemptStatus.COMPLETED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Bài thi đã nộp, không thể sửa đáp án.");
        }

        Map<String, String> answers = attempt.getStudentAnswers();
        if (answers == null) {
            answers = new HashMap<>();
            attempt.setStudentAnswers(answers);
        }
        
        String key = String.valueOf(req.questionNumber());
        if (req.selectedOption() == null || req.selectedOption().isBlank()) {
            answers.remove(key);
        } else {
            answers.put(key, req.selectedOption());
        }
        
        return toAttemptResponse(attemptRepository.save(attempt));
    }

    @Override
    @Transactional
    public AttemptResultResponse submitAttempt(String studentId, Long quizId, Long attemptId) {
        QuizAttemptEntity attempt = requireAttemptOwner(attemptId, studentId);
        if (attempt.getStatus() == AttemptStatus.COMPLETED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Bài thi đã được nộp trước đó.");
        }

        QuizEntity quiz = attempt.getQuiz();
        List<QuizAnswerKeyEntity> keys = answerKeyRepository
                .findByQuiz_IdOrderByQuestionNumberAsc(quiz.getId());
        Map<Integer, String> answerMap = toAnswerMap(keys);
        Map<String, String> studentAnswers = attempt.getStudentAnswers() != null ? attempt.getStudentAnswers() : new HashMap<>();

        int correct = countCorrect(studentAnswers, answerMap, quiz.getTotalQuestions());
        BigDecimal score = BigDecimal.valueOf(correct)
                .multiply(BigDecimal.TEN)
                .divide(BigDecimal.valueOf(quiz.getTotalQuestions()), 2, RoundingMode.HALF_UP);

        attempt.setEndTime(LocalDateTime.now());
        attempt.setStatus(AttemptStatus.COMPLETED);
        attempt.setScore(score);
        attemptRepository.save(attempt);

        return buildResult(attempt, quiz, answerMap, studentAnswers, correct, true);
    }

    @Override
    @Transactional(readOnly = true)
    public AttemptResultResponse getAttemptResult(String studentId, Long quizId) {
        QuizEntity quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi."));

        QuizAttemptEntity attempt = attemptRepository
                .findFirstByQuiz_IdAndStudent_IdAndStatusOrderByEndTimeDesc(
                        quizId, studentId, AttemptStatus.COMPLETED)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Bạn chưa nộp bài cho đề thi này."));

        List<QuizAnswerKeyEntity> keys = answerKeyRepository
                .findByQuiz_IdOrderByQuestionNumberAsc(quizId);
        Map<Integer, String> answerMap = toAnswerMap(keys);
        Map<String, String> studentAnswers = attempt.getStudentAnswers() != null ? attempt.getStudentAnswers() : new HashMap<>();
        int correct = countCorrect(studentAnswers, answerMap, quiz.getTotalQuestions());

        boolean showDetail = quiz.getType() == QuizType.PRACTICE
                || quiz.getEndTime() == null
                || LocalDateTime.now().isAfter(quiz.getEndTime());

        return buildResult(attempt, quiz, answerMap, studentAnswers, correct, showDetail);
    }

    private void validateCreateRequest(CreateQuizRequest req) {
        if (req.answerKeys().size() != req.totalQuestions()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Số đáp án (" + req.answerKeys().size()
                    + ") phải bằng tổng số câu hỏi (" + req.totalQuestions() + ").");
        }
        if (QuizType.EXAM.name().equals(req.type()) && req.timeLimitMinutes() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Đề EXAM phải có thời gian làm bài (timeLimitMinutes).");
        }
        if (QuizType.EXAM.name().equals(req.type()) && req.endTime() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Đề EXAM phải có thời gian đóng đề (endTime).");
        }
    }

    private void saveAnswerKeys(QuizEntity quiz, List<CreateQuizRequest.AnswerKeyItem> items) {
        List<QuizAnswerKeyEntity> keys = items.stream()
                .map(item -> QuizAnswerKeyEntity.builder()
                        .quiz(quiz)
                        .questionNumber(item.questionNumber())
                        .correctOption(item.correctOption().toUpperCase())
                        .build())
                .toList();
        answerKeyRepository.saveAll(keys);
    }

    private void saveAssignments(QuizEntity quiz, List<Long> classIds, String lecturerId) {
        List<QuizAssignmentEntity> assignments = classIds.stream()
                .map(classId -> {
                    ClassEntity cls = classRepository.findById(classId)
                            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                                    "Không tìm thấy lớp: " + classId));
                    return QuizAssignmentEntity.builder()
                            .quiz(quiz)
                            .classEntity(cls)
                            .build();
                }).toList();
        assignmentRepository.saveAll(assignments);
    }

    private QuizEntity requireOwned(String lecturerId, Long quizId) {
        QuizEntity quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi."));
        if (!quiz.getCreatedBy().getId().equals(lecturerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền thao tác với đề thi này.");
        }
        return quiz;
    }

    private QuizEntity requireAccessibleToStudent(String studentId, Long quizId) {
        StudentEntity student = requireStudent(studentId);
        QuizEntity quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi."));
        if (quiz.getStatus() != QuizStatus.PUBLISHED && quiz.getStatus() != QuizStatus.CLOSED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Đề thi chưa được phát hành.");
        }
        if (student.getClassEntity() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Học sinh chưa có lớp học.");
        }
        boolean assigned = assignmentRepository
                .existsByQuiz_IdAndClassEntity_Id(quizId, student.getClassEntity().getId());
        if (!assigned) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không được giao đề thi này.");
        }
        return quiz;
    }

    private QuizAttemptEntity requireAttemptOwner(Long attemptId, String studentId) {
        QuizAttemptEntity attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy bài làm."));
        if (!attempt.getStudent().getId().equals(studentId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập bài làm này.");
        }
        return attempt;
    }

    private StudentEntity requireStudent(String studentId) {
        return studentRepository.findById(studentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy học sinh."));
    }

    private QuizStatus parseStatus(String raw, QuizStatus defaultVal) {
        if (raw == null || raw.isBlank()) return defaultVal;
        try {
            return QuizStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return defaultVal;
        }
    }

    private Long computeRemainingSeconds(QuizEntity quiz) {
        if (quiz.getEndTime() == null) return null;
        long secs = ChronoUnit.SECONDS.between(LocalDateTime.now(), quiz.getEndTime());
        return secs > 0 ? secs : 0L;
    }

    private Map<Integer, String> toAnswerMap(List<QuizAnswerKeyEntity> keys) {
        return keys.stream()
                .collect(Collectors.toMap(
                        QuizAnswerKeyEntity::getQuestionNumber,
                        QuizAnswerKeyEntity::getCorrectOption));
    }

    private int countCorrect(Map<String, String> studentAnswers,
            Map<Integer, String> answerMap, int total) {
        int correct = 0;
        for (int i = 1; i <= total; i++) {
            String std = studentAnswers.get(String.valueOf(i));
            String ans = answerMap.get(i);
            if (std != null && std.equalsIgnoreCase(ans)) correct++;
        }
        return correct;
    }


    private AttemptResultResponse buildResult(QuizAttemptEntity attempt, QuizEntity quiz,
            Map<Integer, String> answerMap, Map<String, String> studentAnswers,
            int correct, boolean showDetail) {

        List<AttemptResultResponse.QuestionResult> details = null;
        if (showDetail) {
            details = new ArrayList<>();
            for (int i = 1; i <= quiz.getTotalQuestions(); i++) {
                String std = studentAnswers.get(String.valueOf(i));
                String ans = answerMap.get(i);
                details.add(new AttemptResultResponse.QuestionResult(
                        i, std, ans,
                        std != null && std.equalsIgnoreCase(ans)));
            }
        }

        return new AttemptResultResponse(
                attempt.getId(), quiz.getId(), quiz.getType().name(),
                attempt.getScore(), quiz.getTotalQuestions(),
                showDetail ? correct : null,
                attempt.getEndTime(), details
        );
    }

    private QuizSummaryResponse toSummary(QuizEntity quiz) {
        List<QuizSummaryResponse.AssignedClassInfo> classes = quiz.getAssignments().stream()
                .map(a -> new QuizSummaryResponse.AssignedClassInfo(
                        a.getClassEntity().getId(),
                        a.getClassEntity().getClassCode()))
                .toList();

        return new QuizSummaryResponse(
                quiz.getId(), quiz.getTitle(), quiz.getSubject(),
                quiz.getType().name(), quiz.getExamImageUrl(),
                quiz.getTotalQuestions(), quiz.getTimeLimitMinutes(),
                quiz.getStartTime(), quiz.getEndTime(),
                quiz.getStatus().name(),
                quiz.getCreatedBy() != null ? quiz.getCreatedBy().getUsername() : null,
                classes
        );
    }

    private QuizAttemptResponse toAttemptResponse(QuizAttemptEntity attempt) {
        Map<String, String> saved = attempt.getStudentAnswers() != null ? attempt.getStudentAnswers() : new HashMap<>();
        return new QuizAttemptResponse(
                attempt.getId(), attempt.getQuiz().getId(),
                attempt.getStatus().name(),
                attempt.getStartTime(), attempt.getEndTime(),
                saved
        );
    }

    private ExamResultRowResponse toExamRow(QuizAttemptEntity att,
            Map<Integer, String> answerMap, int total) {
        Map<String, String> studentAnswers = att.getStudentAnswers() != null ? att.getStudentAnswers() : new HashMap<>();
        int correct = countCorrect(studentAnswers, answerMap, total);
        StudentEntity s = att.getStudent();
        String className = s.getClassEntity() != null
                ? s.getClassEntity().getClassCode() : "";
        return new ExamResultRowResponse(
                s.getId(), s.getStudentCode(), s.getFullName(),
                className, att.getScore(), correct, total,
                att.getEndTime(), att.getStatus().name()
        );
    }
}
