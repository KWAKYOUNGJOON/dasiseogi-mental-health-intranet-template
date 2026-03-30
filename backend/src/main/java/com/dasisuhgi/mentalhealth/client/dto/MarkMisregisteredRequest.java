package com.dasisuhgi.mentalhealth.client.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MarkMisregisteredRequest(
        @NotBlank(message = "오등록 사유를 입력해주세요.")
        @Size(max = 255, message = "오등록 사유는 255자 이하여야 합니다.")
        String reason
) {
}
