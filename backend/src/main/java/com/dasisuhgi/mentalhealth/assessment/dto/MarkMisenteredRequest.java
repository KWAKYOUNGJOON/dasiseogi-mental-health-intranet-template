package com.dasisuhgi.mentalhealth.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MarkMisenteredRequest(
        @NotBlank(message = "오입력 사유를 입력해주세요.")
        @Size(max = 255, message = "오입력 사유는 255자 이하여야 합니다.")
        String reason
) {
}
