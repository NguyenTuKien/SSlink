package ct01.n06.backend.dto.quiz;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


public record AttemptResultResponse(
    Long attemptId,
    Long quizId,
    String quizType,
    BigDecimal score,
    Integer totalQuestions,
    Integer correctCount,
    LocalDateTime submittedAt,
    List<QuestionResult> questionDetails
) {

  public record QuestionResult(
      int questionNumber,
      String studentAnswer,
      String correctAnswer,
      boolean isCorrect
  ) {}
}
