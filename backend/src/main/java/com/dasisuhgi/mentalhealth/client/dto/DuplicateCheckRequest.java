package com.dasisuhgi.mentalhealth.client.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record DuplicateCheckRequest(
        @NotBlank(message = "이름을 입력해주세요.") String name,
        @NotNull(message = "생년월일을 입력해주세요.") LocalDate birthDate
) {
}
