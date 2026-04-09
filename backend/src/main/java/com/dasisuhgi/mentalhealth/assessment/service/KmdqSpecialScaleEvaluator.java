package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.dto.AnswerRequest;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleQuestion;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;

final class KmdqSpecialScaleEvaluator implements SpecialScaleEvaluator {
    @Override
    public EvaluationResult evaluate(
            ScaleDefinition definition,
            Map<Integer, AnswerRequest> answerMap,
            AnswerEvaluator answerEvaluator
    ) {
        List<EvaluatedAnswerData> evaluatedAnswers = new ArrayList<>();
        Map<Integer, Integer> scoreByQuestionNo = new LinkedHashMap<>();

        for (ScaleQuestion question : definition.items()) {
            if (!isBaseRequiredQuestion(question)) {
                continue;
            }

            AnswerRequest answerRequest = answerMap.get(question.questionNo());
            if (answerRequest == null) {
                throw answerIncomplete();
            }

            EvaluatedAnswerData evaluatedAnswer = answerEvaluator.evaluate(question, answerRequest);
            evaluatedAnswers.add(evaluatedAnswer);
            scoreByQuestionNo.put(question.questionNo(), evaluatedAnswer.appliedScore());
        }

        for (ScaleQuestion question : definition.items()) {
            if (isBaseRequiredQuestion(question)) {
                continue;
            }

            AnswerRequest answerRequest = answerMap.get(question.questionNo());
            boolean required = isConditionallyRequired(question, scoreByQuestionNo);
            if (answerRequest == null) {
                if (required) {
                    throw answerIncomplete();
                }
                continue;
            }

            EvaluatedAnswerData evaluatedAnswer = answerEvaluator.evaluate(question, answerRequest);
            evaluatedAnswers.add(evaluatedAnswer);
            scoreByQuestionNo.put(question.questionNo(), evaluatedAnswer.appliedScore());
        }

        int totalScore = evaluatedAnswers.stream()
                .mapToInt(EvaluatedAnswerData::appliedScore)
                .sum();
        return new EvaluationResult(totalScore, null, null, List.copyOf(evaluatedAnswers), List.of());
    }

    private boolean isBaseRequiredQuestion(ScaleQuestion question) {
        return question.options().stream()
                .anyMatch(option -> option.score() != 0);
    }

    private boolean isConditionallyRequired(ScaleQuestion question, Map<Integer, Integer> scoreByQuestionNo) {
        ScaleQuestion.ConditionalRequired conditionalRequired = question.conditionalRequired();
        if (conditionalRequired == null) {
            return false;
        }
        if (conditionalRequired.sourceQuestionNos() == null
                || conditionalRequired.sourceQuestionNos().isEmpty()
                || conditionalRequired.sourceQuestionNos().stream().anyMatch(Objects::isNull)
                || conditionalRequired.minScoreSum() == null) {
            throw invalidConditionalRequired();
        }

        int scoreSum = 0;
        for (Integer sourceQuestionNo : conditionalRequired.sourceQuestionNos()) {
            Integer score = scoreByQuestionNo.get(sourceQuestionNo);
            if (score == null) {
                throw invalidConditionalRequired();
            }
            scoreSum += score;
        }
        return scoreSum >= conditionalRequired.minScoreSum();
    }

    private AppException answerIncomplete() {
        return new AppException(HttpStatus.BAD_REQUEST, "ANSWER_INCOMPLETE", "모든 문항에 응답해야 저장할 수 있습니다.");
    }

    private AppException invalidConditionalRequired() {
        return new AppException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "SCALE_CONDITIONAL_REQUIRED_INVALID",
                "척도 조건부 필수 규칙 구성이 올바르지 않습니다."
        );
    }
}
