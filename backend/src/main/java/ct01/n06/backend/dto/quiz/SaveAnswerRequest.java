package ct01.n06.backend.dto.quiz;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Auto-save một câu trả lời trong khi đang làm bài.
 */
public record SaveAnswerRequest(

    @NotNull(message = "Số thứ tự câu hỏi là bắt buộc.")
    Integer questionNumber,

    @Pattern(regexp = "[ABCD]", message = "Đáp án phải là A, B, C hoặc D.")
    String selectedOption
) {}
