package com.dasisuhgi.mentalhealth.restore.dto;

import java.util.List;

public record RestoreExecuteRequest(
        List<String> selectedItemTypes,
        String confirmationText
) {
}
