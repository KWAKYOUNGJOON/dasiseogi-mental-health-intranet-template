package com.dasisuhgi.mentalhealth.assessment.dto;

public record AssessmentRecordListItemResponse(
        Long sessionId,
        Long sessionScaleId,
        String sessionNo,
        String sessionCompletedAt,
        Long clientId,
        String clientName,
        String performedByName,
        String scaleCode,
        String scaleName,
        int totalScore,
        String resultLevel,
        boolean hasAlert,
        String sessionStatus
) {
}
