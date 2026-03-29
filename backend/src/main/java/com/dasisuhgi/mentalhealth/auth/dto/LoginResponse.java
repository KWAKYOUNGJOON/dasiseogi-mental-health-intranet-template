package com.dasisuhgi.mentalhealth.auth.dto;

public record LoginResponse(
        AuthUserResponse user,
        int sessionTimeoutMinutes
) {
}
