package com.dasisuhgi.mentalhealth.client.dto;

public record DuplicateCandidateResponse(
        Long id,
        String clientNo,
        String name,
        String birthDate,
        String gender,
        String primaryWorkerName,
        String status
) {
}
