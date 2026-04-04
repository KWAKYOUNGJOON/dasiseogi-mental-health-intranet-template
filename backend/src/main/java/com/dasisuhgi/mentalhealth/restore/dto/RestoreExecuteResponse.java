package com.dasisuhgi.mentalhealth.restore.dto;

import java.time.LocalDateTime;
import java.util.List;

public record RestoreExecuteResponse(
        Long restoreId,
        String status,
        LocalDateTime executedAt,
        List<String> selectedItemTypes,
        Long preBackupId,
        String preBackupFileName,
        String message,
        String failureReason
) {
}
