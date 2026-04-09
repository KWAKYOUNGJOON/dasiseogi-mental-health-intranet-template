package com.dasisuhgi.mentalhealth.scale.dto;

import java.util.List;
import java.util.Map;

public record ScaleDefinitionResponse(
        String scaleCode,
        String scaleName,
        int displayOrder,
        int questionCount,
        Integer screeningThreshold,
        List<ScaleQuestionResponse> questions,
        List<InterpretationRuleResponse> interpretationRules,
        List<AlertRuleResponse> alertRules,
        MetadataResponse metadata
) {
    public record InterpretationRuleResponse(
            int min,
            int max,
            String label
    ) {
    }

    public record AlertRuleResponse(
            Integer minTotalScore,
            String message
    ) {
    }

    public record MetadataResponse(
            Map<String, String> resultLevelLabels,
            UiMetadataResponse ui
    ) {
    }

    public record UiMetadataResponse(
            FormNoticeResponse formNotice,
            PreviewResponse preview,
            KmdqMetadataResponse kmdq
    ) {
    }

    public record FormNoticeResponse(
            String title,
            String description
    ) {
    }

    public record PreviewResponse(
            Boolean showResultLevel,
            Boolean showAlertMessages
    ) {
    }

    public record KmdqMetadataResponse(
            Integer impairmentQuestionNo
    ) {
    }
}
