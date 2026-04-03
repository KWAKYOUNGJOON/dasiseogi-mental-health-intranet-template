package com.dasisuhgi.mentalhealth.admin.dto;

public record AdminUserUpdateResponse(
        Long userId,
        String role,
        String status,
        String positionName
) {
}
