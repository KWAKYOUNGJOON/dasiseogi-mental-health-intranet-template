package com.dasisuhgi.mentalhealth.client.dto;

import com.dasisuhgi.mentalhealth.assessment.dto.SessionAlertResponse;
import java.util.List;

public record ClientScaleTrendResponse(
        String scaleCode,
        String scaleName,
        int maxScore,
        List<CutoffResponse> cutoffs,
        List<PointResponse> points
) {
    public record CutoffResponse(
            int score,
            String label
    ) {
    }

    public record PointResponse(
            Long sessionId,
            Long sessionScaleId,
            String assessedAt,
            String createdAt,
            int totalScore,
            String resultLevel,
            List<SessionAlertResponse> alerts
    ) {
    }
}
