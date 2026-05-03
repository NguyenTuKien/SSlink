package ct01.n06.backend.dto.quiz;

import java.time.LocalDateTime;
import java.util.List;

public record QuizSummaryResponse(
    Long id,
    String title,
    String subject,
    String type,             // "PRACTICE" | "EXAM"
    String examImageUrl,
    Integer totalQuestions,
    Integer timeLimitMinutes,
    LocalDateTime startTime,
    LocalDateTime endTime,
    String status,           // "DRAFT" | "PUBLISHED" | "CLOSED"
    String createdByName,
    List<AssignedClassInfo> assignedClasses
) {

  public record AssignedClassInfo(Long classId, String classCode) {}
}
