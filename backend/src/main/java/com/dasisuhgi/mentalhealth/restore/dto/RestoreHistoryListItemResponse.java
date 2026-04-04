package com.dasisuhgi.mentalhealth.restore.dto;

public record RestoreHistoryListItemResponse(
        Long restoreId,
        String status,
        String fileName,
        Long fileSizeBytes,
        String uploadedAt,
        String validatedAt,
        String uploadedByName,
        String formatVersion,
        String datasourceType,
        Long backupId,
        String failureReason
) {
}
