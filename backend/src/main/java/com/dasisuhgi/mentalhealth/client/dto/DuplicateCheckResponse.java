package com.dasisuhgi.mentalhealth.client.dto;

import java.util.List;

public record DuplicateCheckResponse(boolean isDuplicate, List<DuplicateCandidateResponse> candidates) {
}
