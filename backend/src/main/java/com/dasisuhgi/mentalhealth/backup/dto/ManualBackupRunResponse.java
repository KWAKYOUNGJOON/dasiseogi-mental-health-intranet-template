package com.dasisuhgi.mentalhealth.backup.dto;

public record ManualBackupRunResponse(
        Long backupId,
        String backupType,
        String backupMethod,
        String datasourceType,
        String preflightSummary,
        String status,
        String fileName,
        String filePath
) {
}
