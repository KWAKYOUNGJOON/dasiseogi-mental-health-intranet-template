package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityLog;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionAlert;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionScale;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentSessionRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionAlertRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionScaleRepository;
import com.dasisuhgi.mentalhealth.backup.entity.BackupHistory;
import com.dasisuhgi.mentalhealth.backup.entity.BackupMethod;
import com.dasisuhgi.mentalhealth.backup.repository.BackupHistoryRepository;
import com.dasisuhgi.mentalhealth.backup.service.BackupService;
import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.client.entity.Gender;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.sequence.IdentifierSequenceRepository;
import com.dasisuhgi.mentalhealth.common.web.RequestMetadataService;
import com.dasisuhgi.mentalhealth.signup.entity.UserApprovalRequest;
import com.dasisuhgi.mentalhealth.signup.repository.UserApprovalRequestRepository;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(SessionSaveFailureTestConfig.class)
class CoreWorkflowIntegrationTest {
    private static final DateTimeFormatter YEAR_MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyyMM");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private BackupHistoryRepository backupHistoryRepository;

    @Autowired
    private UserApprovalRequestRepository userApprovalRequestRepository;

    @Autowired
    private BackupService backupService;

    @Autowired
    private RequestMetadataService requestMetadataService;

    @Autowired
    private AssessmentSessionRepository assessmentSessionRepository;

    @Autowired
    private SessionScaleRepository sessionScaleRepository;

    @Autowired
    private SessionAlertRepository sessionAlertRepository;

    @Autowired
    private IdentifierSequenceRepository identifierSequenceRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private ControllableSessionSaveFailureSimulator sessionSaveFailureSimulator;

    @BeforeEach
    void setUp() {
        sessionSaveFailureSimulator.reset();
    }

