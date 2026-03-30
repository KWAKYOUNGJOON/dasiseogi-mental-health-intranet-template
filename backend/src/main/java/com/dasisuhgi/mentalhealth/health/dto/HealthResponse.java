package com.dasisuhgi.mentalhealth.health.dto;

public record HealthResponse(
        String status,
        String appStatus,
        String dbStatus,
        String scaleRegistryStatus,
        int loadedScaleCount
) {
}
