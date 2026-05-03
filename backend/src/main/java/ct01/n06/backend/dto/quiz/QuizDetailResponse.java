package ct01.n06.backend.dto.quiz;

import java.time.LocalDateTime;

public record QuizDetailResponse(
    Long id,
    String title,
    String subject,
    String type,
    String examImageUrl,
    Integer totalQuestions,
    Integer timeLimitMinutes,
    LocalDateTime startTime,
    LocalDateTime endTime,
    String status,
    Long remainingSeconds
) {}
