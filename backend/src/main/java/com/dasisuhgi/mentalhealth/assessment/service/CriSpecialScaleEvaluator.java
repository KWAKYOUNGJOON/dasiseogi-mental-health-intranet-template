package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.dto.AnswerRequest;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleQuestion;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.HttpStatus;

final class CriSpecialScaleEvaluator implements SpecialScaleEvaluator {
    @Override
    public EvaluationResult evaluate(
            ScaleDefinition definition,
            Map<Integer, AnswerRequest> answerMap,
            AnswerEvaluator answerEvaluator
    ) {
        if (answerMap.size() != definition.questionCount()) {
            throw answerIncomplete();
        }

        ScaleDefinition.CriEvaluationMetadata metadata = resolveEvaluationMetadata(definition);
        Map<Integer, ScaleDefinition.CriQuestionGroup> groupsByQuestionNo = indexQuestionGroups(definition, metadata);
        Map<String, Integer> sectionTotals = initializeSectionTotals(metadata);
        List<EvaluatedAnswerData> evaluatedAnswers = new ArrayList<>();
        Map<Integer, Integer> scoreByQuestionNo = new LinkedHashMap<>();
        int totalScore = 0;

        for (ScaleQuestion question : definition.items()) {
            AnswerRequest answerRequest = answerMap.get(question.questionNo());
            if (answerRequest == null) {
                throw answerIncomplete();
            }

            EvaluatedAnswerData evaluatedAnswer = answerEvaluator.evaluate(question, answerRequest);
            int appliedScore = evaluatedAnswer.appliedScore();

            evaluatedAnswers.add(evaluatedAnswer);
            scoreByQuestionNo.put(question.questionNo(), appliedScore);
            totalScore += appliedScore;

            ScaleDefinition.CriQuestionGroup group = groupsByQuestionNo.get(question.questionNo());
            if (group == null) {
                throw invalidEvaluationMetadata();
            }
            sectionTotals.compute(group.resultDetailKey(), (key, current) -> (current == null ? 0 : current) + appliedScore);
        }

        int selfOtherTotal = sectionTotals.get(metadata.selfOther().resultDetailKey());
        int mentalTotal = sectionTotals.get(metadata.mental().resultDetailKey());
        int functionTotal = sectionTotals.get(metadata.function().resultDetailKey());
        int supportTotal = sectionTotals.get(metadata.support().resultDetailKey());
        int risk8PlusMental = scoreByQuestionNo.getOrDefault(metadata.selfOtherRiskEightQuestionNo(), 0) + mentalTotal;
        String resultLevelCode = resolveResultLevelCode(
                metadata.resultLevelRules(),
                scoreByQuestionNo.getOrDefault(metadata.selfOtherRiskPresentQuestionNo(), 0),
                selfOtherTotal,
                risk8PlusMental
        );
        String resultLevel = formatResultLevel(definition, resultLevelCode);

        return new EvaluationResult(
                totalScore,
                resultLevelCode,
                resultLevel,
                List.copyOf(evaluatedAnswers),
                List.of(
                        new ResultDetailData(
                                metadata.selfOther().resultDetailKey(),
                                metadata.selfOther().resultDetailLabel(),
                                Integer.toString(selfOtherTotal)
                        ),
                        new ResultDetailData(
                                metadata.mental().resultDetailKey(),
                                metadata.mental().resultDetailLabel(),
                                Integer.toString(mentalTotal)
                        ),
                        new ResultDetailData(
                                metadata.function().resultDetailKey(),
                                metadata.function().resultDetailLabel(),
                                Integer.toString(functionTotal)
                        ),
                        new ResultDetailData(
                                metadata.support().resultDetailKey(),
                                metadata.support().resultDetailLabel(),
                                Integer.toString(supportTotal)
                        ),
                        new ResultDetailData(
                                metadata.riskEightPlusMentalDetailKey(),
                                metadata.riskEightPlusMentalDetailLabel(),
                                Integer.toString(risk8PlusMental)
                        )
                )
        );
    }

    private ScaleDefinition.CriEvaluationMetadata resolveEvaluationMetadata(ScaleDefinition definition) {
        if (definition.metadata() == null
                || definition.metadata().evaluation() == null
                || definition.metadata().evaluation().cri() == null) {
            throw invalidEvaluationMetadata();
        }

        ScaleDefinition.CriEvaluationMetadata metadata = definition.metadata().evaluation().cri();
        if (isBlank(metadata.riskEightPlusMentalDetailKey())
                || isBlank(metadata.riskEightPlusMentalDetailLabel())
                || metadata.selfOtherRiskPresentQuestionNo() == null
                || metadata.selfOtherRiskEightQuestionNo() == null
                || metadata.resultLevelRules() == null
                || metadata.resultLevelRules().isEmpty()) {
            throw invalidEvaluationMetadata();
        }

        validateGroup(metadata.selfOther());
        validateGroup(metadata.mental());
        validateGroup(metadata.function());
        validateGroup(metadata.support());

        boolean hasBlankRuleCode = metadata.resultLevelRules().stream()
                .map(ScaleDefinition.CriResultLevelRule::code)
                .anyMatch(this::isBlank);
        if (hasBlankRuleCode) {
            throw invalidEvaluationMetadata();
        }

        return metadata;
    }

    private void validateGroup(ScaleDefinition.CriQuestionGroup group) {
        if (group == null
                || isBlank(group.resultDetailKey())
                || isBlank(group.resultDetailLabel())
                || group.questionNos() == null
                || group.questionNos().isEmpty()
                || group.questionNos().stream().anyMatch(Objects::isNull)) {
            throw invalidEvaluationMetadata();
        }
    }

