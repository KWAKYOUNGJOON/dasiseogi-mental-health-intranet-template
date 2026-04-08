package com.dasisuhgi.mentalhealth.statistics.dto;

public record StatisticsScaleItemResponse(
        String scaleCode,
        String scaleName,
        String displayTitle,
        String displaySubtitle,
        long totalCount,
        long alertCount,
        boolean isActive
) {
}
