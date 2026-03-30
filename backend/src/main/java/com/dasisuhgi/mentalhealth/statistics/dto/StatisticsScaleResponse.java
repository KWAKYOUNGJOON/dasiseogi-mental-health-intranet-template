package com.dasisuhgi.mentalhealth.statistics.dto;

import java.time.LocalDate;
import java.util.List;

public record StatisticsScaleResponse(
        LocalDate dateFrom,
        LocalDate dateTo,
        List<StatisticsScaleItemResponse> items
) {
}
