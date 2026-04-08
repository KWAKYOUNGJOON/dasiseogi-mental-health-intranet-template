package com.dasisuhgi.mentalhealth.scale.dto;

import java.util.List;

public record ScaleQuestionResponse(
        int questionNo,
        String questionKey,
        String questionText,
        boolean reverseScored,
        List<ScaleOptionResponse> options,
        ConditionalRequiredResponse conditionalRequired
) {
    public record ConditionalRequiredResponse(
            List<Integer> sourceQuestionNos,
            Integer minScoreSum
    ) {
    }
}