    @Test
    void loginSuccessReturnsSessionUser() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "loginId", "usera",
                                "password", "Test1234!"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.user.loginId").value("usera"))
                .andExpect(jsonPath("$.data.user.role").value("USER"))
                .andExpect(jsonPath("$.data.sessionTimeoutMinutes").value(120));
    }

    @Test
    void loginSuccessCreatesActivityLog() throws Exception {
        User user = findUser("usera");

        mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Forwarded-For", "203.0.113.10, 10.0.0.5")
                        .with(request -> {
                            request.setRemoteAddr("127.0.0.55");
                            return request;
                        })
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "loginId", "usera",
                                "password", "Test1234!"
                        ))))
                .andExpect(status().isOk());

        ActivityLog log = latestActivityLog(ActivityActionType.LOGIN);
        assertThat(log.getUserId()).isEqualTo(user.getId());
        assertThat(log.getUserNameSnapshot()).isEqualTo(user.getName());
        assertThat(log.getTargetId()).isEqualTo(user.getId());
        assertThat(log.getTargetLabel()).isEqualTo("usera");
        assertThat(log.getDescription()).isEqualTo("로그인 성공");
        assertThat(log.getIpAddress()).isEqualTo("127.0.0.55");
    }

    @Test
    void trustedProxyHeaderIsUsedWhenEnabled() throws Exception {
        ReflectionTestUtils.setField(requestMetadataService, "trustProxyHeaders", true);
        try {
            mockMvc.perform(post("/api/v1/auth/login")
                            .header("X-Forwarded-For", "203.0.113.10, 10.0.0.5")
                            .with(request -> {
                                request.setRemoteAddr("127.0.0.66");
                                return request;
                            })
                            .contentType(APPLICATION_JSON)
                            .content(json(Map.of(
                                    "loginId", "usera",
                                    "password", "Test1234!"
                            ))))
                    .andExpect(status().isOk());

            ActivityLog log = latestActivityLog(ActivityActionType.LOGIN);
            assertThat(log.getIpAddress()).isEqualTo("203.0.113.10");
        } finally {
            ReflectionTestUtils.setField(requestMetadataService, "trustProxyHeaders", false);
        }
    }

    @Test
    void loginFailureReturnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "loginId", "usera",
                                "password", "wrong-password"
                        ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("LOGIN_FAILED"));
    }

    @Test
    void signupRequestCreatesUserApprovalRequest() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/signup-requests")
                        .header("X-Forwarded-For", "198.51.100.20")
                        .with(request -> {
                            request.setRemoteAddr("127.0.0.77");
                            return request;
                        })
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "신규신청자",
                                "loginId", "newsignup",
                                "password", "Test1234!",
                                "phone", "010-3333-4444",
                                "positionName", "사회복지사",
                                "teamName", "정신건강팀",
                                "requestMemo", "신규 입사"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.requestStatus").value("PENDING"))
                .andReturn();

        long requestId = body(result).path("data").path("requestId").asLong();
        long userId = body(result).path("data").path("userId").asLong();
        User createdUser = userRepository.findById(userId).orElseThrow();
        UserApprovalRequest approvalRequest = userApprovalRequestRepository.findById(requestId).orElseThrow();

        assertThat(createdUser.getStatus().name()).isEqualTo("PENDING");
        assertThat(approvalRequest.getUserId()).isEqualTo(createdUser.getId());
        assertThat(approvalRequest.getRequestedLoginId()).isEqualTo("newsignup");
        assertThat(approvalRequest.getRequestedName()).isEqualTo("신규신청자");
        assertThat(approvalRequest.getRequestStatus().name()).isEqualTo("PENDING");
        assertThat(approvalRequest.getRequestMemo()).isEqualTo("신규 입사");
        assertThat(hasActivityLog(ActivityActionType.SIGNUP_REQUEST, requestId)).isTrue();
        assertThat(latestActivityLog(ActivityActionType.SIGNUP_REQUEST).getIpAddress()).isEqualTo("127.0.0.77");
    }

    @Test
    void healthEndpointReturnsUp() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("UP"))
                .andExpect(jsonPath("$.data.appStatus").value("UP"))
                .andExpect(jsonPath("$.data.dbStatus").value("UP"))
                .andExpect(jsonPath("$.data.scaleRegistryStatus").value("UP"))
                .andExpect(jsonPath("$.data.loadedScaleCount").isNumber());
    }

    @Test
    void createClientGeneratesStableIdentifierAndDefaultListHidesMisregisteredAndPhone() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        String expectedYearMonth = LocalDate.now().format(YEAR_MONTH_FORMAT);

        String firstClientNo = createClient(session, "신규대상A", "1993-04-15");
        String secondClientNo = createClient(session, "신규대상B", "1994-04-15");

        assertThat(firstClientNo).isEqualTo("CL-%s-0001".formatted(expectedYearMonth));
        assertThat(secondClientNo).isEqualTo("CL-%s-0002".formatted(expectedYearMonth));
        assertThat(identifierSequenceRepository.count()).isEqualTo(2L);

        MvcResult listResult = mockMvc.perform(get("/api/v1/clients").session(session))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode items = body(listResult).path("data").path("items");
        assertThat(textValues(items, "name"))
                .contains("신규대상A", "신규대상B")
                .doesNotContain("오등록대상");
        assertThat(hasField(items, "phone")).isFalse();
    }

    @Test
    void clientsListUsesProjectionFiltersAndPaginationAtDatabaseLevel() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        User userB = findUser("userb");

        Client olderClient = saveClient("목록투영대상", LocalDate.of(1995, 5, 5), userA, ClientStatus.ACTIVE);
        olderClient.setPrimaryWorker(userA);
        clientRepository.save(olderClient);
        saveSession(olderClient, userA, "AS-CLIENT-001", AssessmentSessionStatus.COMPLETED, LocalDateTime.of(2026, 3, 20, 10, 0));

        Client newerClient = saveClient("목록투영대상", LocalDate.of(1995, 5, 5), userA, ClientStatus.ACTIVE);
        newerClient.setPrimaryWorker(userA);
        clientRepository.save(newerClient);
        saveSession(newerClient, userA, "AS-CLIENT-002", AssessmentSessionStatus.COMPLETED, LocalDateTime.of(2026, 3, 28, 10, 0));

        Client otherWorkerClient = saveClient("목록투영대상", LocalDate.of(1995, 5, 5), userA, ClientStatus.ACTIVE);
        otherWorkerClient.setPrimaryWorker(userB);
        clientRepository.save(otherWorkerClient);

        Client misregisteredClient = saveClient("목록투영대상", LocalDate.of(1995, 5, 5), userA, ClientStatus.MISREGISTERED);
        misregisteredClient.setPrimaryWorker(userA);
        clientRepository.save(misregisteredClient);

        mockMvc.perform(get("/api/v1/clients")
                        .session(session)
                        .param("name", "목록투영")
                        .param("birthDate", "1995-05-05")
                        .param("primaryWorkerId", String.valueOf(userA.getId()))
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items[0].id").value(newerClient.getId()))
                .andExpect(jsonPath("$.data.items[0].latestSessionDate").value("2026-03-28"));

        mockMvc.perform(get("/api/v1/clients")
                        .session(session)
                        .param("name", "목록투영")
                        .param("birthDate", "1995-05-05")
                        .param("primaryWorkerId", String.valueOf(userA.getId()))
                        .param("page", "2")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(olderClient.getId()))
                .andExpect(jsonPath("$.data.items[0].latestSessionDate").value("2026-03-20"));
    }

    @Test
    void markClientMisregisteredSuccessAndPermissionRulesAreEnforced() throws Exception {
        MockHttpSession ownerSession = login("usera", "Test1234!");
        MockHttpSession otherSession = login("userb", "Test1234!");
        MockHttpSession adminSession = login("admina", "Test1234!");
        Client client = createClientAndFind(ownerSession, "오등록후보", "1988-02-03");

        mockMvc.perform(post("/api/v1/clients/{clientId}/mark-misregistered", client.getId())
                        .session(otherSession)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "권한 없음 테스트"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("CLIENT_MARK_MISREGISTERED_FORBIDDEN"));

        mockMvc.perform(post("/api/v1/clients/{clientId}/mark-misregistered", client.getId())
                        .session(ownerSession)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "중복 등록 확인"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("MISREGISTERED"))
                .andExpect(jsonPath("$.data.processedAt").isString());

        Client updated = clientRepository.findById(client.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ClientStatus.MISREGISTERED);
        assertThat(updated.getMisregisteredReason()).isEqualTo("중복 등록 확인");
        assertThat(updated.getMisregisteredBy()).isNotNull();
        assertThat(updated.getMisregisteredAt()).isNotNull();

        assertThat(textValues(dataArray("/api/v1/clients", ownerSession), "name"))
                .doesNotContain("오등록후보");
        assertThat(textValues(dataArray("/api/v1/clients?includeMisregistered=true", ownerSession), "name"))
                .contains("오등록후보");
        assertThat(textValues(dataArray("/api/v1/clients?includeMisregistered=true", otherSession), "name"))
                .doesNotContain("오등록후보");
        assertThat(textValues(dataArray("/api/v1/clients?includeMisregistered=true", adminSession), "name"))
                .contains("오등록후보");
    }

    @Test
    void clientCreateAndMisregisteredActionsCreateActivityLogs() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        createClient(session, "로그대상자", "1988-08-08");
        Client client = findClient("로그대상자", LocalDate.of(1988, 8, 8));

        mockMvc.perform(post("/api/v1/clients/{clientId}/mark-misregistered", client.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "로그 검증"))))
                .andExpect(status().isOk());

        assertThat(hasActivityLog(ActivityActionType.CLIENT_CREATE, client.getId())).isTrue();
        assertThat(hasActivityLog(ActivityActionType.CLIENT_MARK_MISREGISTERED, client.getId())).isTrue();
    }

    @Test
    void savePhq9SessionAndFetchDetailUseServerCalculatedScoreAndAlert() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(validPhq9SaveRequest(client.getId(), "상담 중 수면 문제 호소"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.scaleCount").value(1))
                .andExpect(jsonPath("$.data.hasAlert").value(true))
                .andExpect(jsonPath("$.data.sessionNo").value("AS-20260328-0001"))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memo").value("상담 중 수면 문제 호소"))
                .andExpect(jsonPath("$.data.hasAlert").value(true))
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(1))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("최소"))
                .andExpect(jsonPath("$.data.scales[0].answers[8].answerValue").value("1"))
                .andExpect(jsonPath("$.data.alerts[0].alertCode").value("PHQ9_ITEM9_ANY"))
                .andExpect(jsonPath("$.data.alerts[0].questionNo").value(9));
    }

    @Test
    void saveSessionGeneratesSequentialSessionNumberForSameDay() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(validPhq9SaveRequest(client.getId(), "첫 번째 세션"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.sessionNo").value("AS-20260328-0001"));

        mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(validPhq9SaveRequest(client.getId(), "두 번째 세션"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.sessionNo").value("AS-20260328-0002"));
    }

    @Test
    void sessionSaveAndMisenteredActionsCreateActivityLogs() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        long sessionId = createAssessmentSession(session, client.getId(), "세션 로그");

        markMisentered(session, sessionId, "로그 검증");

        assertThat(hasActivityLog(ActivityActionType.SESSION_CREATE, sessionId)).isTrue();
        assertThat(hasActivityLog(ActivityActionType.SESSION_MARK_MISENTERED, sessionId)).isTrue();
    }

    @Test
    void printDataExcludesMemoAndIncludesSummaryFields() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        long sessionId = createAssessmentSession(session, client.getId(), "출력에서 숨겨야 할 메모");

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}/print-data", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.institutionName").isString())
                .andExpect(jsonPath("$.data.teamName").value("정신건강팀"))
                .andExpect(jsonPath("$.data.performedByName").value("사용자A"))
                .andExpect(jsonPath("$.data.client.name").value("김대상"))
                .andExpect(jsonPath("$.data.scaleCount").value(1))
                .andExpect(jsonPath("$.data.summaryText").isString())
                .andExpect(jsonPath("$.data.memo").doesNotExist());
    }

    @Test
    void adminCanFetchPrintDataForOwnSavedSession() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        long sessionId = createAssessmentSession(session, client.getId(), "관리자 출력 검증");

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}/print-data", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.teamName").value("정신건강팀"))
                .andExpect(jsonPath("$.data.performedByName").value("관리자A"))
                .andExpect(jsonPath("$.data.client.name").value("김대상"));
    }

    @Test
    void printDataUsesSamePermissionRuleForMisenteredSession() throws Exception {
        MockHttpSession ownerSession = login("usera", "Test1234!");
        MockHttpSession otherSession = login("userb", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        long sessionId = createAssessmentSession(ownerSession, client.getId(), "출력 권한");
        markMisentered(ownerSession, sessionId, "출력 금지");

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}/print-data", sessionId).session(otherSession))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("SESSION_VIEW_FORBIDDEN"));
    }

    @Test
    void printAndStatisticsExportCreateActivityLogs() throws Exception {
        MockHttpSession ownerSession = login("usera", "Test1234!");
        MockHttpSession adminSession = login("admina", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        long sessionId = createAssessmentSession(ownerSession, client.getId(), "출력 로그");

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}/print-data", sessionId).session(ownerSession))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/statistics/export")
                        .session(adminSession)
                        .param("type", "SUMMARY"))
                .andExpect(status().isOk());

        assertThat(hasActivityLog(ActivityActionType.PRINT_SESSION, sessionId)).isTrue();
        assertThat(activityLogRepository.findAll().stream()
                .anyMatch(log -> log.getActionType() == ActivityActionType.STATISTICS_EXPORT
                        && "SUMMARY".equals(log.getTargetLabel()))).isTrue();
    }

    @Test
    void saveGad7SessionCalculatesScoreLevelAndAlerts() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "GAD-7 저장", List.of(
                                scaleRequest("GAD7", 3, 3, 2, 2, 2, 2, 1)
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(1))
                .andExpect(jsonPath("$.data.hasAlert").value(true))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("GAD7"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(15))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("중증"))
                .andExpect(jsonPath("$.data.scales[0].alerts.length()").value(2))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("GAD7_TOTAL_10"))
                .andExpect(jsonPath("$.data.scales[0].alerts[1].alertCode").value("GAD7_TOTAL_15"));
    }

    @Test
    void savePss10SessionAppliesReverseScoringOnServer() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "PSS-10 저장", List.of(
                                scaleRequest("PSS10", 4, 4, 4, 4, 4, 4, 4, 4, 4, 4)
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(1))
                .andExpect(jsonPath("$.data.hasAlert").value(false))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("PSS10"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(24))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("공식 절단점 없음"))
                .andExpect(jsonPath("$.data.scales[0].answers[3].scoreValue").value(0))
                .andExpect(jsonPath("$.data.scales[0].answers[4].scoreValue").value(0))
                .andExpect(jsonPath("$.data.scales[0].answers[6].scoreValue").value(0))
                .andExpect(jsonPath("$.data.scales[0].answers[7].scoreValue").value(0));
    }

    @Test
    void saveIsikSessionCalculatesThresholdBasedAlert() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "ISI-K 저장", List.of(
                                scaleRequest("ISIK", 3, 3, 2, 2, 2, 2, 2)
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(1))
                .andExpect(jsonPath("$.data.hasAlert").value(true))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("ISIK"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(16))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("중등도 불면"))
                .andExpect(jsonPath("$.data.scales[0].alerts.length()").value(1))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("ISIK_TOTAL_16"));
    }

    @Test
    void saveAuditkSessionAppliesQ9Q10SpecialScores() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "AUDIT-K 점수", List.of(
                                scaleRequest("AUDITK", "0", "0", "0", "0", "0", "0", "0", "0", "2", "4")
                        )))))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("AUDITK"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(6))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("저위험"))
                .andExpect(jsonPath("$.data.scales[0].answers[8].scoreValue").value(2))
                .andExpect(jsonPath("$.data.scales[0].answers[9].scoreValue").value(4));
    }

    @Test
    void saveAuditkSessionCreatesAuxiliaryAlerts() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "AUDIT-K 경고", List.of(
                                scaleRequest("AUDITK", "0", "0", "0", "2", "0", "0", "0", "0", "0", "4")
                        )))))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].alerts.length()").value(2))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("AUDITK_DEPENDENCE_ITEMS"))
                .andExpect(jsonPath("$.data.scales[0].alerts[1].alertCode").value("AUDITK_HARM_ITEMS"));
    }

    @Test
    void saveIesrSessionCreatesCautionAt18() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "IES-R 주의", List.of(
                                scaleRequest("IESR", "2", "2", "2", "2", "2", "2", "2", "2", "2", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0")
                        )))))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(18))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("주의 필요"))
                .andExpect(jsonPath("$.data.scales[0].alerts.length()").value(1))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("IESR_TOTAL_18"));
    }

    @Test
    void saveIesrSessionCreatesHighRiskAt25() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "IES-R 고위험", List.of(
                                scaleRequest("IESR", "4", "4", "4", "4", "4", "4", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0")
                        )))))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(25))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("고위험 의심"))
                .andExpect(jsonPath("$.data.scales[0].alerts.length()").value(2))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("IESR_TOTAL_18"))
                .andExpect(jsonPath("$.data.scales[0].alerts[1].alertCode").value("IESR_TOTAL_25"));
    }

    @Test
    void saveKmdqSessionUsesModifiedKoreanPositiveRule() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "K-MDQ 저장", List.of(
                                scaleRequest("KMDQ", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N", "N", "N", "N", "N", "N", "N", "NONE")
                        )))))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("KMDQ"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(7))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("양성 의심"))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("KMDQ_POSITIVE"))
                .andExpect(jsonPath("$.data.scales[0].answers[13].answerValue").value("N"))
                .andExpect(jsonPath("$.data.scales[0].answers[14].answerValue").value("NONE"));
    }

    @Test
    void saveMkpq16SessionUsesYesCountRule() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "mKPQ 저장", List.of(
                                scaleRequest("MKPQ16", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N")
                        )))))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("MKPQ16"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(7))
                .andExpect(jsonPath("$.data.scales[0].resultLevel").value("양성 의심"))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("MKPQ16_POSITIVE"));
    }

    @Test
    void saveMkpq16RejectsObjectAnswerStructure() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        String invalidPayload = """
                {
                  "clientId": %d,
                  "sessionStartedAt": "2026-03-28T13:50:00",
                  "sessionCompletedAt": "2026-03-28T14:20:00",
                  "memo": "구조 오류",
                  "selectedScales": [
                    {
                      "scaleCode": "MKPQ16",
                      "answers": [
                        {
                          "questionNo": 1,
                          "answerValue": {
                            "value": "Y",
                            "distress": 2
                          }
                        }
                      ]
                    }
                  ]
                }
                """.formatted(client.getId());

        mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(invalidPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("ANSWER_STRUCTURE_INVALID"));
    }

    @Test
    void saveMultiScaleSessionWithPhq9AndGad7() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "PHQ9 + GAD7", List.of(
                                scaleRequest("PHQ9", 0, 0, 0, 0, 0, 0, 0, 0, 1),
                                scaleRequest("GAD7", 3, 3, 2, 2, 2, 2, 1)
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(2))
                .andExpect(jsonPath("$.data.hasAlert").value(true))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scales[1].scaleCode").value("GAD7"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(1))
                .andExpect(jsonPath("$.data.scales[1].totalScore").value(15));
    }

    @Test
    void saveMultiScaleSessionWithPhq9AndAuditk() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "PHQ9 + AUDITK", List.of(
                                scaleRequest("PHQ9", 0, 0, 0, 0, 0, 0, 0, 0, 1),
                                scaleRequest("AUDITK", "0", "0", "0", "2", "0", "0", "0", "0", "0", "4")
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(2))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scales[1].scaleCode").value("AUDITK"));
    }

    @Test
    void saveMultiScaleSessionWithPhq9Pss10AndIsik() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "3척도 저장", List.of(
                                scaleRequest("PHQ9", 0, 0, 0, 0, 0, 0, 0, 0, 0),
                                scaleRequest("PSS10", 4, 4, 4, 4, 4, 4, 4, 4, 4, 4),
                                scaleRequest("ISIK", 3, 3, 2, 2, 2, 2, 2)
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(3))
                .andExpect(jsonPath("$.data.hasAlert").value(true))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scales[1].scaleCode").value("PSS10"))
                .andExpect(jsonPath("$.data.scales[2].scaleCode").value("ISIK"))
                .andExpect(jsonPath("$.data.scales[1].totalScore").value(24))
                .andExpect(jsonPath("$.data.scales[2].totalScore").value(16));
    }

    @Test
    void saveMultiScaleSessionWithKmdqAndIesr() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "KMDQ + IESR", List.of(
                                scaleRequest("KMDQ", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N", "N", "N", "N", "N", "N", "Y", "SERIOUS"),
                                scaleRequest("IESR", "4", "4", "4", "4", "4", "4", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0")
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(2))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("KMDQ"))
                .andExpect(jsonPath("$.data.scales[1].scaleCode").value("IESR"));
    }

    @Test
    void markSessionMisenteredSuccessAndPermissionRulesAreEnforced() throws Exception {
        MockHttpSession ownerSession = login("usera", "Test1234!");
        MockHttpSession otherSession = login("userb", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        long sessionId = createAssessmentSession(ownerSession, client.getId(), "오입력 예정");

        mockMvc.perform(post("/api/v1/assessment-sessions/{sessionId}/mark-misentered", sessionId)
                        .session(otherSession)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "권한 없음 테스트"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("SESSION_MARK_MISENTERED_FORBIDDEN"));

        mockMvc.perform(post("/api/v1/assessment-sessions/{sessionId}/mark-misentered", sessionId)
                        .session(ownerSession)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "잘못된 대상자에게 입력함"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("MISENTERED"))
                .andExpect(jsonPath("$.data.misenteredAt").isString());

        AssessmentSession updated = assessmentSessionRepository.findById(sessionId).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(AssessmentSessionStatus.MISENTERED);
        assertThat(updated.getMisenteredReason()).isEqualTo("잘못된 대상자에게 입력함");
        assertThat(updated.getMisenteredBy()).isNotNull();
        assertThat(updated.getMisenteredAt()).isNotNull();
    }

    @Test
    void assessmentRecordsDefaultExcludeMisenteredAndIncludeMisenteredHasRoleAwareScope() throws Exception {
        MockHttpSession ownerSession = login("usera", "Test1234!");
        MockHttpSession otherSession = login("userb", "Test1234!");
        MockHttpSession adminSession = login("admina", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        long completedSessionId = createAssessmentSession(ownerSession, client.getId(), "정상 세션");
        long misenteredSessionId = createAssessmentSession(ownerSession, client.getId(), "오입력 세션");
        markMisentered(ownerSession, misenteredSessionId, "목록 제외 테스트");

        JsonNode defaultItems = dataObject("/api/v1/assessment-records", ownerSession).path("items");
        assertThat(textValues(defaultItems, "sessionId"))
                .contains(Long.toString(completedSessionId))
                .doesNotContain(Long.toString(misenteredSessionId));

        JsonNode ownerItems = dataObject("/api/v1/assessment-records?includeMisentered=true", ownerSession).path("items");
        assertThat(textValues(ownerItems, "sessionId"))
                .contains(Long.toString(completedSessionId), Long.toString(misenteredSessionId));

        JsonNode otherItems = dataObject("/api/v1/assessment-records?includeMisentered=true", otherSession).path("items");
        assertThat(textValues(otherItems, "sessionId"))
                .contains(Long.toString(completedSessionId))
                .doesNotContain(Long.toString(misenteredSessionId));

        JsonNode adminItems = dataObject("/api/v1/assessment-records?includeMisentered=true", adminSession).path("items");
        assertThat(textValues(adminItems, "sessionId"))
                .contains(Long.toString(completedSessionId), Long.toString(misenteredSessionId));
    }

    @Test
    void assessmentRecordsProjectionFiltersAndPaginatesAtDatabaseLevel() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("투영대상", LocalDate.of(1991, 1, 8), userA, ClientStatus.ACTIVE);

        AssessmentSession newestSession = saveSession(client, userA, "AS-PROJ-002", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 14, 0), 1, false);
        saveSessionScale(newestSession, "PHQ9", "PHQ-9", 1, 7, "경도", false);

        AssessmentSession olderSession = saveSession(client, userA, "AS-PROJ-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 24, 9, 0), 2, true);
        saveSessionScale(olderSession, "PHQ9", "PHQ-9", 1, 12, "중등도", true);
        saveSessionScale(olderSession, "GAD7", "GAD-7", 2, 4, "정상", false);

        MvcResult firstPageResult = mockMvc.perform(get("/api/v1/assessment-records")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29")
                        .param("clientName", "투영대상")
                        .param("scaleCode", "PHQ9")
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode firstPage = body(firstPageResult).path("data");
        assertThat(firstPage.path("totalItems").asLong()).isEqualTo(2L);
        assertThat(firstPage.path("totalPages").asInt()).isEqualTo(2);
        assertThat(firstPage.path("items").get(0).path("sessionNo").asText()).isEqualTo("AS-PROJ-002");

        mockMvc.perform(get("/api/v1/assessment-records")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29")
                        .param("clientName", "투영대상")
                        .param("scaleCode", "PHQ9")
                        .param("page", "2")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].sessionNo").value("AS-PROJ-001"))
                .andExpect(jsonPath("$.data.items[0].scaleCode").value("PHQ9"));
    }

    @Test
    void statisticsSummaryExcludesMisenteredAndMisregisteredSessions() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client activeClient = saveClient("통계대상A", LocalDate.of(1987, 6, 1), userA, ClientStatus.ACTIVE);
        Client misregisteredClient = saveClient("통계대상오등록", LocalDate.of(1988, 6, 1), userA, ClientStatus.MISREGISTERED);

        AssessmentSession countedSession = saveSession(activeClient, userA, "AS-STAT-SUM-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 25, 11, 0), 2, true);
        SessionScale countedPhq9 = saveSessionScale(countedSession, "PHQ9", "PHQ-9", 1, 11, "중등도", true);
        saveSessionAlert(countedSession, countedPhq9, AlertType.CRITICAL_ITEM, "PHQ9_ITEM9_ANY", "자해 위험 문항 주의");
        saveSessionScale(countedSession, "GAD7", "GAD-7", 2, 3, "정상", false);

        AssessmentSession misenteredSession = saveSession(activeClient, userA, "AS-STAT-SUM-002", AssessmentSessionStatus.MISENTERED,
                LocalDateTime.of(2026, 3, 25, 15, 0), 1, true);
        SessionScale misenteredScale = saveSessionScale(misenteredSession, "PHQ9", "PHQ-9", 1, 15, "중등도", true);
        saveSessionAlert(misenteredSession, misenteredScale, AlertType.HIGH_RISK, "PHQ9_TOTAL", "고위험");

        AssessmentSession misregisteredSession = saveSession(misregisteredClient, userA, "AS-STAT-SUM-003", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 25, 16, 0), 1, true);
        SessionScale misregisteredScale = saveSessionScale(misregisteredSession, "PHQ9", "PHQ-9", 1, 13, "중등도", true);
        saveSessionAlert(misregisteredSession, misregisteredScale, AlertType.HIGH_RISK, "PHQ9_TOTAL", "고위험");

        mockMvc.perform(get("/api/v1/statistics/summary")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalSessionCount").value(1))
                .andExpect(jsonPath("$.data.totalScaleCount").value(2))
                .andExpect(jsonPath("$.data.alertSessionCount").value(1))
                .andExpect(jsonPath("$.data.alertScaleCount").value(1))
                .andExpect(jsonPath("$.data.performedByStats[0].userName").value("사용자A"))
                .andExpect(jsonPath("$.data.performedByStats[0].sessionCount").value(1));
    }

    @Test
    void statisticsScalesAggregateCountsAndAlerts() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("척도통계대상", LocalDate.of(1986, 8, 8), userA, ClientStatus.ACTIVE);

        AssessmentSession firstSession = saveSession(client, userA, "AS-STAT-SCALE-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 26, 10, 0), 2, true);
        SessionScale firstPhq9 = saveSessionScale(firstSession, "PHQ9", "PHQ-9", 1, 9, "경도", true);
        saveSessionAlert(firstSession, firstPhq9, AlertType.CAUTION, "PHQ9_CAUTION", "주의");
        saveSessionScale(firstSession, "GAD7", "GAD-7", 2, 4, "정상", false);

        AssessmentSession secondSession = saveSession(client, userA, "AS-STAT-SCALE-002", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 27, 10, 0), 1, false);
        saveSessionScale(secondSession, "PHQ9", "PHQ-9", 1, 2, "최소", false);

        AssessmentSession excludedSession = saveSession(client, userA, "AS-STAT-SCALE-003", AssessmentSessionStatus.MISENTERED,
                LocalDateTime.of(2026, 3, 27, 11, 0), 1, true);
        SessionScale excludedScale = saveSessionScale(excludedSession, "GAD7", "GAD-7", 1, 12, "중등도", true);
        saveSessionAlert(excludedSession, excludedScale, AlertType.HIGH_RISK, "GAD7_HIGH", "고위험");

        JsonNode items = dataObject("/api/v1/statistics/scales?dateFrom=2026-03-24&dateTo=2026-03-29", session).path("items");
        JsonNode phq9Item = findByField(items, "scaleCode", "PHQ9");
        JsonNode gad7Item = findByField(items, "scaleCode", "GAD7");

        assertThat(phq9Item.path("totalCount").asLong()).isEqualTo(2L);
        assertThat(phq9Item.path("alertCount").asLong()).isEqualTo(1L);
        assertThat(gad7Item.path("totalCount").asLong()).isEqualTo(1L);
        assertThat(gad7Item.path("alertCount").asLong()).isEqualTo(0L);
    }

    @Test
    void statisticsScalesKeepActiveScalesVisibleAndAppendHistoricalInactiveScales() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("비활성척도대상", LocalDate.of(1983, 3, 3), userA, ClientStatus.ACTIVE);

        AssessmentSession sessionWithLegacyScale = saveSession(client, userA, "AS-STAT-LEGACY-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 26, 15, 0), 1, true);
        SessionScale legacyScale = saveSessionScale(sessionWithLegacyScale, "LEGACYX", "Legacy Scale", 99, 8, "양성 의심", true);
        saveSessionAlert(sessionWithLegacyScale, legacyScale, AlertType.CAUTION, "LEGACY_POSITIVE", "과거 데이터");

        JsonNode items = dataObject("/api/v1/statistics/scales?dateFrom=2026-03-24&dateTo=2026-03-29", session).path("items");
        JsonNode phq9Item = findByField(items, "scaleCode", "PHQ9");
        JsonNode legacyItem = findByField(items, "scaleCode", "LEGACYX");

        assertThat(phq9Item.path("isActive").asBoolean()).isTrue();
        assertThat(phq9Item.path("totalCount").asLong()).isZero();
        assertThat(legacyItem.path("isActive").asBoolean()).isFalse();
        assertThat(legacyItem.path("totalCount").asLong()).isEqualTo(1L);
        assertThat(items.get(items.size() - 1).path("scaleCode").asText()).isEqualTo("LEGACYX");
    }

    @Test
    void newScaleRecordsAndStatisticsReflectSavedMultiScaleSession() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "새 척도 반영", List.of(
                                scaleRequest("AUDITK", "0", "0", "0", "2", "0", "0", "0", "0", "0", "4"),
                                scaleRequest("IESR", "4", "4", "4", "4", "4", "4", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"),
                                scaleRequest("KMDQ", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N", "N", "N", "N", "N", "N", "Y", "SERIOUS"),
                                scaleRequest("MKPQ16", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N")
                        )))))
                .andExpect(status().isCreated());

        JsonNode recordItems = dataObject("/api/v1/assessment-records?dateFrom=2026-03-24&dateTo=2026-03-29&page=1&size=20", session).path("items");
        assertThat(textValues(recordItems, "scaleCode")).contains("AUDITK", "IESR", "KMDQ", "MKPQ16");

        JsonNode scaleItems = dataObject("/api/v1/statistics/scales?dateFrom=2026-03-24&dateTo=2026-03-29", session).path("items");
        assertThat(findByField(scaleItems, "scaleCode", "AUDITK").path("totalCount").asLong()).isGreaterThanOrEqualTo(1L);
        assertThat(findByField(scaleItems, "scaleCode", "IESR").path("totalCount").asLong()).isGreaterThanOrEqualTo(1L);
        assertThat(findByField(scaleItems, "scaleCode", "KMDQ").path("totalCount").asLong()).isGreaterThanOrEqualTo(1L);
        assertThat(findByField(scaleItems, "scaleCode", "MKPQ16").path("totalCount").asLong()).isGreaterThanOrEqualTo(1L);

        JsonNode alertItems = dataObject("/api/v1/statistics/alerts?dateFrom=2026-03-24&dateTo=2026-03-29&page=1&size=20", session).path("items");
        assertThat(textValues(alertItems, "scaleCode")).contains("AUDITK", "IESR", "KMDQ", "MKPQ16");
    }

    @Test
    void statisticsAlertsReturnsOnlyCompletedVisibleAlerts() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("경고통계대상", LocalDate.of(1984, 12, 11), userA, ClientStatus.ACTIVE);

        AssessmentSession visibleSession = saveSession(client, userA, "AS-STAT-ALERT-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 9, 30), 1, true);
        SessionScale visibleScale = saveSessionScale(visibleSession, "PHQ9", "PHQ-9", 1, 14, "중등도", true);
        saveSessionAlert(visibleSession, visibleScale, AlertType.CRITICAL_ITEM, "PHQ9_ITEM9_ANY", "자해 위험 문항 주의");

        AssessmentSession hiddenSession = saveSession(client, userA, "AS-STAT-ALERT-002", AssessmentSessionStatus.MISENTERED,
                LocalDateTime.of(2026, 3, 28, 10, 30), 1, true);
        SessionScale hiddenScale = saveSessionScale(hiddenSession, "PHQ9", "PHQ-9", 1, 14, "중등도", true);
        saveSessionAlert(hiddenSession, hiddenScale, AlertType.CRITICAL_ITEM, "PHQ9_ITEM9_ANY", "숨겨져야 함");

        mockMvc.perform(get("/api/v1/statistics/alerts")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29")
                        .param("scaleCode", "PHQ9")
                        .param("alertType", "CRITICAL_ITEM"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].clientName").value("경고통계대상"))
                .andExpect(jsonPath("$.data.items[0].performedByName").value("사용자A"))
                .andExpect(jsonPath("$.data.items[0].scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.items[0].alertType").value("CRITICAL_ITEM"))
                .andExpect(jsonPath("$.data.items[0].alertMessage").value("자해 위험 문항 주의"))
                .andExpect(jsonPath("$.data.items[0].sessionId").value(visibleSession.getId()));
    }

    @Test
    void statisticsAlertsAppliesScaleCodeAndAlertTypeFilters() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("경고필터대상", LocalDate.of(1981, 1, 1), userA, ClientStatus.ACTIVE);

        AssessmentSession matchingSession = saveSession(client, userA, "AS-STAT-FILTER-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 9, 0), 1, true);
        SessionScale matchingScale = saveSessionScale(matchingSession, "PHQ9", "PHQ-9", 1, 14, "중등도", true);
        saveSessionAlert(matchingSession, matchingScale, AlertType.CRITICAL_ITEM, "PHQ9_ITEM9_ANY", "일치");

        AssessmentSession otherScaleSession = saveSession(client, userA, "AS-STAT-FILTER-002", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 10, 0), 1, true);
        SessionScale otherScale = saveSessionScale(otherScaleSession, "GAD7", "GAD-7", 1, 10, "중등도", true);
        saveSessionAlert(otherScaleSession, otherScale, AlertType.CRITICAL_ITEM, "GAD7_HIGH", "척도 불일치");

        AssessmentSession otherTypeSession = saveSession(client, userA, "AS-STAT-FILTER-003", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 11, 0), 1, true);
        SessionScale otherTypeScale = saveSessionScale(otherTypeSession, "PHQ9", "PHQ-9", 1, 9, "경도", true);
        saveSessionAlert(otherTypeSession, otherTypeScale, AlertType.CAUTION, "PHQ9_CAUTION", "유형 불일치");

        mockMvc.perform(get("/api/v1/statistics/alerts")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29")
                        .param("scaleCode", "PHQ9")
                        .param("alertType", "CRITICAL_ITEM"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].sessionId").value(matchingSession.getId()))
                .andExpect(jsonPath("$.data.items[0].alertMessage").value("일치"));
    }

    @Test
    void statisticsExportRequiresAdminRole() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");

        mockMvc.perform(get("/api/v1/statistics/export")
                        .session(session)
                        .param("type", "SUMMARY"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("STATISTICS_EXPORT_FORBIDDEN"));
    }

    @Test
    void statisticsExportReturnsCsvContentForAdmin() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("엑셀대상", LocalDate.of(1981, 4, 4), userA, ClientStatus.ACTIVE);
        AssessmentSession savedSession = saveSession(client, userA, "AS-EXPORT-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 10, 0), 1, false);
        saveSessionScale(savedSession, "PHQ9", "PHQ-9", 1, 4, "최소", false);

        MvcResult result = mockMvc.perform(get("/api/v1/statistics/export")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29")
                        .param("type", "SUMMARY"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andReturn();

        String contentBody = result.getResponse().getContentAsString();
        assertThat(result.getResponse().getHeader("Content-Disposition")).contains("statistics-summary");
        assertThat(contentBody).contains("전체 세션 수");
        assertThat(contentBody).contains("전체 척도 시행 건수");
        assertThat(contentBody).contains("사용자A");
    }

    @Test
    void activityLogListRequiresAdminRole() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");

        mockMvc.perform(get("/api/v1/admin/activity-logs").session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void adminCanListActivityLogsWithFilters() throws Exception {
        login("usera", "Test1234!");
        login("userb", "Test1234!");
        MockHttpSession session = login("admina", "Test1234!");

        MvcResult pageOne = mockMvc.perform(get("/api/v1/admin/activity-logs")
                        .session(session)
                        .param("actionType", "LOGIN")
                        .param("dateFrom", "2026-03-01")
                        .param("dateTo", "2026-03-31")
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].actionType").value("LOGIN"))
                .andExpect(jsonPath("$.data.totalItems").value(3))
                .andExpect(jsonPath("$.data.totalPages").value(3))
                .andReturn();

        MvcResult pageTwo = mockMvc.perform(get("/api/v1/admin/activity-logs")
                        .session(session)
                        .param("actionType", "LOGIN")
                        .param("dateFrom", "2026-03-01")
                        .param("dateTo", "2026-03-31")
                        .param("page", "2")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].actionType").value("LOGIN"))
                .andReturn();

        assertThat(body(pageOne).path("data").path("items").get(0).path("id").asLong())
                .isGreaterThan(body(pageTwo).path("data").path("items").get(0).path("id").asLong());
    }

    @Test
    void adminCanListApproveAndRejectSignupRequests() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");

        MvcResult pendingList = mockMvc.perform(get("/api/v1/admin/signup-requests")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].loginId").value(org.hamcrest.Matchers.hasItem("pendinguser")))
                .andReturn();

        long pendingRequestId = findByField(body(pendingList).path("data").path("items"), "loginId", "pendinguser").path("requestId").asLong();
        User pendingUser = findUser("pendinguser");
        mockMvc.perform(post("/api/v1/admin/signup-requests/{requestId}/approve", pendingRequestId)
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("processNote", "정상 승인"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestStatus").value("APPROVED"))
                .andExpect(jsonPath("$.data.userStatus").value("ACTIVE"));

        User approved = userRepository.findById(pendingUser.getId()).orElseThrow();
        assertThat(approved.getStatus()).isEqualTo(com.dasisuhgi.mentalhealth.user.entity.UserStatus.ACTIVE);
        assertThat(approved.getApprovedAt()).isNotNull();
        assertThat(approved.getApprovedById()).isEqualTo(findUser("admina").getId());
        UserApprovalRequest approvedRequest = userApprovalRequestRepository.findById(pendingRequestId).orElseThrow();
        assertThat(approvedRequest.getRequestStatus().name()).isEqualTo("APPROVED");
        assertThat(approvedRequest.getProcessedAt()).isNotNull();
        assertThat(approvedRequest.getProcessedBy()).isEqualTo(findUser("admina").getId());
        assertThat(approvedRequest.getProcessNote()).isEqualTo("정상 승인");

        MvcResult rejectRequestResult = mockMvc.perform(post("/api/v1/signup-requests")
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "반려후보",
                                "loginId", "rejectcandidate",
                                "password", "Test1234!",
                                "phone", "010-4444-5555",
                                "positionName", "사회복지사",
                                "teamName", "정신건강팀",
                                "requestMemo", "확인 필요"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();

        long rejectRequestId = body(rejectRequestResult).path("data").path("requestId").asLong();
        long rejectUserId = body(rejectRequestResult).path("data").path("userId").asLong();

        mockMvc.perform(post("/api/v1/admin/signup-requests/{requestId}/reject", rejectRequestId)
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("processNote", "소속 확인 필요"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requestStatus").value("REJECTED"))
                .andExpect(jsonPath("$.data.userStatus").value("REJECTED"));

        User rejected = userRepository.findById(rejectUserId).orElseThrow();
        assertThat(rejected.getStatus()).isEqualTo(com.dasisuhgi.mentalhealth.user.entity.UserStatus.REJECTED);
        assertThat(rejected.getRejectedAt()).isNotNull();
        assertThat(rejected.getRejectionReason()).isEqualTo("소속 확인 필요");
        UserApprovalRequest rejectedRequest = userApprovalRequestRepository.findById(rejectRequestId).orElseThrow();
        assertThat(rejectedRequest.getRequestStatus().name()).isEqualTo("REJECTED");
        assertThat(rejectedRequest.getProcessedAt()).isNotNull();
        assertThat(rejectedRequest.getProcessedBy()).isEqualTo(findUser("admina").getId());
        assertThat(rejectedRequest.getProcessNote()).isEqualTo("소속 확인 필요");
        assertThat(hasActivityLog(ActivityActionType.SIGNUP_APPROVE, pendingRequestId)).isTrue();
        assertThat(hasActivityLog(ActivityActionType.SIGNUP_REJECT, rejectRequestId)).isTrue();
    }

    @Test
    void approvalRequestProcessingRejectsUserIdPathValue() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        User userOnly = saveUser(
                "requestidonly",
                "요청아이디아님",
                com.dasisuhgi.mentalhealth.user.entity.UserRole.USER,
                com.dasisuhgi.mentalhealth.user.entity.UserStatus.ACTIVE
        );

        mockMvc.perform(post("/api/v1/admin/signup-requests/{requestId}/approve", userOnly.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("processNote", "잘못된 식별자"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("SIGNUP_REQUEST_ID_REQUIRED"));
    }

    @Test
    void adminCanUpdateUserRoleAndStatus() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        User target = findUser("usera");

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/role", target.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("role", "ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("ADMIN"));

        mockMvc.perform(get("/api/v1/admin/users")
                        .session(session)
                        .param("keyword", "usera")
                        .param("role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].loginId").value("usera"));

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/status", target.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("status", "INACTIVE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("INACTIVE"));

        User updated = userRepository.findById(target.getId()).orElseThrow();
        assertThat(updated.getRole().name()).isEqualTo("ADMIN");
        assertThat(updated.getStatus().name()).isEqualTo("INACTIVE");
        assertThat(hasActivityLog(ActivityActionType.USER_ROLE_CHANGE, target.getId())).isTrue();
        assertThat(hasActivityLog(ActivityActionType.USER_STATUS_CHANGE, target.getId())).isTrue();
    }

    @Test
    void lastActiveAdminCannotBeDemotedOrInactivated() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        User admin = findUser("admina");

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/role", admin.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("role", "USER"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("LAST_ACTIVE_ADMIN_REQUIRED"));

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/status", admin.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("status", "INACTIVE"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("LAST_ACTIVE_ADMIN_REQUIRED"));
    }

    @Test
    void manualBackupRequiresAdminRole() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");

        mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "권한 없음"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void manualBackupCreatesHistoryAndActivityLog() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");

        mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "운영 점검"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.backupMethod").value("SNAPSHOT"))
                .andExpect(jsonPath("$.data.datasourceType").value("H2"))
                .andExpect(jsonPath("$.data.preflightSummary").value(org.hamcrest.Matchers.containsString("preferred=SNAPSHOT")))
                .andExpect(jsonPath("$.data.fileName").value(org.hamcrest.Matchers.startsWith("backup-")));

        BackupHistory history = latestBackupHistory();
        assertThat(history.getStatus().name()).isEqualTo("SUCCESS");
        assertThat(history.getBackupMethod()).isEqualTo(BackupMethod.SNAPSHOT);
        assertThat(history.getFailureReason()).isNull();
        assertThat(Files.exists(Path.of(history.getFilePath()))).isTrue();
        assertThat(hasActivityLog(ActivityActionType.BACKUP_RUN, history.getId())).isTrue();

        mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "운영 점검 2"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCESS"));

        mockMvc.perform(get("/api/v1/admin/backups")
                        .session(session)
                        .param("status", "SUCCESS")
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items[0].backupMethod").value("SNAPSHOT"));
    }

    @Test
    void manualBackupFallsBackToSnapshotWhenMariaDumpCommandIsUnavailable() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        String originalDatasourceUrl = (String) ReflectionTestUtils.getField(backupService, "datasourceUrl");
        String originalDumpCommand = (String) ReflectionTestUtils.getField(backupService, "dbDumpCommand");

        ReflectionTestUtils.setField(backupService, "datasourceUrl", "jdbc:mariadb://127.0.0.1:3306/mental_health_test");
        ReflectionTestUtils.setField(backupService, "dbDumpCommand", "missing-dump-command-xyz");
        try {
            mockMvc.perform(post("/api/v1/admin/backups/run")
                            .session(session)
                            .contentType(APPLICATION_JSON)
                            .content(json(Map.of("reason", "preflight fallback"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.backupMethod").value("SNAPSHOT"))
                    .andExpect(jsonPath("$.data.datasourceType").value("MARIADB"))
                    .andExpect(jsonPath("$.data.preflightSummary").value(org.hamcrest.Matchers.containsString("fallback=SNAPSHOT")))
                    .andExpect(jsonPath("$.data.preflightSummary").value(org.hamcrest.Matchers.containsString("missing-dump-command-xyz")));
        } finally {
            ReflectionTestUtils.setField(backupService, "datasourceUrl", originalDatasourceUrl);
            ReflectionTestUtils.setField(backupService, "dbDumpCommand", originalDumpCommand);
        }
    }

    @Test
    void manualBackupUsesDbDumpWhenMariaDumpCommandIsAvailable() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        String originalDatasourceUrl = (String) ReflectionTestUtils.getField(backupService, "datasourceUrl");
        String originalDumpCommand = (String) ReflectionTestUtils.getField(backupService, "dbDumpCommand");
        String originalRootPath = (String) ReflectionTestUtils.getField(backupService, "backupRootPath");
        Path backupRoot = Files.createTempDirectory("backup-db-dump-success");
        Path fakeDumpCommand = createFakeDumpCommand();

        ReflectionTestUtils.setField(backupService, "datasourceUrl", "jdbc:mariadb://127.0.0.1:3306/mental_health_test");
        ReflectionTestUtils.setField(backupService, "dbDumpCommand", fakeDumpCommand.toString());
        ReflectionTestUtils.setField(backupService, "backupRootPath", backupRoot.toString());
        try {
            mockMvc.perform(post("/api/v1/admin/backups/run")
                            .session(session)
                            .contentType(APPLICATION_JSON)
                            .content(json(Map.of("reason", "db dump success"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.backupMethod").value("DB_DUMP"))
                    .andExpect(jsonPath("$.data.datasourceType").value("MARIADB"))
                    .andExpect(jsonPath("$.data.preflightSummary").value(org.hamcrest.Matchers.containsString("preferred=DB_DUMP")))
                    .andExpect(jsonPath("$.data.preflightSummary").value(org.hamcrest.Matchers.containsString("dumpAvailable=true")))
                    .andExpect(jsonPath("$.data.fileName").value(org.hamcrest.Matchers.endsWith("-db-dump.sql")));

            BackupHistory history = latestBackupHistory();
            assertThat(history.getStatus().name()).isEqualTo("SUCCESS");
            assertThat(history.getBackupMethod()).isEqualTo(BackupMethod.DB_DUMP);
            assertThat(history.getFailureReason()).isNull();
            assertThat(Files.exists(Path.of(history.getFilePath()))).isTrue();
            assertThat(Files.readString(Path.of(history.getFilePath()))).contains("-- fake db dump");
            assertThat(hasActivityLog(ActivityActionType.BACKUP_RUN, history.getId())).isTrue();
        } finally {
            ReflectionTestUtils.setField(backupService, "datasourceUrl", originalDatasourceUrl);
            ReflectionTestUtils.setField(backupService, "dbDumpCommand", originalDumpCommand);
            ReflectionTestUtils.setField(backupService, "backupRootPath", originalRootPath);
        }
    }

    @Test
    void manualBackupFailureStoresDetailedReason() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        Path blocker = Files.createTempFile("backup-root-blocker", ".tmp");
        String originalRootPath = (String) ReflectionTestUtils.getField(backupService, "backupRootPath");

        ReflectionTestUtils.setField(backupService, "backupRootPath", blocker.toString());
        try {
            mockMvc.perform(post("/api/v1/admin/backups/run")
                            .session(session)
                            .contentType(APPLICATION_JSON)
                            .content(json(Map.of("reason", "실패 테스트"))))
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.errorCode").value("BACKUP_PATH_NOT_WRITABLE"))
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("백업 경로를 사용할 수 없습니다")));

            BackupHistory history = latestBackupHistory();
            assertThat(history.getStatus().name()).isEqualTo("FAILED");
            assertThat(history.getFailureReason()).contains("Backup path points to a file");
        } finally {
            ReflectionTestUtils.setField(backupService, "backupRootPath", originalRootPath);
            Files.deleteIfExists(blocker);
        }
    }

    @Test
    void saveSessionRollsBackWhenFailureOccursAfterSessionHeaderSave() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        long sessionCountBefore = assessmentSessionRepository.count();
        long scaleCountBefore = sessionScaleRepository.count();
        long sequenceCountBefore = identifierSequenceRepository.count();

        sessionSaveFailureSimulator.failWith(new RuntimeException("forced failure"));

        mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(validPhq9SaveRequest(client.getId(), "롤백 테스트"))))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.errorCode").value("INTERNAL_SERVER_ERROR"));

        TestTransaction.flagForRollback();
        TestTransaction.end();
        entityManager.clear();

        assertThat(assessmentSessionRepository.count()).isEqualTo(sessionCountBefore);
        assertThat(sessionScaleRepository.count()).isEqualTo(scaleCountBefore);
        assertThat(identifierSequenceRepository.count()).isEqualTo(sequenceCountBefore);
    }

    @Test
    void nonAuthorCannotViewMisregisteredClientDetail() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client misregisteredClient = findClient("오등록대상", LocalDate.of(1990, 5, 5));

        mockMvc.perform(get("/api/v1/clients/{clientId}", misregisteredClient.getId()).session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("CLIENT_VIEW_FORBIDDEN"));
    }

    @Test
    void nonAuthorCannotViewMisenteredSessionDetail() throws Exception {
        MockHttpSession session = login("userb", "Test1234!");
        User userA = findUser("usera");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));
        AssessmentSession misenteredSession = saveSession(
                client,
                userA,
                "AS-MISENTER-DETAIL",
                AssessmentSessionStatus.MISENTERED,
                LocalDateTime.of(2026, 3, 22, 10, 0)
        );

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", misenteredSession.getId()).session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("SESSION_VIEW_FORBIDDEN"));
    }

    private MockHttpSession login(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "loginId", loginId,
                                "password", password
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private String createClient(MockHttpSession session, String name, String birthDate) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/clients")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", name,
                                "gender", "FEMALE",
                                "birthDate", birthDate,
                                "phone", "010-1234-5678",
                                "primaryWorkerId", findUser("usera").getId()
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        return body(result).path("data").path("clientNo").asText();
    }

    private Client createClientAndFind(MockHttpSession session, String name, String birthDate) throws Exception {
        createClient(session, name, birthDate);
        return findClient(name, LocalDate.parse(birthDate));
    }

    private long createAssessmentSession(MockHttpSession session, Long clientId, String memo) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(validPhq9SaveRequest(clientId, memo))))
                .andExpect(status().isCreated())
                .andReturn();
        return body(result).path("data").path("sessionId").asLong();
    }

    private void markMisentered(MockHttpSession session, long sessionId, String reason) throws Exception {
        mockMvc.perform(post("/api/v1/assessment-sessions/{sessionId}/mark-misentered", sessionId)
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", reason))))
                .andExpect(status().isOk());
    }

    private JsonNode dataArray(String path, MockHttpSession session) throws Exception {
        JsonNode data = dataObject(path, session);
        return data.has("items") ? data.path("items") : data;
    }

    private JsonNode dataObject(String path, MockHttpSession session) throws Exception {
        MvcResult result = mockMvc.perform(get(path).session(session))
                .andExpect(status().isOk())
                .andReturn();
        return body(result).path("data");
    }

    private User findUser(String loginId) {
        return userRepository.findByLoginId(loginId)
                .orElseThrow();
    }

    private Client findClient(String name, LocalDate birthDate) {
        return clientRepository.findAllByNameAndBirthDate(name, birthDate).stream()
                .findFirst()
                .orElseThrow();
    }

    private AssessmentSession saveSession(
            Client client,
            User performedBy,
            String sessionNo,
            AssessmentSessionStatus status,
            LocalDateTime completedAt
    ) {
        return saveSession(client, performedBy, sessionNo, status, completedAt, 1, false);
    }

    private AssessmentSession saveSession(
            Client client,
            User performedBy,
            String sessionNo,
            AssessmentSessionStatus status,
            LocalDateTime completedAt,
            int scaleCount,
            boolean hasAlert
    ) {
        AssessmentSession session = new AssessmentSession();
        session.setSessionNo(sessionNo);
        session.setClient(client);
        session.setSessionDate(completedAt.toLocalDate());
        session.setSessionStartedAt(completedAt.minusMinutes(20));
        session.setSessionCompletedAt(completedAt);
        session.setPerformedBy(performedBy);
        session.setScaleCount(scaleCount);
        session.setHasAlert(hasAlert);
        session.setMemo("테스트 메모");
        session.setStatus(status);
        if (status == AssessmentSessionStatus.MISENTERED) {
            session.setMisenteredAt(completedAt.plusMinutes(5));
            session.setMisenteredBy(performedBy);
            session.setMisenteredReason("테스트 오입력");
        }
        return assessmentSessionRepository.save(session);
    }

    private SessionScale saveSessionScale(
            AssessmentSession session,
            String scaleCode,
            String scaleName,
            int displayOrder,
            int totalScore,
            String resultLevel,
            boolean hasAlert
    ) {
        SessionScale scale = new SessionScale();
        scale.setSession(session);
        scale.setScaleCode(scaleCode);
        scale.setScaleName(scaleName);
        scale.setDisplayOrder(displayOrder);
        scale.setTotalScore(BigDecimal.valueOf(totalScore));
        scale.setResultLevel(resultLevel);
        scale.setHasAlert(hasAlert);
        scale.setRawResultSnapshot("{}");
        return sessionScaleRepository.save(scale);
    }

    private void saveSessionAlert(
            AssessmentSession session,
            SessionScale scale,
            AlertType alertType,
            String alertCode,
            String alertMessage
    ) {
        SessionAlert alert = new SessionAlert();
        alert.setSession(session);
        alert.setSessionScale(scale);
        alert.setScaleCode(scale.getScaleCode());
        alert.setAlertType(alertType);
        alert.setAlertCode(alertCode);
        alert.setAlertMessage(alertMessage);
        sessionAlertRepository.save(alert);
    }

    private Client saveClient(String name, LocalDate birthDate, User createdBy, ClientStatus status) {
        Client client = new Client();
        client.setClientNo("CL-TEST-" + System.nanoTime());
        client.setName(name);
        client.setGender(Gender.FEMALE);
        client.setBirthDate(birthDate);
        client.setPhone("010-0000-0000");
        client.setPrimaryWorker(createdBy);
        client.setCreatedBy(createdBy);
        client.setStatus(status);
        if (status == ClientStatus.MISREGISTERED) {
            client.setMisregisteredAt(LocalDateTime.of(2026, 3, 29, 9, 0));
            client.setMisregisteredBy(createdBy);
            client.setMisregisteredReason("테스트 오등록");
        }
        return clientRepository.save(client);
    }

    private User saveUser(String loginId, String name, com.dasisuhgi.mentalhealth.user.entity.UserRole role,
            com.dasisuhgi.mentalhealth.user.entity.UserStatus status) {
        User user = new User();
        user.setLoginId(loginId);
        user.setPasswordHash("$2a$10$Wn4QlyhMwoMPmxjSPdZ1qeuN0M4T/6QAEyy6AdZkGouVp21HbQJ2K");
        user.setName(name);
        user.setPhone("010-0000-0000");
        user.setPositionName("사회복지사");
        user.setTeamName("정신건강팀");
        user.setRole(role);
        user.setStatus(status);
        return userRepository.save(user);
    }

    private Map<String, Object> validPhq9SaveRequest(Long clientId, String memo) {
        return sessionSaveRequest(clientId, memo, List.of(scaleRequest("PHQ9", 0, 0, 0, 0, 0, 0, 0, 0, 1)));
    }

    private Map<String, Object> sessionSaveRequest(Long clientId, String memo, List<Map<String, Object>> selectedScales) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("clientId", clientId);
        payload.put("sessionStartedAt", "2026-03-28T13:50:00");
        payload.put("sessionCompletedAt", "2026-03-28T14:20:00");
        payload.put("memo", memo);
        payload.put("selectedScales", selectedScales);
        return payload;
    }

    private Map<String, Object> scaleRequest(String scaleCode, int... answerValues) {
        List<Map<String, Object>> answers = new ArrayList<>();
        for (int index = 0; index < answerValues.length; index++) {
            answers.add(answer(index + 1, Integer.toString(answerValues[index])));
        }

        Map<String, Object> scale = new LinkedHashMap<>();
        scale.put("scaleCode", scaleCode);
        scale.put("answers", answers);
        return scale;
    }

    private Map<String, Object> scaleRequest(String scaleCode, String... answerValues) {
        List<Map<String, Object>> answers = new ArrayList<>();
        for (int index = 0; index < answerValues.length; index++) {
            answers.add(answer(index + 1, answerValues[index]));
        }

        Map<String, Object> scale = new LinkedHashMap<>();
        scale.put("scaleCode", scaleCode);
        scale.put("answers", answers);
        return scale;
    }

    private Map<String, Object> answer(int questionNo, String answerValue) {
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("questionNo", questionNo);
        answer.put("answerValue", answerValue);
        return answer;
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private List<String> textValues(JsonNode arrayNode, String fieldName) {
        assertThat(arrayNode.isArray()).isTrue();
        List<String> values = new ArrayList<>();
        arrayNode.forEach(node -> values.add(node.path(fieldName).asText()));
        return values;
    }

    private boolean hasField(JsonNode arrayNode, String fieldName) {
        assertThat(arrayNode.isArray()).isTrue();
        for (JsonNode node : arrayNode) {
            if (node.has(fieldName)) {
                return true;
            }
        }
        return false;
    }

    private JsonNode findByField(JsonNode arrayNode, String fieldName, String expectedValue) {
        assertThat(arrayNode.isArray()).isTrue();
        for (JsonNode node : arrayNode) {
            if (expectedValue.equals(node.path(fieldName).asText())) {
                return node;
            }
        }
        throw new AssertionError("field not found: " + fieldName + "=" + expectedValue);
    }

    private ActivityLog latestActivityLog(ActivityActionType actionType) {
        return activityLogRepository.findAll().stream()
                .filter(log -> log.getActionType() == actionType)
                .max(Comparator.comparing(ActivityLog::getId))
                .orElseThrow();
    }

    private boolean hasActivityLog(ActivityActionType actionType, Long targetId) {
        return activityLogRepository.findAll().stream()
                .anyMatch(log -> log.getActionType() == actionType
                        && (targetId == null || targetId.equals(log.getTargetId())));
    }

    private BackupHistory latestBackupHistory() {
        return backupHistoryRepository.findAll().stream()
                .max(Comparator.comparing(BackupHistory::getId))
                .orElseThrow();
    }

    private Path createFakeDumpCommand() throws Exception {
        boolean windows = System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("windows");
        Path commandFile = Files.createTempFile("fake-db-dump", windows ? ".cmd" : ".sh");
        String script = windows
                ? """
                @echo off
                if "%~1"=="--version" (
                  echo fake-db-dump 1.0
                  exit /b 0
                )
                setlocal EnableDelayedExpansion
                set "OUTPUT="
                set "NEXT_IS_OUTPUT=0"
                for %%A in (%*) do (
                  if "!NEXT_IS_OUTPUT!"=="1" (
                    set "OUTPUT=%%~A"
                    set "NEXT_IS_OUTPUT=0"
                  )
                  if /I "%%~A"=="--result-file" set "NEXT_IS_OUTPUT=1"
                )
                if not defined OUTPUT exit /b 1
                > "!OUTPUT!" echo -- fake db dump
                exit /b 0
                """
                : """
                #!/bin/sh
                if [ "$1" = "--version" ]; then
                  echo fake-db-dump 1.0
                  exit 0
                fi
                output=""
                for arg in "$@"; do
                  case "$arg" in
                    --result-file=*)
                      output=${arg#--result-file=}
                      ;;
                  esac
                done
                if [ -z "$output" ]; then
                  exit 1
                fi
                printf '%s\\n' '-- fake db dump' > "$output"
                """;
        Files.writeString(commandFile, script, StandardCharsets.UTF_8);
        commandFile.toFile().setExecutable(true);
        commandFile.toFile().deleteOnExit();
        return commandFile;
    }
}
