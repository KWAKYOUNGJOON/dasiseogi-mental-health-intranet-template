package com.dasisuhgi.mentalhealth.statistics.dto;

import java.time.LocalDate;
import java.util.List;

public record StatisticsSummaryResponse(
        LocalDate dateFrom,
        LocalDate dateTo,
        long totalSessionCount,
        long totalScaleCount,
        long alertSessionCount,
        long alertScaleCount,
        List<PerformedByStatResponse> performedByStats
) {
}
