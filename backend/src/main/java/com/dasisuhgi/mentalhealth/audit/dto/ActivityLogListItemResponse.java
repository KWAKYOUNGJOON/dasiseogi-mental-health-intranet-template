package com.dasisuhgi.mentalhealth.audit.dto;

public record ActivityLogListItemResponse(
        Long id,
        Long userId,
        String userNameSnapshot,
        String actionType,
        String targetType,
        Long targetId,
        String targetLabel,
        String description,
        String ipAddress,
        String createdAt
) {
}
