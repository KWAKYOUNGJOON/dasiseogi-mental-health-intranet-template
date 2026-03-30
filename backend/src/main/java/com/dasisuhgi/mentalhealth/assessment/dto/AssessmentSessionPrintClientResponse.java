package com.dasisuhgi.mentalhealth.assessment.dto;

public record AssessmentSessionPrintClientResponse(
        Long clientId,
        String clientNo,
        String name,
        String birthDate,
        String gender
) {
}
