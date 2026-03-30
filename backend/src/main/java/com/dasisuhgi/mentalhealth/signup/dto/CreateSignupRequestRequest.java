package com.dasisuhgi.mentalhealth.signup.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateSignupRequestRequest(
        @NotBlank(message = "이름을 입력해주세요.") String name,
        @NotBlank(message = "아이디를 입력해주세요.") String loginId,
        @NotBlank(message = "비밀번호를 입력해주세요.") String password,
        String phone,
        String positionName,
        String teamName,
        String requestMemo
) {
}
