package com.dasisuhgi.mentalhealth.scale.dto;

import java.util.List;

public record ScaleDefinitionResponse(
        String scaleCode,
        String scaleName,
        int displayOrder,
        int questionCount,
        Integer screeningThreshold,
        List<ScaleQuestionResponse> questions
) {
}
