package com.dasisuhgi.mentalhealth.statistics.dto;

public record StatisticsAlertItemResponse(
        String clientName,
        String sessionCompletedAt,
        String performedByName,
        String scaleCode,
        String scaleName,
        String displayTitle,
        String displaySubtitle,
        String alertType,
        String alertMessage,
        Long sessionId
) {
}
