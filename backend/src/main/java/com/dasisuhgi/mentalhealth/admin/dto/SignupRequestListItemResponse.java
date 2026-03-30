package com.dasisuhgi.mentalhealth.admin.dto;

public record SignupRequestListItemResponse(
        Long requestId,
        String requestedAt,
        String name,
        String loginId,
        String phone,
        String positionName,
        String teamName,
        String requestNote,
        String requestStatus
) {
}
