package com.dasisuhgi.mentalhealth.restore.dto;

import java.util.List;

public record RestorePreparationGroupResponse(
        String itemType,
        List<String> relativePaths,
        boolean selectable,
        boolean selected,
        String blockedReason
) {
}
