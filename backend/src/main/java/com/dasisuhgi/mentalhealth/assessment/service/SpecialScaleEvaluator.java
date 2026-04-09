package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.dto.AnswerRequest;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleOption;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleQuestion;
import java.util.List;
import java.util.Map;

interface SpecialScaleEvaluator {
    EvaluationResult evaluate(
            ScaleDefinition definition,
            Map<Integer, AnswerRequest> answerMap,
            AnswerEvaluator answerEvaluator
    );

    @FunctionalInterface
    interface AnswerEvaluator {
        EvaluatedAnswerData evaluate(ScaleQuestion question, AnswerRequest answerRequest);
    }

    record EvaluationResult(
            int totalScore,
            String resultLevelCode,
            String resultLevel,
            List<EvaluatedAnswerData> answers,
            List<ResultDetailData> resultDetails
    ) {
    }

    record EvaluatedAnswerData(
            ScaleQuestion question,
            ScaleOption option,
            int appliedScore
    ) {
    }

    record ResultDetailData(
            String key,
            String label,
            String value
    ) {
    }
}
