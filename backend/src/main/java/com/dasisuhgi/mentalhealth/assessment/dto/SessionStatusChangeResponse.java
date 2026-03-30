package com.dasisuhgi.mentalhealth.assessment.dto;

public record SessionStatusChangeResponse(
        Long sessionId,
        String status,
        String misenteredAt
) {
}
