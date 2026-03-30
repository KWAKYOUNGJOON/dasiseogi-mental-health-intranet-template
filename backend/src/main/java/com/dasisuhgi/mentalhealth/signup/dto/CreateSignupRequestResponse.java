package com.dasisuhgi.mentalhealth.signup.dto;

public record CreateSignupRequestResponse(
        Long requestId,
        Long userId,
        String requestStatus
) {
}
