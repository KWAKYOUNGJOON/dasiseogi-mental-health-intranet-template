package com.dasisuhgi.mentalhealth.scale.registry;

public record ScaleRegistryItem(
        String scaleCode,
        String scaleName,
        int displayOrder,
        boolean isActive,
        boolean implemented,
        String definitionFile
) {
}
