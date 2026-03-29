package com.dasisuhgi.mentalhealth.client.dto;

import java.util.List;

public record ClientDetailResponse(
        Long id,
        String clientNo,
        String name,
        String gender,
        String birthDate,
        String phone,
        String registeredAt,
        Long primaryWorkerId,
        String primaryWorkerName,
        String status,
        List<RecentSessionSummaryResponse> recentSessions
) {
}
