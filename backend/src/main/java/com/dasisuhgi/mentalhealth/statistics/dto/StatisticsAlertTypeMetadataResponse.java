package com.dasisuhgi.mentalhealth.statistics.dto;

import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;

public record StatisticsAlertTypeMetadataResponse(
        AlertType code,
        String label
) {
}
