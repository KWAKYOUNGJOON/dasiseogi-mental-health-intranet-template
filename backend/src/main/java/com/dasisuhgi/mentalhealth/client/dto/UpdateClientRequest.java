package com.dasisuhgi.mentalhealth.client.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record UpdateClientRequest(
        @NotBlank(message = "이름은 필수입니다.") String name,
        @NotBlank(message = "성별은 필수입니다.") String gender,
        @NotNull(message = "생년월일은 필수입니다.") LocalDate birthDate,
        String phone,
        @NotNull(message = "담당자는 필수입니다.") Long primaryWorkerId
) {
}
