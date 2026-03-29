package com.dasisuhgi.mentalhealth.scale.registry;

import java.util.List;

public record ScaleDefinition(
        String scaleCode,
        String scaleName,
        String version,
        int displayOrder,
        boolean isActive,
        int questionCount,
        Integer screeningThreshold,
        String screeningLabel,
        List<ScaleQuestion> items,
        List<InterpretationRule> interpretationRules,
        List<ScaleAlertRule> alertRules
) {
}
