package com.dasisuhgi.mentalhealth.backup.dto;

public record BackupHistoryListItemResponse(
        Long backupId,
        String backupType,
        String backupMethod,
        String status,
        String fileName,
        String filePath,
        Long fileSizeBytes,
        String startedAt,
        String completedAt,
        String executedByName,
        String failureReason
) {
}
