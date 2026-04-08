package com.dasisuhgi.mentalhealth.scale.dto;

import java.util.List;

public record ScaleDefinitionResponse(
        String scaleCode,
        String scaleName,
        int displayOrder,
        int questionCount,
        Integer screeningThreshold,
        List<ScaleQuestionResponse> questions,
        List<InterpretationRuleResponse> interpretationRules,
        List<AlertRuleResponse> alertRules
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
}
