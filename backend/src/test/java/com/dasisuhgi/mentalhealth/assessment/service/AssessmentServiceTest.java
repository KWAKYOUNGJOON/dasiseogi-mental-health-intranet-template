// cspell:words dasisuhgi mentalhealth assertj AtoE cri kmdq selfOther risk8
package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.dto.AnswerRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.SelectedScaleRequest;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentQueryRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentSessionRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionAlertRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionAnswerRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionScaleRepository;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.sequence.IdentifierGeneratorService;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleAlertRule;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private AssessmentSessionRepository assessmentSessionRepository;
    @Mock
    private SessionScaleRepository sessionScaleRepository;
    @Mock
    private SessionAnswerRepository sessionAnswerRepository;
    @Mock
    private SessionAlertRepository sessionAlertRepository;
    @Mock
    private ClientRepository clientRepository;
    @Mock
    private AssessmentQueryRepository assessmentQueryRepository;
    @Mock
    private AccessPolicyService accessPolicyService;
    @Mock
    private IdentifierGeneratorService identifierGeneratorService;
    @Mock
    private SessionSaveFailureSimulator sessionSaveFailureSimulator;
    @Mock
    private ScaleService scaleService;
    @Mock
    private ActivityLogService activityLogService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AssessmentService assessmentService;

    @BeforeEach
    void setUp() {
        assessmentService = new AssessmentService(
                assessmentSessionRepository,
                sessionScaleRepository,
                sessionAnswerRepository,
                sessionAlertRepository,
                clientRepository,
                assessmentQueryRepository,
                accessPolicyService,
                identifierGeneratorService,
                sessionSaveFailureSimulator,
                scaleService,
                objectMapper,
                "테스트 기관",
                activityLogService
        );
    }

    @Test
    void evaluateCriPreservesResultLevelCodesLabelsAndResultDetailsAcrossAtoE() throws Exception {
        when(scaleService.getActiveDefinition("CRI")).thenReturn(loadScaleDefinition("cri.json"));

        assertCriEvaluation(criAnswersForExtremeCrisis(), "A", "A - 극도의 위기", 2, 2, 0, 0, 0, 1);
        assertCriEvaluation(criAnswersForCrisis(), "B", "B - 위기", 2, 2, 0, 0, 0, 0);
        assertCriEvaluation(criAnswersForHighRisk(), "C", "C - 고위험", 2, 2, 0, 0, 0, 1);
        assertCriEvaluation(criAnswersForCaution(), "D", "D - 주의", 1, 1, 0, 0, 0, 0);
        assertCriEvaluation(criAnswersForNoCrisis(), "E", "E - 위기상황 아님", 0, 0, 0, 0, 0, 0);
    }

    @Test
    void formatCriResultLevelFailsClearlyWhenCriMetadataDoesNotContainRequestedCode() {
        ScaleDefinition definition = createCriDefinitionWithResultLevelLabels(Map.of(
                "A", "극도의 위기",
                "B", "위기",
                "C", "고위험",
                "D", "주의"
        ));
        when(scaleService.getActiveDefinition("CRI")).thenReturn(definition);

        assertThatThrownBy(() -> invokeEvaluation(new SelectedScaleRequest("CRI", toCriAnswerRequests(criAnswersForNoCrisis()))))
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
        assertThat(invokeString(matchedAlert, "code")).isEqualTo("CRI_RESULT_A");
        assertThat(invokeString(matchedAlert, "message")).isEqualTo("CRI 결과 A: 극도의 위기");
        assertThat(invokeString(matchedAlert, "triggerValue")).isEqualTo("극도의 위기 단계");

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

        assertThatThrownBy(() -> invokeEvaluation(request))
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

        Object evaluation = invokeEvaluation(request);

        assertThat(invokeInt(evaluation, "totalScore")).isEqualTo(1);
        assertThat(invokeList(evaluation, "answers")).hasSize(13);
    }

    @Test
    void evaluateKmdqKeepsModifiedPositiveScreenBehaviorWithoutRequiringImpairmentAnswer() throws Exception {
        when(scaleService.getActiveDefinition("KMDQ")).thenReturn(loadScaleDefinition("kmdq.json"));

        SelectedScaleRequest request = new SelectedScaleRequest(
                "KMDQ",
                List.of(
                        answer(1, "Y"),
                        answer(2, "Y"),
                        answer(3, "Y"),
                        answer(4, "Y"),
                        answer(5, "Y"),
                        answer(6, "Y"),
                        answer(7, "Y"),
                        answer(8, "N"),
                        answer(9, "N"),
                        answer(10, "N"),
                        answer(11, "N"),
                        answer(12, "N"),
                        answer(13, "N"),
                        answer(14, "Y")
                )
        );

        Object evaluation = invokeEvaluation(request);

        assertThat(invokeInt(evaluation, "totalScore")).isEqualTo(7);
        assertThat(invokeString(evaluation, "resultLevelCode")).isEqualTo("POSITIVE_SCREEN");
        assertThat(invokeString(evaluation, "resultLevel")).isEqualTo("양성 의심");
        assertThat(invokeList(evaluation, "answers")).hasSize(14);
    }

    private void assertCriEvaluation(
            int[] rawAnswers,
            String expectedCode,
            String expectedDisplayLabel,
            int expectedTotalScore,
            int expectedSelfOtherTotal,
            int expectedMentalTotal,
            int expectedFunctionTotal,
            int expectedSupportTotal,
            int expectedRisk8PlusMental
    ) {
        Object evaluation = invokeEvaluation(new SelectedScaleRequest("CRI", toCriAnswerRequests(rawAnswers)));

        assertThat(invokeInt(evaluation, "totalScore")).isEqualTo(expectedTotalScore);
        assertThat(invokeString(evaluation, "resultLevelCode")).isEqualTo(expectedCode);
        assertThat(invokeString(evaluation, "resultLevel")).isEqualTo(expectedDisplayLabel);
        assertThat(readResultDetailValue(evaluation, "selfOtherTotal")).isEqualTo(Integer.toString(expectedSelfOtherTotal));
        assertThat(readResultDetailValue(evaluation, "mentalTotal")).isEqualTo(Integer.toString(expectedMentalTotal));
        assertThat(readResultDetailValue(evaluation, "functionTotal")).isEqualTo(Integer.toString(expectedFunctionTotal));
        assertThat(readResultDetailValue(evaluation, "supportTotal")).isEqualTo(Integer.toString(expectedSupportTotal));
        assertThat(readResultDetailValue(evaluation, "risk8PlusMental")).isEqualTo(Integer.toString(expectedRisk8PlusMental));
    }

    private List<?> invokeBuildAlertData(ScaleDefinition definition, String resultLevelCode, String resultLevel) {
        return invokeList(
                assessmentService,
                "buildAlertData",
                definition,
                0,
                resultLevelCode,
                resultLevel,
                List.of()
        );
    }

    private String readResultDetailValue(Object evaluation, String key) {
        List<?> resultDetails = invokeList(evaluation, "resultDetails");
        return resultDetails.stream()
                .filter(detail -> key.equals(invokeString(detail, "key")))
                .map(detail -> invokeString(detail, "value"))
                .findFirst()
                .orElseThrow();
    }

    private ScaleDefinition loadScaleDefinition(String filename) throws Exception {
        try (InputStream inputStream = AssessmentServiceTest.class.getResourceAsStream("/scales/" + filename)) {
            return objectMapper.readValue(Objects.requireNonNull(inputStream, "scale definition: " + filename), ScaleDefinition.class);
        }
    }

    private Object invokeEvaluation(SelectedScaleRequest request) {
        return invokeNonNull(assessmentService, "evaluateScale", request);
    }

    private Object invokeNonNull(Object target, String methodName, Object... args) {
        return Objects.requireNonNull(
                ReflectionTestUtils.invokeMethod(target, methodName, args),
                methodName + " should not return null"
        );
    }

    private String invokeString(Object target, String methodName, Object... args) {
        Object result = invokeNonNull(target, methodName, args);
        if (result instanceof String stringResult) {
            return stringResult;
        }
        throw new AssertionError(methodName + " should return String but was " + result.getClass().getName());
    }

    private int invokeInt(Object target, String methodName, Object... args) {
        Object result = invokeNonNull(target, methodName, args);
        if (result instanceof Number numberResult) {
            return numberResult.intValue();
        }
        throw new AssertionError(methodName + " should return Number but was " + result.getClass().getName());
    }

    private List<?> invokeList(Object target, String methodName, Object... args) {
        Object result = invokeNonNull(target, methodName, args);
        if (result instanceof List<?> listResult) {
            return listResult;
        }
        throw new AssertionError(methodName + " should return List but was " + result.getClass().getName());
    }

    private ScaleDefinition createCriDefinitionWithResultLevelLabels(Map<String, String> resultLevelLabels) {
        ScaleDefinition source = loadCriDefinition("cri.json");
        ScaleDefinition.Metadata sourceMetadata = Objects.requireNonNull(source.metadata(), "CRI metadata");
        return new ScaleDefinition(
                source.scaleCode(),
                source.scaleName(),
                source.version(),
                source.displayOrder(),
                source.isActive(),
                source.questionCount(),
                source.screeningThreshold(),
                source.screeningLabel(),
                source.items(),
                source.interpretationRules(),
                source.alertRules(),
                new ScaleDefinition.Metadata(resultLevelLabels, sourceMetadata.ui(), sourceMetadata.evaluation())
        );
    }

    private AnswerRequest answer(int questionNo, String answerValue) {
        return new AnswerRequest(questionNo, answerValue);
    }

    private ScaleDefinition loadCriDefinition(String filename) {
        try {
            return loadScaleDefinition(filename);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private List<AnswerRequest> toCriAnswerRequests(int[] rawAnswers) {
        return java.util.stream.IntStream.range(0, rawAnswers.length)
                .mapToObj(index -> new AnswerRequest(index + 1, Integer.toString(rawAnswers[index])))
                .toList();
    }

    private int[] criAnswersForExtremeCrisis() {
        int[] answers = criAnswersForNoCrisis();
        answers[0] = 1;
        answers[7] = 1;
        return answers;
    }

    private int[] criAnswersForCrisis() {
        int[] answers = criAnswersForNoCrisis();
        answers[0] = 1;
        answers[1] = 1;
        return answers;
    }

    private int[] criAnswersForHighRisk() {
        int[] answers = criAnswersForNoCrisis();
        answers[1] = 1;
        answers[7] = 1;
        return answers;
    }

    private int[] criAnswersForCaution() {
        int[] answers = criAnswersForNoCrisis();
        answers[1] = 1;
        return answers;
    }

    private int[] criAnswersForNoCrisis() {
        int[] answers = new int[23];
        answers[21] = 0;
        answers[22] = 0;
        return answers;
    }
}
