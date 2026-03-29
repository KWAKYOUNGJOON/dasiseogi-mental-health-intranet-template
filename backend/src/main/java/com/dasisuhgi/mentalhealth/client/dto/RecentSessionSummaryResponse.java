package com.dasisuhgi.mentalhealth.client.dto;

public record RecentSessionSummaryResponse(
        Long id,
        String sessionNo,
        String sessionCompletedAt,
        String performedByName,
        int scaleCount,
        boolean hasAlert,
        String status
) {
}
