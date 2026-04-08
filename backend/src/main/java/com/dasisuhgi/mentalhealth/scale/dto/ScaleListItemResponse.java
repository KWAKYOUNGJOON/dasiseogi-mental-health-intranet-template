package com.dasisuhgi.mentalhealth.scale.dto;

public record ScaleListItemResponse(
        String scaleCode,
        String scaleName,
        String selectionTitle,
        String selectionSubtitle,
        int displayOrder,
        boolean isActive,
        boolean implemented
) {
}
