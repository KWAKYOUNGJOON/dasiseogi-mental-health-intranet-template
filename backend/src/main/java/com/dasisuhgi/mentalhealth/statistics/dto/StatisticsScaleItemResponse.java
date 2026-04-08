package com.dasisuhgi.mentalhealth.statistics.dto;

public record StatisticsScaleItemResponse(
        String scaleCode,
        String scaleName,
        String selectionTitle,
        String selectionSubtitle,
        long totalCount,
        long alertCount,
        boolean isActive
) {
}
