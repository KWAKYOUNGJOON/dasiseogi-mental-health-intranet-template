package com.dasisuhgi.mentalhealth.client.dto;

public record ClientListItemResponse(
        Long id,
        String clientNo,
        String name,
        String birthDate,
        String gender,
        String primaryWorkerName,
        String latestSessionDate,
        String status
) {
}
