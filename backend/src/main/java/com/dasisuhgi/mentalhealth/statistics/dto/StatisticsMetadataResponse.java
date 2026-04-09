package com.dasisuhgi.mentalhealth.statistics.dto;

import java.util.List;

public record StatisticsMetadataResponse(
        List<StatisticsAlertTypeMetadataResponse> alertTypes
) {
}
