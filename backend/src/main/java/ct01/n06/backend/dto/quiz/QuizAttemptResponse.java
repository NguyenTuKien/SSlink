package ct01.n06.backend.dto.quiz;

import java.time.LocalDateTime;
import java.util.Map;

public record QuizAttemptResponse(
    Long attemptId,
    Long quizId,
    String status,           // "IN_PROGRESS" | "COMPLETED"
    LocalDateTime startTime,
    LocalDateTime endTime,
    Map<String, String> savedAnswers
) {}
