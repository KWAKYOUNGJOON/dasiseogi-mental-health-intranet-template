package com.dasisuhgi.mentalhealth.client.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CreateClientRequest(
        @NotBlank(message = "이름을 입력해주세요.") String name,
        @NotBlank(message = "성별을 입력해주세요.") String gender,
        @NotNull(message = "생년월일을 입력해주세요.") LocalDate birthDate,
        String phone,
        @NotNull(message = "담당자를 선택해주세요.") Long primaryWorkerId
) {
}
