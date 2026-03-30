package com.dasisuhgi.mentalhealth.statistics.dto;

public record PerformedByStatResponse(
        Long userId,
        String userName,
        long sessionCount
) {
}
