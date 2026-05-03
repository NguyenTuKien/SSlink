package ct01.n06.backend.dto.quiz;

import java.time.LocalDateTime;
import java.util.List;


public record StudentQuizListResponse(
    List<StudentQuizItem> activeQuizzes,
    List<StudentQuizItem> closedQuizzes
) {

  public record StudentQuizItem(
      Long quizId,
      String title,
      String subject,
      String type,             // "PRACTICE" | "EXAM"
      Integer totalQuestions,
      Integer timeLimitMinutes,
      LocalDateTime startTime,
      LocalDateTime endTime,
      String quizStatus,       // "DRAFT" | "PUBLISHED" | "CLOSED"
      String attemptStatus,    // "IN_PROGRESS" | "COMPLETED"
      java.math.BigDecimal score,
      boolean canAttempt,
      boolean hasResult
  ) {}
}