    private Map<Integer, ScaleDefinition.CriQuestionGroup> indexQuestionGroups(
            ScaleDefinition definition,
            ScaleDefinition.CriEvaluationMetadata metadata
    ) {
        Set<Integer> definedQuestionNos = definition.items().stream()
                .map(ScaleQuestion::questionNo)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Map<Integer, ScaleDefinition.CriQuestionGroup> groupsByQuestionNo = new LinkedHashMap<>();

        for (ScaleDefinition.CriQuestionGroup group : List.of(
                metadata.selfOther(),
                metadata.mental(),
                metadata.function(),
                metadata.support()
        )) {
            for (Integer questionNo : group.questionNos()) {
                if (!definedQuestionNos.contains(questionNo)
                        || groupsByQuestionNo.put(questionNo, group) != null) {
                    throw invalidEvaluationMetadata();
                }
            }
        }

        if (groupsByQuestionNo.size() != definedQuestionNos.size()
                || !groupsByQuestionNo.containsKey(metadata.selfOtherRiskPresentQuestionNo())
                || !groupsByQuestionNo.containsKey(metadata.selfOtherRiskEightQuestionNo())) {
            throw invalidEvaluationMetadata();
        }
        return groupsByQuestionNo;
    }

    private Map<String, Integer> initializeSectionTotals(ScaleDefinition.CriEvaluationMetadata metadata) {
        Map<String, Integer> sectionTotals = new LinkedHashMap<>();
        for (ScaleDefinition.CriQuestionGroup group : List.of(
                metadata.selfOther(),
                metadata.mental(),
                metadata.function(),
                metadata.support()
        )) {
            if (sectionTotals.put(group.resultDetailKey(), 0) != null) {
                throw invalidEvaluationMetadata();
            }
        }
        return sectionTotals;
    }

    private String resolveResultLevelCode(
            List<ScaleDefinition.CriResultLevelRule> rules,
            int selfOtherRiskPresentScore,
            int selfOtherTotal,
            int risk8PlusMental
    ) {
        return rules.stream()
                .filter(rule -> matches(rule, selfOtherRiskPresentScore, selfOtherTotal, risk8PlusMental))
                .map(ScaleDefinition.CriResultLevelRule::code)
                .map(this::blankToNull)
                .filter(Objects::nonNull)
                .findFirst()
                .orElseThrow(this::invalidResultLevel);
    }

    private boolean matches(
            ScaleDefinition.CriResultLevelRule rule,
            int selfOtherRiskPresentScore,
            int selfOtherTotal,
            int risk8PlusMental
    ) {
        return matchesExact(selfOtherRiskPresentScore, rule.selfOtherRiskPresentScoreEquals())
                && matchesMin(selfOtherTotal, rule.minSelfOtherTotal())
                && matchesMax(selfOtherTotal, rule.maxSelfOtherTotal())
                && matchesMin(risk8PlusMental, rule.minRiskEightPlusMental())
                && matchesMax(risk8PlusMental, rule.maxRiskEightPlusMental());
    }

    private boolean matchesExact(int actual, Integer expected) {
        return expected == null || actual == expected;
    }

    private boolean matchesMin(int actual, Integer minimum) {
        return minimum == null || actual >= minimum;
    }

    private boolean matchesMax(int actual, Integer maximum) {
        return maximum == null || actual <= maximum;
    }

    private String formatResultLevel(ScaleDefinition definition, String resultLevelCode) {
        String normalizedResultLevelCode = blankToNull(resultLevelCode);
        if (normalizedResultLevelCode == null) {
            throw invalidResultLevel();
        }

        String normalizedCodeKey = normalizedResultLevelCode.toUpperCase(Locale.ROOT);
        String label = resolveResultLevelLabels(definition).get(normalizedCodeKey);
        if (label == null) {
            throw missingResultLevelLabel();
        }
        return normalizedCodeKey + " - " + label;
    }

    private Map<String, String> resolveResultLevelLabels(ScaleDefinition definition) {
        if (definition.metadata() == null
                || definition.metadata().resultLevelLabels() == null
                || definition.metadata().resultLevelLabels().isEmpty()) {
            throw missingResultLevelMetadata();
        }

        Map<String, String> resultLevelLabels = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : definition.metadata().resultLevelLabels().entrySet()) {
            String code = blankToNull(entry.getKey());
            String label = blankToNull(entry.getValue());
            if (code == null || label == null) {
                continue;
            }
            resultLevelLabels.put(code.toUpperCase(Locale.ROOT), label);
        }

        if (resultLevelLabels.isEmpty()) {
            throw missingResultLevelMetadata();
        }
        return resultLevelLabels;
    }

    private AppException answerIncomplete() {
        return new AppException(HttpStatus.BAD_REQUEST, "ANSWER_INCOMPLETE", "모든 문항에 응답해야 저장할 수 있습니다.");
    }

    private AppException invalidEvaluationMetadata() {
        return new AppException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CRI_EVALUATION_METADATA_INVALID",
                "CRI 평가 metadata 구성이 올바르지 않습니다."
        );
    }

    private AppException invalidResultLevel() {
        return new AppException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CRI_RESULT_LEVEL_INVALID",
                "CRI 결과 레벨 계산에 실패했습니다."
        );
    }

    private AppException missingResultLevelLabel() {
        return new AppException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CRI_RESULT_LEVEL_LABEL_MISSING",
                "CRI 결과 레벨 표시 문구를 찾을 수 없습니다."
        );
    }

    private AppException missingResultLevelMetadata() {
        return new AppException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CRI_RESULT_LEVEL_METADATA_MISSING",
                "CRI 결과 레벨 표시 문구 metadata 구성이 올바르지 않습니다."
        );
    }

    private String blankToNull(String value) {
        if (isBlank(value)) {
            return null;
        }
        return value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
