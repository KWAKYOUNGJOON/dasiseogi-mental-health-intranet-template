package com.dasisuhgi.mentalhealth.client.dto;

public record ClientStatusChangeResponse(
        Long clientId,
        String status,
        String processedAt
) {
}
