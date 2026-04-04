package com.dasisuhgi.mentalhealth.restore.dto;

import java.time.LocalDateTime;
import java.util.List;

public record RestoreUploadResponse(
        Long restoreId,
        String status,
        String fileName,
        LocalDateTime validatedAt,
        String formatVersion,
        String datasourceType,
        Long backupId,
        List<RestoreDetectedItemResponse> detectedItems,
        String failureReason
) {
}
