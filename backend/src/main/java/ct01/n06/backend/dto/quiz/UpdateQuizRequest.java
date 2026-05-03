package ct01.n06.backend.dto.quiz;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public record UpdateQuizRequest(

    @NotBlank(message = "Tên đề thi không được để trống.")
    @Size(max = 255)
    String title,

    @Size(max = 100)
    String subject,

    @NotBlank
    @Size(max = 500)
    String examImageUrl,

    @NotNull
    @Min(1)
    Integer totalQuestions,

    Integer timeLimitMinutes,

    LocalDateTime startTime,

    LocalDateTime endTime,

    @NotEmpty
    @Valid
    List<CreateQuizRequest.AnswerKeyItem> answerKeys,

    @NotEmpty
    List<Long> classIds,

    String status
) {}
