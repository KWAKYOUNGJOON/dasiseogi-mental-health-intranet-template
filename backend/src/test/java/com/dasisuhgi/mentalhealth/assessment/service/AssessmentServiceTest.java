package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.scale.registry.ScaleAlertRule;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class AssessmentServiceTest {
    private final AssessmentService assessmentService = new AssessmentService(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            new ObjectMapper(),
            "테스트 기관",
            null
    );

    @Test
    void resolveCriResultLevelCodeAndDisplayLabelSeparately() {
        assertCriResultLevelPair(1, 1, 2, 0, "A", "A - 극도의 위기");
        assertCriResultLevelPair(1, 0, 2, 0, "B", "B - 위기");
        assertCriResultLevelPair(0, 1, 1, 0, "C", "C - 고위험");
        assertCriResultLevelPair(0, 0, 1, 0, "D", "D - 주의");
        assertCriResultLevelPair(0, 0, 0, 0, "E", "E - 위기상황 아님");
    }

    @Test
    void buildAlertDataMatchesCriResultLevelByStableCodeInsteadOfDisplayLabelPrefix() {
        ScaleDefinition definition = new ScaleDefinition(
                "CRI",
                "정신과적 위기 분류 평정척도 (CRI)",
                "1.0.0",
                9,
                true,
                23,
                null,
                null,
                List.of(),
                List.of(),
                List.of(new ScaleAlertRule(
                        "CRI_RESULT_A",
                        "HIGH_RISK",
                        "CRI 결과 A: 극도의 위기",
                        null,
                        null,
                        null,
                        null,
                        List.of("A")
                ))
        );

        List<?> matchedAlerts = invokeBuildAlertData(definition, "A", "극도의 위기 단계");
        assertThat(matchedAlerts).hasSize(1);
        Object matchedAlert = matchedAlerts.get(0);
        assertThat((String) ReflectionTestUtils.invokeMethod(matchedAlert, "code")).isEqualTo("CRI_RESULT_A");
        assertThat((String) ReflectionTestUtils.invokeMethod(matchedAlert, "message")).isEqualTo("CRI 결과 A: 극도의 위기");
        assertThat((String) ReflectionTestUtils.invokeMethod(matchedAlert, "triggerValue")).isEqualTo("극도의 위기 단계");

        List<?> unmatchedAlerts = invokeBuildAlertData(definition, "B", "A - 극도의 위기");
        assertThat(unmatchedAlerts).isEmpty();
    }

    private void assertCriResultLevelPair(
            int selfOtherQuestionOneScore,
            int selfOtherQuestionEightScore,
            int selfOtherTotal,
            int mentalTotal,
            String expectedCode,
            String expectedDisplayLabel
    ) {
        String resultLevelCode = ReflectionTestUtils.invokeMethod(
                assessmentService,
                "resolveCriResultLevelCode",
                selfOtherQuestionOneScore,
                selfOtherQuestionEightScore,
                selfOtherTotal,
                mentalTotal
        );
        assertThat(resultLevelCode).isEqualTo(expectedCode);

        String resultLevel = ReflectionTestUtils.invokeMethod(
                assessmentService,
                "formatCriResultLevel",
                resultLevelCode
        );
        assertThat(resultLevel).isEqualTo(expectedDisplayLabel);
    }

    private List<?> invokeBuildAlertData(ScaleDefinition definition, String resultLevelCode, String resultLevel) {
        return (List<?>) ReflectionTestUtils.invokeMethod(
                assessmentService,
                "buildAlertData",
                definition,
                0,
                resultLevelCode,
                resultLevel,
                List.of()
        );
    }
}
