package com.dasisuhgi.mentalhealth.assessment.dto;

import java.util.List;

public record AssessmentSessionPrintScaleResponse(
        String scaleCode,
        String scaleName,
        int totalScore,
        String resultLevel,
        List<SessionScaleResultDetailResponse> resultDetails,
        List<String> alertMessages
) {
}
