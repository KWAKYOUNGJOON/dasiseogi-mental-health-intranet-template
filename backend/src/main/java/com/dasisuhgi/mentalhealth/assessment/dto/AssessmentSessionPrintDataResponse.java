package com.dasisuhgi.mentalhealth.assessment.dto;

import java.util.List;

public record AssessmentSessionPrintDataResponse(
        String institutionName,
        String teamName,
        String performedByName,
        String sessionNo,
        String sessionStartedAt,
        String sessionCompletedAt,
        AssessmentSessionPrintClientResponse client,
        List<AssessmentSessionPrintScaleResponse> scales,
        boolean hasAlert,
        int scaleCount,
        int alertCount,
        String summaryText
) {
}
