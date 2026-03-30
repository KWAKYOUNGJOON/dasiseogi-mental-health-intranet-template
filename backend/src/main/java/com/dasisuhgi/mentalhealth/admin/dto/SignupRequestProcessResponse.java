package com.dasisuhgi.mentalhealth.admin.dto;

public record SignupRequestProcessResponse(
        Long requestId,
        Long userId,
        String requestStatus,
        String userStatus
) {
}
