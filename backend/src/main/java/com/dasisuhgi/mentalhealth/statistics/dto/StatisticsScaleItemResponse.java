package com.dasisuhgi.mentalhealth.statistics.dto;

public record StatisticsScaleItemResponse(
        String scaleCode,
        String scaleName,
        long totalCount,
        long alertCount,
        boolean isActive
) {
}
