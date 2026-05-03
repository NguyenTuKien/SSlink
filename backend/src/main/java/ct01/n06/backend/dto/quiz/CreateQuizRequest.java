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

public record CreateQuizRequest(

    @NotBlank(message = "Tên đề thi không được để trống.")
    @Size(max = 255, message = "Tên đề thi không vượt quá 255 ký tự.")
    String title,

    @Size(max = 100, message = "Môn học không vượt quá 100 ký tự.")
    String subject,

    @NotBlank(message = "Loại đề không được để trống (PRACTICE hoặc EXAM).")
    @Pattern(regexp = "PRACTICE|EXAM", message = "Loại đề phải là PRACTICE hoặc EXAM.")
    String type,

    @NotBlank(message = "URL ảnh đề thi không được để trống.")
    @Size(max = 500, message = "URL ảnh không vượt quá 500 ký tự.")
    String examImageUrl,

    @NotNull(message = "Tổng số câu hỏi là bắt buộc.")
    @Min(value = 1, message = "Phải có ít nhất 1 câu hỏi.")
    Integer totalQuestions,

    Integer timeLimitMinutes,

    @NotNull(message = "Thời gian mở đề là bắt buộc.")
    LocalDateTime startTime,

    LocalDateTime endTime,

    @NotEmpty(message = "Phải nhập đáp án cho tất cả các câu.")
    @Valid
    List<AnswerKeyItem> answerKeys,

    @NotEmpty(message = "Phải chọn ít nhất một lớp được giao đề.")
    List<Long> classIds,


    String status
) {

  public record AnswerKeyItem(
      @NotNull(message = "Số thứ tự câu hỏi là bắt buộc.")
      @Min(value = 1)
      Integer questionNumber,

      @NotBlank(message = "Đáp án không được để trống.")
      @Pattern(regexp = "[ABCD]", message = "Đáp án phải là A, B, C hoặc D.")
      String correctOption
  ) {}
}
