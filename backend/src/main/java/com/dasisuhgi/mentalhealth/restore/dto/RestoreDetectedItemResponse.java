package com.dasisuhgi.mentalhealth.restore.dto;

import java.util.List;

public record RestoreDetectedItemResponse(
        String itemType,
        List<String> relativePaths
) {
}
