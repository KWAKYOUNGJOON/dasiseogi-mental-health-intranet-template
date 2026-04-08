package com.dasisuhgi.mentalhealth.scale.registry;

public record ScaleRegistryItem(
        String scaleCode,
        String scaleName,
        String selectionTitle,
        String selectionSubtitle,
        int displayOrder,
        boolean isActive,
        boolean implemented,
        String definitionFile
) {
}
