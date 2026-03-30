package com.dasisuhgi.mentalhealth.assessment.dto;

public record SessionSaveResponse(
        Long sessionId,
        String sessionNo,
        Long clientId,
        String status,
        int scaleCount,
        boolean hasAlert
) {
}
