package com.dasisuhgi.mentalhealth.admin.dto;

public record AdminUserListItemResponse(
        Long userId,
        String name,
        String loginId,
        String phone,
        String role,
        String status,
        String approvedAt,
        String lastLoginAt
) {
}
