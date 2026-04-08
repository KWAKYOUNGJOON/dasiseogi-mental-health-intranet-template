package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.dto.AnswerRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentRecordListItemResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentSessionPrintClientResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentSessionPrintDataResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentSessionPrintScaleResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentSessionDetailResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.MarkMisenteredRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.SaveAssessmentSessionRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.SelectedScaleRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionStatusChangeResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionAlertResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionAnswerResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionSaveResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionScaleResultDetailResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionScaleResponse;
import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionAlert;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionAnswer;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionScale;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentQueryRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentSessionRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionAlertRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionAnswerRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionScaleRepository;
import com.dasisuhgi.mentalhealth.assessment.support.AssessmentDateTimePolicy;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.sequence.IdentifierGeneratorService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import com.dasisuhgi.mentalhealth.scale.registry.InterpretationRule;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleAlertRule;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleOption;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleQuestion;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssessmentService {
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final String KMDQ_SCALE_CODE = "KMDQ";
    private static final String CRI_SCALE_CODE = "CRI";
    private static final int CRI_SELF_OTHER_END_NO = 8;
    private static final int CRI_MENTAL_END_NO = 14;
    private static final int CRI_FUNCTION_END_NO = 21;
    private static final int CRI_SELF_OTHER_RISK_PRESENT_QUESTION_NO = 1;
    private static final int CRI_SELF_OTHER_RISK_EIGHT_QUESTION_NO = 8;

    private final AssessmentSessionRepository assessmentSessionRepository;
    private final SessionScaleRepository sessionScaleRepository;
    private final SessionAnswerRepository sessionAnswerRepository;
    private final SessionAlertRepository sessionAlertRepository;
    private final ClientRepository clientRepository;
    private final AssessmentQueryRepository assessmentQueryRepository;
    private final AccessPolicyService accessPolicyService;
    private final IdentifierGeneratorService identifierGeneratorService;
    private final SessionSaveFailureSimulator sessionSaveFailureSimulator;
    private final ScaleService scaleService;
    private final ObjectMapper objectMapper;
    private final String institutionName;
    private final ActivityLogService activityLogService;

    public AssessmentService(
            AssessmentSessionRepository assessmentSessionRepository,
            SessionScaleRepository sessionScaleRepository,
            SessionAnswerRepository sessionAnswerRepository,
            SessionAlertRepository sessionAlertRepository,
            ClientRepository clientRepository,
            AssessmentQueryRepository assessmentQueryRepository,
            AccessPolicyService accessPolicyService,
            IdentifierGeneratorService identifierGeneratorService,
            SessionSaveFailureSimulator sessionSaveFailureSimulator,
            ScaleService scaleService,
            ObjectMapper objectMapper,
            @Value("${app.organization.name:다시서기 정신건강 평가관리 시스템}") String institutionName,
            ActivityLogService activityLogService
    ) {
        this.assessmentSessionRepository = assessmentSessionRepository;
        this.sessionScaleRepository = sessionScaleRepository;
        this.sessionAnswerRepository = sessionAnswerRepository;
        this.sessionAlertRepository = sessionAlertRepository;
        this.clientRepository = clientRepository;
        this.assessmentQueryRepository = assessmentQueryRepository;
        this.accessPolicyService = accessPolicyService;
        this.identifierGeneratorService = identifierGeneratorService;
        this.sessionSaveFailureSimulator = sessionSaveFailureSimulator;
        this.scaleService = scaleService;
        this.objectMapper = objectMapper;
        this.institutionName = institutionName;
        this.activityLogService = activityLogService;
    }

    @Transactional
    public SessionSaveResponse saveSession(SaveAssessmentSessionRequest request, SessionUser sessionUser) {
        if (request.selectedScales().isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SESSION_EMPTY", "최소 1개 척도를 선택해야 합니다.");
        }
        if (request.sessionCompletedAt().isBefore(request.sessionStartedAt())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_SESSION_TIME_RANGE", "검사 종료 시각은 시작 시각보다 빠를 수 없습니다.");
        }

        Client client = clientRepository.findById(Objects.requireNonNull(request.clientId(), "clientId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "대상자를 찾을 수 없습니다."));
        if (client.getStatus() != ClientStatus.ACTIVE) {
            throw new AppException(HttpStatus.BAD_REQUEST, "CLIENT_NOT_ACTIVE", "활성 대상자만 검사할 수 있습니다.");
        }
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);

        Set<String> uniqueScaleCodes = request.selectedScales().stream()
                .map(scale -> scale.scaleCode().trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toSet());
        if (uniqueScaleCodes.size() != request.selectedScales().size()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SCALE_DUPLICATED", "같은 척도를 중복 선택할 수 없습니다.");
        }

        List<ScaleEvaluation> evaluations = request.selectedScales().stream()
                .map(this::evaluateScale)
                .toList();

        AssessmentSession session = new AssessmentSession();
        session.setSessionNo(identifierGeneratorService.nextSessionNo(request.sessionCompletedAt().toLocalDate()));
        session.setClient(client);
        session.setSessionDate(request.sessionCompletedAt().toLocalDate());
        session.setSessionStartedAt(request.sessionStartedAt());
        session.setSessionCompletedAt(request.sessionCompletedAt());
        session.setPerformedBy(currentUser);
        session.setCreatedBy(currentUser);
        session.setUpdatedBy(currentUser);
        session.setScaleCount(evaluations.size());
        session.setHasAlert(evaluations.stream().anyMatch(ScaleEvaluation::hasAlert));
        session.setMemo(blankToNull(request.memo()));
        session.setStatus(AssessmentSessionStatus.COMPLETED);
        AssessmentSession savedSession = assessmentSessionRepository.save(session);
        sessionSaveFailureSimulator.afterSessionSaved(savedSession);

        for (ScaleEvaluation evaluation : evaluations) {
            SessionScale sessionScale = new SessionScale();
            sessionScale.setSession(savedSession);
            sessionScale.setScaleCode(evaluation.definition().scaleCode());
            sessionScale.setScaleName(evaluation.definition().scaleName());
            sessionScale.setDisplayOrder(evaluation.definition().displayOrder());
            sessionScale.setTotalScore(BigDecimal.valueOf(evaluation.totalScore()));
            sessionScale.setResultLevel(evaluation.resultLevel());
            sessionScale.setHasAlert(evaluation.hasAlert());
            sessionScale.setRawResultSnapshot(toJsonSnapshot(evaluation));
            SessionScale savedScale = sessionScaleRepository.save(sessionScale);

            for (EvaluatedAnswer evaluatedAnswer : evaluation.answers()) {
                SessionAnswer answer = new SessionAnswer();
                answer.setSessionScale(savedScale);
                answer.setSession(savedSession);
                answer.setScaleCode(evaluation.definition().scaleCode());
                answer.setQuestionNo(evaluatedAnswer.question().questionNo());
                answer.setQuestionKey(evaluatedAnswer.question().questionKey());
                answer.setQuestionTextSnapshot(evaluatedAnswer.question().text());
                answer.setAnswerValue(evaluatedAnswer.option().value());
                answer.setAnswerLabelSnapshot(evaluatedAnswer.option().label());
                answer.setScoreValue(BigDecimal.valueOf(evaluatedAnswer.appliedScore()));
                answer.setReverseScored(evaluatedAnswer.question().reverseScored());
                sessionAnswerRepository.save(answer);
            }

            for (SessionAlertData alertData : evaluation.alerts()) {
                SessionAlert alert = new SessionAlert();
                alert.setSession(savedSession);
                alert.setSessionScale(savedScale);
                alert.setClient(client);
                alert.setScaleCode(evaluation.definition().scaleCode());
                alert.setAlertType(alertData.alertType());
                alert.setAlertCode(alertData.code());
                alert.setAlertMessage(alertData.message());
                alert.setQuestionNo(alertData.questionNo());
                alert.setTriggerValue(alertData.triggerValue());
                sessionAlertRepository.save(alert);
            }
        }

        activityLogService.log(
                currentUser,
                ActivityActionType.SESSION_CREATE,
                ActivityTargetType.SESSION,
                savedSession.getId(),
                savedSession.getSessionNo(),
                "검사 세션 저장"
        );

        return new SessionSaveResponse(
                savedSession.getId(),
                savedSession.getSessionNo(),
                client.getId(),
                savedSession.getStatus().name(),
                savedSession.getScaleCount(),
                savedSession.isHasAlert()
        );
    }

    @Transactional(readOnly = true)
    public AssessmentSessionDetailResponse getSessionDetail(Long sessionId, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        AssessmentSession session = assessmentSessionRepository.findById(Objects.requireNonNull(sessionId, "sessionId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "검사 세션을 찾을 수 없습니다."));
        accessPolicyService.assertCanViewSession(currentUser, session);

        List<SessionScale> scales = sessionScaleRepository.findBySessionIdOrderByDisplayOrderAsc(sessionId);
        List<Long> scaleIds = scales.stream().map(SessionScale::getId).toList();
        Map<Long, List<SessionAnswer>> answersByScale = sessionAnswerRepository.findBySessionScaleIdInOrderBySessionScaleIdAscQuestionNoAsc(scaleIds)
                .stream()
                .collect(Collectors.groupingBy(answer -> answer.getSessionScale().getId(), LinkedHashMap::new, Collectors.toList()));
        List<SessionAlert> allAlertsRaw = sessionAlertRepository.findBySessionIdOrderByIdAsc(sessionId);
        Map<Long, List<SessionAlert>> alertsByScale = allAlertsRaw.stream()
                .collect(Collectors.groupingBy(alert -> alert.getSessionScale().getId(), LinkedHashMap::new, Collectors.toList()));

        List<SessionScaleResponse> scaleResponses = scales.stream()
                .map(scale -> new SessionScaleResponse(
                        scale.getId(),
                        scale.getScaleCode(),
                        scale.getScaleName(),
                        scale.getDisplayOrder(),
                        scale.getTotalScore().intValue(),
                        scale.getResultLevel(),
                        scale.isHasAlert(),
                        readResultDetails(scale),
                        answersByScale.getOrDefault(scale.getId(), List.of()).stream()
                                .map(answer -> new SessionAnswerResponse(
                                        answer.getQuestionNo(),
                                        answer.getQuestionKey(),
                                        answer.getQuestionTextSnapshot(),
                                        answer.getAnswerValue(),
                                        answer.getAnswerLabelSnapshot(),
                                        answer.getScoreValue().intValue()
                                ))
                                .toList(),
                        alertsByScale.getOrDefault(scale.getId(), List.of()).stream()
                                .map(this::toAlertResponse)
                                .toList()
                ))
                .toList();

        return new AssessmentSessionDetailResponse(
                session.getId(),
                session.getSessionNo(),
                session.getStatus().name(),
                DATE_FORMAT.format(session.getSessionDate()),
                formatDateTime(session.getSessionStartedAt()),
                formatDateTime(session.getSessionCompletedAt()),
                session.getPerformedBy().getId(),
                session.getPerformedBy().getName(),
                session.getClient().getId(),
                session.getClient().getClientNo(),
                session.getClient().getName(),
                DATE_FORMAT.format(session.getClient().getBirthDate()),
                session.getClient().getGender().name(),
                session.getMemo(),
                formatDateTime(session.getMisenteredAt()),
                session.getMisenteredBy() == null ? null : session.getMisenteredBy().getId(),
                session.getMisenteredBy() == null ? null : session.getMisenteredBy().getName(),
                session.getMisenteredReason(),
                session.isHasAlert(),
                scaleResponses,
                allAlertsRaw.stream().map(this::toAlertResponse).toList()
        );
    }

    @Transactional
    public AssessmentSessionPrintDataResponse getSessionPrintData(Long sessionId, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        AssessmentSession session = assessmentSessionRepository.findById(Objects.requireNonNull(sessionId, "sessionId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "검사 세션을 찾을 수 없습니다."));
        accessPolicyService.assertCanViewSession(currentUser, session);

        List<SessionScale> scales = sessionScaleRepository.findBySessionIdOrderByDisplayOrderAsc(sessionId);
        List<SessionAlert> allAlerts = sessionAlertRepository.findBySessionIdOrderByIdAsc(sessionId);
        Map<Long, List<SessionAlert>> alertsByScale = allAlerts.stream()
                .collect(Collectors.groupingBy(alert -> alert.getSessionScale().getId(), LinkedHashMap::new, Collectors.toList()));

        List<AssessmentSessionPrintScaleResponse> scaleResponses = scales.stream()
                .map(scale -> new AssessmentSessionPrintScaleResponse(
                        scale.getScaleCode(),
                        scale.getScaleName(),
                        scale.getTotalScore().intValue(),
                        scale.getResultLevel(),
                        readResultDetails(scale),
                        alertsByScale.getOrDefault(scale.getId(), List.of()).stream()
                                .map(SessionAlert::getAlertMessage)
                                .toList()
                ))
                .toList();

        int alertCount = allAlerts.size();
        String summaryText = "총 " + scales.size() + "개 척도 시행"
                + (alertCount > 0 ? ", 경고 " + alertCount + "건" : ", 경고 없음");

        activityLogService.log(
                currentUser,
                ActivityActionType.PRINT_SESSION,
                ActivityTargetType.SESSION,
                session.getId(),
                session.getSessionNo(),
                "세션 출력 데이터 조회"
        );

        return new AssessmentSessionPrintDataResponse(
                institutionName,
                session.getPerformedBy().getTeamName(),
                session.getPerformedBy().getName(),
                session.getSessionNo(),
                formatDateTime(session.getSessionStartedAt()),
                formatDateTime(session.getSessionCompletedAt()),
                new AssessmentSessionPrintClientResponse(
                        session.getClient().getId(),
                        session.getClient().getClientNo(),
                        session.getClient().getName(),
                        DATE_FORMAT.format(session.getClient().getBirthDate()),
                        session.getClient().getGender().name()
                ),
                scaleResponses,
                session.isHasAlert(),
                scales.size(),
                alertCount,
                summaryText
        );
    }

    @Transactional
    public SessionStatusChangeResponse markMisentered(Long sessionId, MarkMisenteredRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        AssessmentSession session = assessmentSessionRepository.findById(Objects.requireNonNull(sessionId, "sessionId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "검사 세션을 찾을 수 없습니다."));
        accessPolicyService.assertCanMarkSessionMisentered(currentUser, session);
        if (session.getStatus() == AssessmentSessionStatus.MISENTERED) {
            throw new AppException(HttpStatus.CONFLICT, "SESSION_ALREADY_MISENTERED", "이미 오입력 처리된 세션입니다.");
        }

        session.setStatus(AssessmentSessionStatus.MISENTERED);
        session.setMisenteredAt(AssessmentDateTimePolicy.now());
        session.setMisenteredBy(currentUser);
        session.setUpdatedBy(currentUser);
        session.setMisenteredReason(request.reason().trim());
        activityLogService.log(
                currentUser,
                ActivityActionType.SESSION_MARK_MISENTERED,
                ActivityTargetType.SESSION,
                session.getId(),
                session.getSessionNo(),
                "세션 오입력 처리"
        );

        return new SessionStatusChangeResponse(
                session.getId(),
                session.getStatus().name(),
                formatDateTime(session.getMisenteredAt())
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<AssessmentRecordListItemResponse> getAssessmentRecords(
            LocalDate dateFrom,
            LocalDate dateTo,
            String clientName,
            String scaleCode,
            boolean includeMisentered,
            int page,
            int size,
            SessionUser sessionUser
    ) {
        if (page < 1 || size < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_PAGE_REQUEST", "페이지 요청 값을 다시 확인해주세요.");
        }
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "조회 기간을 다시 확인해주세요.");
        }

        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        return assessmentQueryRepository.findAssessmentRecords(
                dateFrom,
                dateTo,
                clientName,
                scaleCode,
                includeMisentered,
                currentUser.getId(),
                accessPolicyService.isAdmin(currentUser),
                page,
                size
        );
    }

    private ScaleEvaluation evaluateScale(SelectedScaleRequest request) {
        String scaleCode = request.scaleCode().trim().toUpperCase(Locale.ROOT);
        ScaleDefinition definition = scaleService.getActiveDefinition(scaleCode);

        Map<Integer, AnswerRequest> answerMap = new HashMap<>();
        for (AnswerRequest answerRequest : request.answers()) {
            if (answerMap.put(answerRequest.questionNo(), answerRequest) != null) {
                throw new AppException(HttpStatus.BAD_REQUEST, "ANSWER_DUPLICATED", "같은 문항에 중복 응답할 수 없습니다.");
            }
        }

        Map<Integer, ScaleQuestion> questionsByNo = definition.items().stream()
                .collect(Collectors.toMap(ScaleQuestion::questionNo, question -> question, (existing, replacement) -> existing, LinkedHashMap::new));
        validateAnswerQuestionNumbers(answerMap, questionsByNo);

        if (KMDQ_SCALE_CODE.equals(scaleCode)) {
            return evaluateKmdqScale(definition, answerMap);
        }
        if (CRI_SCALE_CODE.equals(scaleCode)) {
            return evaluateCriScale(definition, answerMap);
        }

        if (answerMap.size() != definition.questionCount()) {
            throw answerIncomplete();
        }

        List<EvaluatedAnswer> evaluatedAnswers = new ArrayList<>();
        int totalScore = 0;
        for (ScaleQuestion question : definition.items()) {
            AnswerRequest answerRequest = answerMap.get(question.questionNo());
            if (answerRequest == null) {
                throw answerIncomplete();
            }
            EvaluatedAnswer evaluatedAnswer = evaluateAnswer(question, answerRequest);
            evaluatedAnswers.add(evaluatedAnswer);
            totalScore += evaluatedAnswer.appliedScore();
        }

        return buildScaleEvaluation(definition, totalScore, evaluatedAnswers);
    }

    private ScaleEvaluation evaluateKmdqScale(ScaleDefinition definition, Map<Integer, AnswerRequest> answerMap) {
        List<EvaluatedAnswer> evaluatedAnswers = new ArrayList<>();
        Map<Integer, Integer> scoreByQuestionNo = new LinkedHashMap<>();

        for (ScaleQuestion question : definition.items()) {
            if (!isKmdqBaseRequiredQuestion(question)) {
                continue;
            }
            AnswerRequest answerRequest = answerMap.get(question.questionNo());
            if (answerRequest == null) {
                throw answerIncomplete();
            }

            EvaluatedAnswer evaluatedAnswer = evaluateAnswer(question, answerRequest);
            evaluatedAnswers.add(evaluatedAnswer);
            scoreByQuestionNo.put(question.questionNo(), evaluatedAnswer.appliedScore());
        }

        for (ScaleQuestion question : definition.items()) {
            if (isKmdqBaseRequiredQuestion(question)) {
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

            EvaluatedAnswer evaluatedAnswer = evaluateAnswer(question, answerRequest);
            evaluatedAnswers.add(evaluatedAnswer);
            scoreByQuestionNo.put(question.questionNo(), evaluatedAnswer.appliedScore());
        }

        int totalScore = evaluatedAnswers.stream()
                .mapToInt(EvaluatedAnswer::appliedScore)
                .sum();
        return buildScaleEvaluation(definition, totalScore, evaluatedAnswers);
    }

    // In the current K-MDQ JSON, symptom items are the only score-bearing base-required questions.
    private boolean isKmdqBaseRequiredQuestion(ScaleQuestion question) {
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

    private ScaleEvaluation evaluateCriScale(ScaleDefinition definition, Map<Integer, AnswerRequest> answerMap) {
        if (answerMap.size() != definition.questionCount()) {
            throw answerIncomplete();
        }

        List<EvaluatedAnswer> evaluatedAnswers = new ArrayList<>();
        Map<Integer, Integer> scoreByQuestionNo = new LinkedHashMap<>();
        int totalScore = 0;
        int selfOtherTotal = 0;
        int mentalTotal = 0;
        int functionTotal = 0;
        int supportTotal = 0;

        for (ScaleQuestion question : definition.items()) {
            AnswerRequest answerRequest = answerMap.get(question.questionNo());
            if (answerRequest == null) {
                throw answerIncomplete();
            }

            EvaluatedAnswer evaluatedAnswer = evaluateAnswer(question, answerRequest);
            int appliedScore = evaluatedAnswer.appliedScore();

            evaluatedAnswers.add(evaluatedAnswer);
            scoreByQuestionNo.put(question.questionNo(), appliedScore);
            totalScore += appliedScore;

            if (question.questionNo() <= CRI_SELF_OTHER_END_NO) {
                selfOtherTotal += appliedScore;
            } else if (question.questionNo() <= CRI_MENTAL_END_NO) {
                mentalTotal += appliedScore;
            } else if (question.questionNo() <= CRI_FUNCTION_END_NO) {
                functionTotal += appliedScore;
            } else {
                supportTotal += appliedScore;
            }
        }

        int risk8PlusMental = scoreByQuestionNo.getOrDefault(CRI_SELF_OTHER_RISK_EIGHT_QUESTION_NO, 0) + mentalTotal;
        String resultLevelCode = resolveCriResultLevelCode(
                scoreByQuestionNo.getOrDefault(CRI_SELF_OTHER_RISK_PRESENT_QUESTION_NO, 0),
                scoreByQuestionNo.getOrDefault(CRI_SELF_OTHER_RISK_EIGHT_QUESTION_NO, 0),
                selfOtherTotal,
                mentalTotal
        );
        String resultLevel = formatCriResultLevel(definition, resultLevelCode);

        return buildScaleEvaluation(
                definition,
                totalScore,
                resultLevelCode,
                resultLevel,
                evaluatedAnswers,
                List.of(
                        new ResultDetail("selfOtherTotal", "자타해 위험 합계", Integer.toString(selfOtherTotal)),
                        new ResultDetail("mentalTotal", "정신상태 합계", Integer.toString(mentalTotal)),
                        new ResultDetail("functionTotal", "기능수준 합계", Integer.toString(functionTotal)),
                        new ResultDetail("supportTotal", "지지체계 합계", Integer.toString(supportTotal)),
                        new ResultDetail("risk8PlusMental", "자타해 위험 8번 + 정신상태 합계", Integer.toString(risk8PlusMental))
                )
        );
    }

    private void validateAnswerQuestionNumbers(Map<Integer, AnswerRequest> answerMap, Map<Integer, ScaleQuestion> questionsByNo) {
        for (Integer questionNo : answerMap.keySet()) {
            if (!questionsByNo.containsKey(questionNo)) {
                throw new AppException(HttpStatus.BAD_REQUEST, "ANSWER_QUESTION_INVALID", "존재하지 않는 문항 번호입니다.");
            }
        }
    }

    private EvaluatedAnswer evaluateAnswer(ScaleQuestion question, AnswerRequest answerRequest) {
        ScaleOption option = question.options().stream()
                .filter(candidate -> candidate.value().equals(answerRequest.answerValue()))
                .findFirst()
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "ANSWER_VALUE_INVALID", "허용되지 않은 응답값입니다."));
        int appliedScore = question.reverseScored() ? reverseScore(option.score(), question.options()) : option.score();
        return new EvaluatedAnswer(question, option, appliedScore);
    }

    private ScaleEvaluation buildScaleEvaluation(ScaleDefinition definition, int totalScore, List<EvaluatedAnswer> evaluatedAnswers) {
        ResolvedResultLevel resultLevel = resolveInterpretationResultLevel(definition, totalScore);
        return buildScaleEvaluation(definition, totalScore, resultLevel.code(), resultLevel.label(), evaluatedAnswers, List.of());
    }

    private ScaleEvaluation buildScaleEvaluation(
            ScaleDefinition definition,
            int totalScore,
            String resultLevelCode,
            String resultLevel,
            List<EvaluatedAnswer> evaluatedAnswers,
            List<ResultDetail> resultDetails
    ) {
        List<SessionAlertData> alerts = buildAlertData(definition, totalScore, resultLevelCode, resultLevel, evaluatedAnswers);

        return new ScaleEvaluation(definition, totalScore, resultLevelCode, resultLevel, !alerts.isEmpty(), evaluatedAnswers, alerts, resultDetails);
    }

    private List<SessionAlertData> buildAlertData(
            ScaleDefinition definition,
            int totalScore,
            String resultLevelCode,
            String resultLevel,
            List<EvaluatedAnswer> evaluatedAnswers
    ) {
        List<SessionAlertData> alerts = new ArrayList<>();
        for (ScaleAlertRule rule : definition.alertRules()) {
            List<String> targetQuestionKeys = resolveTargetQuestionKeys(rule);
            if (!targetQuestionKeys.isEmpty() && rule.minAnswerValue() != null) {
                evaluatedAnswers.stream()
                        .filter(answer -> targetQuestionKeys.contains(answer.question().questionKey()))
                        .filter(answer -> Integer.parseInt(answer.option().value()) >= rule.minAnswerValue())
                        .findFirst()
                        .ifPresent(answer -> alerts.add(new SessionAlertData(
                                AlertType.valueOf(rule.type()),
                                rule.code(),
                                rule.message(),
                                answer.question().questionNo(),
                                answer.option().value()
                        )));
            } else if (rule.minTotalScore() != null && totalScore >= rule.minTotalScore()) {
                alerts.add(new SessionAlertData(
                        AlertType.valueOf(rule.type()),
                        rule.code(),
                        rule.message(),
                        null,
                        Integer.toString(totalScore)
                ));
            } else if (matchesResultLevel(rule, resultLevelCode)) {
                alerts.add(new SessionAlertData(
                        AlertType.valueOf(rule.type()),
                        rule.code(),
                        rule.message(),
                        null,
                        resultLevel
                ));
            }
        }

        return alerts;
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

    private List<String> resolveTargetQuestionKeys(ScaleAlertRule rule) {
        if (rule.questionKeys() != null && !rule.questionKeys().isEmpty()) {
            return rule.questionKeys().stream()
                    .filter(Objects::nonNull)
                    .toList();
        }
        if (rule.questionKey() != null) {
            return List.of(rule.questionKey());
        }
        return List.of();
    }

    private boolean matchesResultLevel(ScaleAlertRule rule, String resultLevelCode) {
        String normalizedResultLevelCode = blankToNull(resultLevelCode);
        if (normalizedResultLevelCode == null || rule.resultLevelCodes() == null || rule.resultLevelCodes().isEmpty()) {
            return false;
        }
        return rule.resultLevelCodes().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(code -> !code.isEmpty())
                .anyMatch(code -> code.equalsIgnoreCase(normalizedResultLevelCode));
    }

    private ResolvedResultLevel resolveInterpretationResultLevel(ScaleDefinition definition, int totalScore) {
        return definition.interpretationRules().stream()
                .filter(rule -> matches(rule, totalScore))
                .findFirst()
                .map(rule -> new ResolvedResultLevel(blankToNull(rule.code()), rule.label()))
                .orElse(new ResolvedResultLevel(null, "미분류"));
    }

    private boolean matches(InterpretationRule rule, int totalScore) {
        return totalScore >= rule.min() && totalScore <= rule.max();
    }

    private String toJsonSnapshot(ScaleEvaluation evaluation) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("scaleCode", evaluation.definition().scaleCode());
        snapshot.put("scaleName", evaluation.definition().scaleName());
        snapshot.put("scaleVersion", evaluation.definition().version());
        snapshot.put("totalScore", evaluation.totalScore());
        snapshot.put("resultLevelCode", evaluation.resultLevelCode());
        snapshot.put("resultLevel", evaluation.resultLevel());
        snapshot.put("screenPositive",
                evaluation.definition().screeningThreshold() != null && evaluation.totalScore() >= evaluation.definition().screeningThreshold());
        snapshot.put("answers", evaluation.answers().stream().map(answer -> Map.of(
                "questionNo", answer.question().questionNo(),
                "questionKey", answer.question().questionKey(),
                "answerValue", answer.option().value(),
                "scoreValue", answer.appliedScore()
        )).toList());
        snapshot.put("resultDetails", evaluation.resultDetails().stream().map(detail -> Map.of(
                "key", detail.key(),
                "label", detail.label(),
                "value", detail.value()
        )).toList());
        snapshot.put("alerts", evaluation.alerts().stream().map(alert -> Map.of(
                "code", alert.code(),
                "type", alert.alertType().name(),
                "message", alert.message()
        )).toList());

        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "SNAPSHOT_SERIALIZE_FAILED", "결과 스냅샷 생성에 실패했습니다.");
        }
    }

    private SessionAlertResponse toAlertResponse(SessionAlert alert) {
        return new SessionAlertResponse(
                alert.getId(),
                alert.getScaleCode(),
                alert.getAlertType().name(),
                alert.getAlertCode(),
                alert.getAlertMessage(),
                alert.getQuestionNo(),
                alert.getTriggerValue()
        );
    }

    private String formatDateTime(LocalDateTime value) {
        return SeoulDateTimeSupport.formatDateTime(value);
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String resolveCriResultLevelCode(
            int selfOtherQuestionOneScore,
            int selfOtherQuestionEightScore,
            int selfOtherTotal,
            int mentalTotal
    ) {
        int risk8PlusMental = selfOtherQuestionEightScore + mentalTotal;

        if (selfOtherQuestionOneScore == 1 && selfOtherTotal >= 2) {
            return risk8PlusMental >= 1 ? "A" : "B";
        }
        if (selfOtherTotal >= 1) {
            return risk8PlusMental >= 1 ? "C" : "D";
        }
        return "E";
    }

    private String formatCriResultLevel(ScaleDefinition definition, String resultLevelCode) {
        String normalizedResultLevelCode = blankToNull(resultLevelCode);
        if (normalizedResultLevelCode == null) {
            throw new AppException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "CRI_RESULT_LEVEL_INVALID",
                    "CRI 결과 레벨 계산에 실패했습니다."
            );
        }

        String normalizedCodeKey = normalizedResultLevelCode.toUpperCase(Locale.ROOT);
        String label = resolveCriResultLevelLabels(definition).get(normalizedCodeKey);
        if (label == null) {
            throw new AppException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "CRI_RESULT_LEVEL_LABEL_MISSING",
                    "CRI 결과 레벨 표시 문구를 찾을 수 없습니다."
            );
        }
        return normalizedCodeKey + " - " + label;
    }

    private Map<String, String> resolveCriResultLevelLabels(ScaleDefinition definition) {
        if (definition.metadata() == null
                || definition.metadata().resultLevelLabels() == null
                || definition.metadata().resultLevelLabels().isEmpty()) {
            throw new AppException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "CRI_RESULT_LEVEL_METADATA_MISSING",
                    "CRI 결과 레벨 표시 문구 metadata 구성이 올바르지 않습니다."
            );
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
            throw new AppException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "CRI_RESULT_LEVEL_METADATA_MISSING",
                    "CRI 결과 레벨 표시 문구 metadata 구성이 올바르지 않습니다."
            );
        }
        return resultLevelLabels;
    }

    private List<SessionScaleResultDetailResponse> readResultDetails(SessionScale scale) {
        try {
            JsonNode root = objectMapper.readTree(scale.getRawResultSnapshot());
            JsonNode resultDetailsNode = root.path("resultDetails");
            if (!resultDetailsNode.isArray()) {
                return List.of();
            }

            List<SessionScaleResultDetailResponse> resultDetails = new ArrayList<>();
            for (JsonNode item : resultDetailsNode) {
                String key = item.path("key").asText(null);
                String label = item.path("label").asText(null);
                String value = item.path("value").asText(null);
                if (key == null || label == null || value == null) {
                    continue;
                }
                resultDetails.add(new SessionScaleResultDetailResponse(key, label, value));
            }
            return resultDetails;
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private int reverseScore(int rawScore, List<ScaleOption> options) {
        int minScore = options.stream().mapToInt(ScaleOption::score).min()
                .orElseThrow(() -> new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "SCALE_OPTION_INVALID", "척도 옵션 구성이 올바르지 않습니다."));
        int maxScore = options.stream().mapToInt(ScaleOption::score).max()
                .orElseThrow(() -> new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "SCALE_OPTION_INVALID", "척도 옵션 구성이 올바르지 않습니다."));
        return minScore + maxScore - rawScore;
    }

    private record EvaluatedAnswer(ScaleQuestion question, ScaleOption option, int appliedScore) {
    }

    private record SessionAlertData(
            AlertType alertType,
            String code,
            String message,
            Integer questionNo,
            String triggerValue
    ) {
    }

    private record ScaleEvaluation(
            ScaleDefinition definition,
            int totalScore,
            String resultLevelCode,
            String resultLevel,
            boolean hasAlert,
            List<EvaluatedAnswer> answers,
            List<SessionAlertData> alerts,
            List<ResultDetail> resultDetails
    ) {
    }

    private record ResolvedResultLevel(
            String code,
            String label
    ) {
    }

    private record ResultDetail(
            String key,
            String label,
            String value
    ) {
    }
}
