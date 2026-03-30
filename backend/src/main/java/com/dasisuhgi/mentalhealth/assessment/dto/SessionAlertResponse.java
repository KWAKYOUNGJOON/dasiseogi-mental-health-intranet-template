package com.dasisuhgi.mentalhealth.assessment.dto;

public record SessionAlertResponse(
        Long id,
        String scaleCode,
        String alertType,
        String alertCode,
        String alertMessage,
        Integer questionNo,
        String triggerValue
) {
}
