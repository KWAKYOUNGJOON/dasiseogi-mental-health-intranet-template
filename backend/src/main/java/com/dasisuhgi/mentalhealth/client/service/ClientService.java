package com.dasisuhgi.mentalhealth.client.service;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionAlert;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentQueryRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentSessionRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.ClientScaleTrendPointRow;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionAlertRepository;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionAlertResponse;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.client.dto.ClientCreateResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientDetailResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientListItemResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientScaleTrendResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientStatusChangeResponse;
import com.dasisuhgi.mentalhealth.client.dto.CreateClientRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCandidateResponse;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckResponse;
import com.dasisuhgi.mentalhealth.client.dto.MarkMisregisteredRequest;
import com.dasisuhgi.mentalhealth.client.dto.RecentSessionSummaryQueryRow;
import com.dasisuhgi.mentalhealth.client.dto.RecentSessionSummaryResponse;
import com.dasisuhgi.mentalhealth.client.dto.UpdateClientRequest;
import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.client.entity.Gender;
import com.dasisuhgi.mentalhealth.client.repository.ClientQueryRepository;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.sequence.IdentifierGeneratorService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService.ScaleTrendMetadata;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClientService {
    private static final java.time.format.DateTimeFormatter DATE_FORMAT = java.time.format.DateTimeFormatter.ISO_LOCAL_DATE;

    private final ClientRepository clientRepository;
    private final ClientQueryRepository clientQueryRepository;
    private final UserRepository userRepository;
    private final AssessmentSessionRepository assessmentSessionRepository;
    private final AssessmentQueryRepository assessmentQueryRepository;
    private final SessionAlertRepository sessionAlertRepository;
    private final AccessPolicyService accessPolicyService;
    private final IdentifierGeneratorService identifierGeneratorService;
    private final ActivityLogService activityLogService;
    private final ScaleService scaleService;

    public ClientService(
            ClientRepository clientRepository,
            ClientQueryRepository clientQueryRepository,
            UserRepository userRepository,
            AssessmentSessionRepository assessmentSessionRepository,
            AssessmentQueryRepository assessmentQueryRepository,
            SessionAlertRepository sessionAlertRepository,
            AccessPolicyService accessPolicyService,
            IdentifierGeneratorService identifierGeneratorService,
            ActivityLogService activityLogService,
            ScaleService scaleService
    ) {
        this.clientRepository = clientRepository;
        this.clientQueryRepository = clientQueryRepository;
        this.userRepository = userRepository;
        this.assessmentSessionRepository = assessmentSessionRepository;
        this.assessmentQueryRepository = assessmentQueryRepository;
        this.sessionAlertRepository = sessionAlertRepository;
        this.accessPolicyService = accessPolicyService;
        this.identifierGeneratorService = identifierGeneratorService;
        this.activityLogService = activityLogService;
        this.scaleService = scaleService;
    }

    @Transactional(readOnly = true)
    public PageResponse<ClientListItemResponse> getClients(
            String name,
            String birthDate,
            Long primaryWorkerId,
            boolean includeMisregistered,
            int page,
            int size,
            SessionUser sessionUser
    ) {
        if (page < 1 || size < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_PAGE_REQUEST", "페이지 요청 값을 다시 확인해주세요.");
        }
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        return clientQueryRepository.findClients(
                name,
                parseBirthDate(birthDate),
                primaryWorkerId,
                includeMisregistered,
                currentUser.getId(),
                accessPolicyService.isAdmin(currentUser),
                page,
                size
        );
    }

    @Transactional(readOnly = true)
    public DuplicateCheckResponse duplicateCheck(DuplicateCheckRequest request) {
        List<DuplicateCandidateResponse> candidates = clientRepository.findAllByNameAndBirthDate(request.name().trim(), request.birthDate()).stream()
                .map(client -> new DuplicateCandidateResponse(
                        client.getId(),
                        client.getClientNo(),
                        client.getName(),
                        DATE_FORMAT.format(client.getBirthDate()),
                        client.getGender().name(),
                        client.getPrimaryWorker().getName(),
                        client.getStatus().name()
                ))
                .toList();
        return new DuplicateCheckResponse(!candidates.isEmpty(), candidates);
    }

    @Transactional
    public ClientCreateResponse createClient(CreateClientRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        User primaryWorker = userRepository.findById(Objects.requireNonNull(request.primaryWorkerId(), "primaryWorkerId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "PRIMARY_WORKER_NOT_FOUND", "담당자를 찾을 수 없습니다."));
        if (primaryWorker.getStatus() != UserStatus.ACTIVE) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PRIMARY_WORKER_NOT_ACTIVE", "활성 사용자만 담당자로 지정할 수 있습니다.");
        }

        Client client = new Client();
        client.setClientNo(identifierGeneratorService.nextClientNo(SeoulDateTimeSupport.today()));
        client.setName(request.name().trim());
        client.setGender(parseGender(request.gender()));
        client.setBirthDate(request.birthDate());
        client.setPhone(blankToNull(request.phone()));
        client.setPrimaryWorker(primaryWorker);
        client.setCreatedBy(currentUser);
        client.setStatus(ClientStatus.ACTIVE);

        Client saved = clientRepository.save(client);
        activityLogService.logBestEffort(
                currentUser,
                ActivityActionType.CLIENT_CREATE,
                ActivityTargetType.CLIENT,
                saved.getId(),
                saved.getName(),
                "대상자 등록"
        );
        return new ClientCreateResponse(saved.getId(), saved.getClientNo());
    }

    @Transactional(readOnly = true)
    public ClientDetailResponse getClientDetail(Long clientId, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        Client client = clientRepository.findById(Objects.requireNonNull(clientId, "clientId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "대상자를 찾을 수 없습니다."));
        accessPolicyService.assertCanViewClient(currentUser, client);

        List<RecentSessionSummaryResponse> recentSessions = assessmentSessionRepository
                .findRecentSessionSummaries(clientId, AssessmentSessionStatus.COMPLETED, PageRequest.of(0, 10))
                .stream()
                .map(this::toRecentSession)
                .toList();
        String latestRecordedScaleCode = assessmentQueryRepository.findLatestRecordedScaleCode(
                clientId,
                scaleService.getOperatingScaleCodes()
        );

        return new ClientDetailResponse(
                client.getId(),
                client.getClientNo(),
                client.getName(),
                client.getGender().name(),
                DATE_FORMAT.format(client.getBirthDate()),
                client.getPhone(),
                formatDateTime(client.getRegisteredAt()),
                client.getCreatedBy().getId(),
                client.getCreatedBy().getName(),
                client.getPrimaryWorker().getId(),
                client.getPrimaryWorker().getName(),
                client.getStatus().name(),
                formatDateTime(client.getMisregisteredAt()),
                client.getMisregisteredBy() == null ? null : client.getMisregisteredBy().getId(),
                client.getMisregisteredBy() == null ? null : client.getMisregisteredBy().getName(),
                client.getMisregisteredReason(),
                latestRecordedScaleCode,
                recentSessions
        );
    }

    @Transactional(readOnly = true)
    public ClientScaleTrendResponse getClientScaleTrend(Long clientId, String scaleCode, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        Client client = clientRepository.findById(Objects.requireNonNull(clientId, "clientId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "대상자를 찾을 수 없습니다."));
        accessPolicyService.assertCanViewClient(currentUser, client);

        String normalizedScaleCode = normalizeScaleCode(scaleCode);
        ScaleTrendMetadata trendMetadata = scaleService.getScaleTrendMetadata(normalizedScaleCode);
        List<ClientScaleTrendPointRow> pointRows = assessmentQueryRepository.findClientScaleTrendPoints(clientId, normalizedScaleCode);

        Map<Long, List<SessionAlertResponse>> alertsBySessionScaleId = loadAlertsBySessionScaleId(pointRows);
        List<ClientScaleTrendResponse.PointResponse> points = pointRows.stream()
                .map(point -> new ClientScaleTrendResponse.PointResponse(
                        point.sessionId(),
                        point.sessionScaleId(),
                        formatDateTime(point.assessedAt()),
                        formatDateTime(point.createdAt()),
                        point.totalScore().intValue(),
                        point.resultLevel(),
                        alertsBySessionScaleId.getOrDefault(point.sessionScaleId(), List.of())
                ))
                .toList();

        return new ClientScaleTrendResponse(
                trendMetadata.scaleCode(),
                trendMetadata.scaleName(),
                trendMetadata.maxScore(),
                trendMetadata.cutoffs().stream()
                        .map(cutoff -> new ClientScaleTrendResponse.CutoffResponse(
                                cutoff.score(),
                                cutoff.label()
                        ))
                        .toList(),
                points
        );
    }

    @Transactional
    public ClientDetailResponse updateClient(Long clientId, UpdateClientRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        Client client = clientRepository.findById(Objects.requireNonNull(clientId, "clientId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "대상자를 찾을 수 없습니다."));
        accessPolicyService.assertCanUpdateClient(currentUser, client);

        User primaryWorker = userRepository.findById(Objects.requireNonNull(request.primaryWorkerId(), "primaryWorkerId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "PRIMARY_WORKER_NOT_FOUND", "담당자를 찾을 수 없습니다."));
        if (primaryWorker.getStatus() != UserStatus.ACTIVE) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PRIMARY_WORKER_NOT_ACTIVE", "활성 사용자만 담당자로 지정할 수 있습니다.");
        }

        client.setName(request.name().trim());
        client.setGender(parseGender(request.gender()));
        client.setBirthDate(request.birthDate());
        client.setPhone(blankToNull(request.phone()));
        client.setPrimaryWorker(primaryWorker);

        activityLogService.logBestEffort(
                currentUser,
                ActivityActionType.CLIENT_UPDATE,
                ActivityTargetType.CLIENT,
                client.getId(),
                client.getName(),
                "대상자 수정"
        );

        return getClientDetail(clientId, sessionUser);
    }

    @Transactional
    public ClientStatusChangeResponse markMisregistered(Long clientId, MarkMisregisteredRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        Client client = clientRepository.findById(Objects.requireNonNull(clientId, "clientId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "대상자를 찾을 수 없습니다."));
        accessPolicyService.assertCanMarkClientMisregistered(currentUser, client);
        if (client.getStatus() == ClientStatus.MISREGISTERED) {
            throw new AppException(HttpStatus.CONFLICT, "CLIENT_ALREADY_MISREGISTERED", "이미 오등록 처리된 대상자입니다.");
        }

        client.setStatus(ClientStatus.MISREGISTERED);
        client.setMisregisteredAt(SeoulDateTimeSupport.now());
        client.setMisregisteredBy(currentUser);
        client.setMisregisteredReason(request.reason().trim());
        activityLogService.logBestEffort(
                currentUser,
                ActivityActionType.CLIENT_MARK_MISREGISTERED,
                ActivityTargetType.CLIENT,
                client.getId(),
                client.getName(),
                "대상자 오등록 처리"
        );

        return new ClientStatusChangeResponse(
                client.getId(),
                client.getStatus().name(),
                formatDateTime(client.getMisregisteredAt())
        );
    }

    private RecentSessionSummaryResponse toRecentSession(RecentSessionSummaryQueryRow session) {
        return new RecentSessionSummaryResponse(
                session.id(),
                session.sessionNo(),
                formatDateTime(session.sessionCompletedAt()),
                session.performedByName(),
                session.scaleCount(),
                session.hasAlert(),
                session.status().name()
        );
    }

    private Map<Long, List<SessionAlertResponse>> loadAlertsBySessionScaleId(List<ClientScaleTrendPointRow> pointRows) {
        List<Long> sessionScaleIds = pointRows.stream()
                .map(ClientScaleTrendPointRow::sessionScaleId)
                .toList();
        if (sessionScaleIds.isEmpty()) {
            return Map.of();
        }

        return sessionAlertRepository.findBySessionScaleIdInOrderBySessionScaleIdAscIdAsc(sessionScaleIds).stream()
                .collect(Collectors.groupingBy(
                        alert -> alert.getSessionScale().getId(),
                        LinkedHashMap::new,
                        Collectors.mapping(this::toAlertResponse, Collectors.toList())
                ));
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

    private Gender parseGender(String rawGender) {
        try {
            return Gender.valueOf(rawGender.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_GENDER", "유효한 성별 값을 입력해주세요.");
        }
    }

    private String formatDateTime(LocalDateTime value) {
        return SeoulDateTimeSupport.formatDateTime(value);
    }

    private String normalizeScaleCode(String scaleCode) {
        return Objects.requireNonNull(scaleCode, "scaleCode must not be null").trim().toUpperCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private LocalDate parseBirthDate(String birthDate) {
        if (birthDate == null || birthDate.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(birthDate.trim(), DATE_FORMAT);
        } catch (RuntimeException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_BIRTH_DATE", "생년월일 형식을 다시 확인해주세요.");
        }
    }
}
