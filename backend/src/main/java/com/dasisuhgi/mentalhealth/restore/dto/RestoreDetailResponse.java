package com.dasisuhgi.mentalhealth.restore.dto;

import java.time.LocalDateTime;
import java.util.List;

public record RestoreDetailResponse(
        Long restoreId,
        String status,
        String fileName,
        LocalDateTime uploadedAt,
        LocalDateTime validatedAt,
        LocalDateTime executedAt,
        String uploadedByName,
        String formatVersion,
        String datasourceType,
        Long backupId,
        List<String> selectedItemTypes,
        Long preBackupId,
        String preBackupFileName,
        String failureReason,
        List<RestoreDetectedItemResponse> detectedItems
) {
}
