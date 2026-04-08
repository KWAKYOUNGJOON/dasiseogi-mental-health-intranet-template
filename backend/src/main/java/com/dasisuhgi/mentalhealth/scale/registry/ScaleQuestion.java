package com.dasisuhgi.mentalhealth.scale.registry;

import java.util.List;

public record ScaleQuestion(
        int questionNo,
        String questionKey,
        String text,
        boolean reverseScored,
        List<ScaleOption> options,
        ConditionalRequired conditionalRequired
) {
    public record ConditionalRequired(
            List<Integer> sourceQuestionNos,
            Integer minScoreSum
    ) {
    }
}
