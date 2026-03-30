package com.dasisuhgi.mentalhealth.assessment.dto;

import java.util.List;

public record AssessmentSessionDetailResponse(
        Long id,
        String sessionNo,
        String status,
        String sessionDate,
        String sessionStartedAt,
        String sessionCompletedAt,
        Long performedById,
        String performedByName,
        Long clientId,
        String clientNo,
        String clientName,
        String clientBirthDate,
        String clientGender,
        String memo,
        String misenteredAt,
        Long misenteredById,
        String misenteredByName,
        String misenteredReason,
        boolean hasAlert,
        List<SessionScaleResponse> scales,
        List<SessionAlertResponse> alerts
) {
}
