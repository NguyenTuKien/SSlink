package ct01.n06.backend.dto.quiz;

import java.math.BigDecimal;
import java.time.LocalDateTime;


public record ExamResultRowResponse(
    String studentId,
    String studentCode,
    String fullName,
    String className,
    BigDecimal score,
    Integer correctCount,
    Integer totalQuestions,
    LocalDateTime submittedAt,
    String attemptStatus
) {}
