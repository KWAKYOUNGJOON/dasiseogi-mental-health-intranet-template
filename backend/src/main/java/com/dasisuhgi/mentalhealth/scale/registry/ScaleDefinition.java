package com.dasisuhgi.mentalhealth.scale.registry;

import java.util.List;
import java.util.Map;

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
        List<ScaleAlertRule> alertRules,
        Metadata metadata
) {
    public record Metadata(
            Map<String, String> resultLevelLabels,
            UiMetadata ui
    ) {
    }

    public record UiMetadata(
            FormNotice formNotice,
            Preview preview,
            KmdqMetadata kmdq
    ) {
    }

    public record FormNotice(
            String title,
            String description
    ) {
    }

    public record Preview(
            Boolean showResultLevel,
            Boolean showAlertMessages
    ) {
    }

    public record KmdqMetadata(
            Integer impairmentQuestionNo
    ) {
    }
}
