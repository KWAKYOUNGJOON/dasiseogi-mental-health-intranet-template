package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.dto.AnswerRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.SelectedScaleRequest;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleAlertRule;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssessmentServiceTest {
    @Mock
    private ScaleService scaleService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AssessmentService assessmentService;

    @BeforeEach
    void setUp() {
        assessmentService = new AssessmentService(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                scaleService,
                objectMapper,
                "테스트 기관",
                null
        );
    }

    @Test
    void resolveCriResultLevelCodeAndDisplayLabelSeparately() throws Exception {
        ScaleDefinition definition = loadScaleDefinition("cri.json");

        assertCriResultLevelPair(definition, 1, 1, 2, 0, "A", "A - 극도의 위기");
        assertCriResultLevelPair(definition, 1, 0, 2, 0, "B", "B - 위기");
        assertCriResultLevelPair(definition, 0, 1, 1, 0, "C", "C - 고위험");
        assertCriResultLevelPair(definition, 0, 0, 1, 0, "D", "D - 주의");
        assertCriResultLevelPair(definition, 0, 0, 0, 0, "E", "E - 위기상황 아님");
    }

    @Test
    void formatCriResultLevelFailsClearlyWhenCriMetadataDoesNotContainRequestedCode() {
        ScaleDefinition definition = createCriDefinitionWithResultLevelLabels(Map.of(
                "A", "극도의 위기",
                "B", "위기",
                "C", "고위험",
                "D", "주의"
        ));

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
                assessmentService,
                "formatCriResultLevel",
                definition,
                "E"
        ))
                .isInstanceOf(AppException.class)
                .satisfies(exception -> {
                    AppException appException = (AppException) exception;
                    assertThat(appException.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                    assertThat(appException.getErrorCode()).isEqualTo("CRI_RESULT_LEVEL_LABEL_MISSING");
                });
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
                )),
                null
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

    @Test
    void evaluateKmdqRequiresQuestion14WhenConditionalRequiredMetadataThresholdIsMet() throws Exception {
        when(scaleService.getActiveDefinition("KMDQ")).thenReturn(loadScaleDefinition("kmdq.json"));

        SelectedScaleRequest request = new SelectedScaleRequest(
                "KMDQ",
                List.of(
                        answer(1, "Y"),
                        answer(2, "Y"),
                        answer(3, "N"),
                        answer(4, "N"),
                        answer(5, "N"),
                        answer(6, "N"),
                        answer(7, "N"),
                        answer(8, "N"),
                        answer(9, "N"),
                        answer(10, "N"),
                        answer(11, "N"),
                        answer(12, "N"),
                        answer(13, "N")
                )
        );

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(assessmentService, "evaluateScale", request))
                .isInstanceOf(AppException.class)
                .satisfies(exception -> {
                    AppException appException = (AppException) exception;
                    assertThat(appException.getErrorCode()).isEqualTo("ANSWER_INCOMPLETE");
                });
    }

    @Test
    void evaluateKmdqAllowsOmittingQuestion14WhenConditionalRequiredMetadataThresholdIsNotMet() throws Exception {
        when(scaleService.getActiveDefinition("KMDQ")).thenReturn(loadScaleDefinition("kmdq.json"));

        SelectedScaleRequest request = new SelectedScaleRequest(
                "KMDQ",
                List.of(
                        answer(1, "Y"),
                        answer(2, "N"),
                        answer(3, "N"),
                        answer(4, "N"),
                        answer(5, "N"),
                        answer(6, "N"),
                        answer(7, "N"),
                        answer(8, "N"),
                        answer(9, "N"),
                        answer(10, "N"),
                        answer(11, "N"),
                        answer(12, "N"),
                        answer(13, "N")
                )
        );

        Object evaluation = ReflectionTestUtils.invokeMethod(assessmentService, "evaluateScale", request);

        assertThat(evaluation).isNotNull();
        assertThat(((Number) ReflectionTestUtils.invokeMethod(evaluation, "totalScore")).intValue()).isEqualTo(1);
        assertThat(((List<?>) ReflectionTestUtils.invokeMethod(evaluation, "answers"))).hasSize(13);
    }

    private void assertCriResultLevelPair(
            ScaleDefinition definition,
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
                definition,
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

    private ScaleDefinition loadScaleDefinition(String filename) throws Exception {
        try (InputStream inputStream = AssessmentServiceTest.class.getResourceAsStream("/scales/" + filename)) {
            assertThat(inputStream).isNotNull();
            return objectMapper.readValue(inputStream, ScaleDefinition.class);
        }
    }

    private ScaleDefinition createCriDefinitionWithResultLevelLabels(Map<String, String> resultLevelLabels) {
        return new ScaleDefinition(
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
                List.of(),
                new ScaleDefinition.Metadata(resultLevelLabels)
        );
    }

    private AnswerRequest answer(int questionNo, String answerValue) {
        return new AnswerRequest(questionNo, answerValue);
    }
}
