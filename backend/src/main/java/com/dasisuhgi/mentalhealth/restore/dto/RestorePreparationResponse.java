package com.dasisuhgi.mentalhealth.restore.dto;

import java.util.List;

public record RestorePreparationResponse(
        Long restoreId,
        String status,
        String confirmationRequiredText,
        String confirmationTextStatus,
        List<RestorePreparationGroupResponse> itemGroups,
        List<String> selectedItemTypes,
        int selectedGroupCount,
        boolean confirmationTextMatched,
        boolean readyToExecute,
        String blockedReason
) {
}
