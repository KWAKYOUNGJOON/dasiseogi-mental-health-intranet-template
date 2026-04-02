package com.dasisuhgi.mentalhealth.client.dto;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import java.time.LocalDateTime;

public record RecentSessionSummaryQueryRow(
        Long id,
        String sessionNo,
        LocalDateTime sessionCompletedAt,
        String performedByName,
        int scaleCount,
        boolean hasAlert,
        AssessmentSessionStatus status
) {
}
