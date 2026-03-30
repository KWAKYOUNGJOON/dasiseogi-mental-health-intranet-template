package com.dasisuhgi.mentalhealth.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record SelectedScaleRequest(
        @NotBlank(message = "척도 코드가 필요합니다.") String scaleCode,
        @Valid @NotEmpty(message = "문항 응답이 필요합니다.") List<AnswerRequest> answers
) {
}
