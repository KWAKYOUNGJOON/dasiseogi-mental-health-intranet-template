package com.dasisuhgi.mentalhealth.auth.dto;

public record AuthUserResponse(
        Long id,
        String loginId,
        String name,
        String phone,
        String positionName,
        String teamName,
        String role,
        String status
) {
}
