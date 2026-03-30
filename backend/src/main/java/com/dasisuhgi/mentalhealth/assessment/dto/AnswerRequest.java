package com.dasisuhgi.mentalhealth.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AnswerRequest(
        @NotNull(message = "문항 번호가 필요합니다.") Integer questionNo,
        @NotBlank(message = "응답값이 필요합니다.") String answerValue
) {
}
