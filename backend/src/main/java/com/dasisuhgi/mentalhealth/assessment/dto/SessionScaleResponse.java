package com.dasisuhgi.mentalhealth.assessment.dto;

import java.util.List;

public record SessionScaleResponse(
        Long sessionScaleId,
        String scaleCode,
        String scaleName,
        int displayOrder,
        int totalScore,
        String resultLevel,
        boolean hasAlert,
        List<SessionScaleResultDetailResponse> resultDetails,
        List<SessionAnswerResponse> answers,
        List<SessionAlertResponse> alerts
) {
}
