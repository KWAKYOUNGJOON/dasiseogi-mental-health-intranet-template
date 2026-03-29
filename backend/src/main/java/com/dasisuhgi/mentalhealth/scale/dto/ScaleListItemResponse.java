package com.dasisuhgi.mentalhealth.scale.dto;

public record ScaleListItemResponse(
        String scaleCode,
        String scaleName,
        int displayOrder,
        boolean isActive,
        boolean implemented
) {
}
