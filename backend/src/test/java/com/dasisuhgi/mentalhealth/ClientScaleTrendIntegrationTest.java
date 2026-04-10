package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionAlert;
import com.dasisuhgi.mentalhealth.assessment.entity.SessionScale;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentSessionRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionAlertRepository;
import com.dasisuhgi.mentalhealth.assessment.repository.SessionScaleRepository;
import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.client.entity.Gender;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.hamcrest.Matchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class ClientScaleTrendIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private AssessmentSessionRepository assessmentSessionRepository;

    @Autowired
    private SessionScaleRepository sessionScaleRepository;

    @Autowired
    private SessionAlertRepository sessionAlertRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void clientScaleTrendReturnsScaleMetaAndPoints() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("추세대상A", LocalDate.of(1990, 1, 2), userA, ClientStatus.ACTIVE);

        AssessmentSession firstSession = saveSession(
                client,
                userA,
                "AS-TREND-001",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 1, 9, 0),
                1,
                true
        );
        SessionScale firstScale = saveSessionScale(
                firstSession,
                "PHQ9",
                "PHQ-9",
                1,
                12,
                "중등도",
                true,
                LocalDateTime.of(2026, 4, 1, 9, 5)
        );
        saveSessionAlert(
                firstSession,
                firstScale,
                AlertType.CRITICAL_ITEM,
                "PHQ9_ITEM9_ANY",
                "9번 문항 응답으로 인해 추가 안전 확인이 필요합니다."
        );

        AssessmentSession secondSession = saveSession(
                client,
                userA,
                "AS-TREND-002",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 3, 11, 0),
                1,
                false
        );
        SessionScale secondScale = saveSessionScale(
                secondSession,
                "PHQ9",
                "PHQ-9",
                1,
                4,
                "최소",
                false,
                LocalDateTime.of(2026, 4, 3, 11, 2)
        );

        flushAndClear();

        mockMvc.perform(get("/api/v1/clients/{clientId}/scale-trends/{scaleCode}", client.getId(), "PHQ9").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scaleName").value("PHQ-9"))
                .andExpect(jsonPath("$.data.maxScore").value(27))
                .andExpect(jsonPath("$.data.cutoffs.length()").value(4))
                .andExpect(jsonPath("$.data.cutoffs[0].score").value(5))
                .andExpect(jsonPath("$.data.cutoffs[0].label").value("경도"))
                .andExpect(jsonPath("$.data.cutoffs[0].min").doesNotExist())
                .andExpect(jsonPath("$.data.cutoffs[0].max").doesNotExist())
                .andExpect(jsonPath("$.data.cutoffs[3].score").value(20))
                .andExpect(jsonPath("$.data.cutoffs[3].label").value("중증"))
                .andExpect(jsonPath("$.data.points[0].sessionId").value(firstSession.getId()))
                .andExpect(jsonPath("$.data.points[0].sessionScaleId").value(firstScale.getId()))
                .andExpect(jsonPath("$.data.points[0].assessedAt").value("2026-04-01 09:00:00"))
                .andExpect(jsonPath("$.data.points[0].createdAt").value("2026-04-01 09:05:00"))
                .andExpect(jsonPath("$.data.points[0].totalScore").value(12))
                .andExpect(jsonPath("$.data.points[0].resultLevel").value("중등도"))
                .andExpect(jsonPath("$.data.points[0].alerts[0].alertType").value("CRITICAL_ITEM"))
                .andExpect(jsonPath("$.data.points[0].alerts[0].alertCode").value("PHQ9_ITEM9_ANY"))
                .andExpect(jsonPath("$.data.points[0].alerts[0].alertMessage")
                        .value("9번 문항 응답으로 인해 추가 안전 확인이 필요합니다."))
                .andExpect(jsonPath("$.data.points[1].sessionId").value(secondSession.getId()))
                .andExpect(jsonPath("$.data.points[1].sessionScaleId").value(secondScale.getId()))
                .andExpect(jsonPath("$.data.points[1].assessedAt").value("2026-04-03 11:00:00"))
                .andExpect(jsonPath("$.data.points[1].createdAt").value("2026-04-03 11:02:00"))
                .andExpect(jsonPath("$.data.points[1].totalScore").value(4))
                .andExpect(jsonPath("$.data.points[1].resultLevel").value("최소"))
                .andExpect(jsonPath("$.data.points[1].alerts").isEmpty());
    }

    @Test
    void clientScaleTrendExcludesMisenteredSessions() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("추세대상B", LocalDate.of(1991, 2, 3), userA, ClientStatus.ACTIVE);

        AssessmentSession completedSession = saveSession(
                client,
                userA,
                "AS-TREND-MIS-001",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 2, 10, 0),
                1,
                false
        );
        saveSessionScale(
                completedSession,
                "PHQ9",
                "PHQ-9",
                1,
                6,
                "경도",
                false,
                LocalDateTime.of(2026, 4, 2, 10, 3)
        );

        AssessmentSession misenteredSession = saveSession(
                client,
                userA,
                "AS-TREND-MIS-002",
                AssessmentSessionStatus.MISENTERED,
                LocalDateTime.of(2026, 4, 4, 10, 0),
                1,
                false
        );
        saveSessionScale(
                misenteredSession,
                "PHQ9",
                "PHQ-9",
                1,
                15,
                "중등도-중증",
                false,
                LocalDateTime.of(2026, 4, 4, 10, 3)
        );

        flushAndClear();

        mockMvc.perform(get("/api/v1/clients/{clientId}/scale-trends/{scaleCode}", client.getId(), "PHQ9").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.points.length()").value(1))
                .andExpect(jsonPath("$.data.points[0].sessionId").value(completedSession.getId()))
                .andExpect(jsonPath("$.data.points[0].totalScore").value(6));
    }

    @Test
    void clientScaleTrendSortsByAssessedAtThenCreatedAtAscending() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("추세대상C", LocalDate.of(1992, 3, 4), userA, ClientStatus.ACTIVE);

        AssessmentSession earliestSession = saveSession(
                client,
                userA,
                "AS-TREND-SORT-001",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 5, 8, 0),
                1,
                false
        );
        SessionScale earliestScale = saveSessionScale(
                earliestSession,
                "PHQ9",
                "PHQ-9",
                1,
                3,
                "최소",
                false,
                LocalDateTime.of(2026, 4, 5, 8, 10)
        );

        AssessmentSession sameAssessedLaterCreatedSession = saveSession(
                client,
                userA,
                "AS-TREND-SORT-002",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 6, 9, 0),
                1,
                false
        );
        SessionScale sameAssessedLaterCreatedScale = saveSessionScale(
                sameAssessedLaterCreatedSession,
                "PHQ9",
                "PHQ-9",
                1,
                11,
                "중등도",
                false,
                LocalDateTime.of(2026, 4, 6, 9, 7)
        );

        AssessmentSession sameAssessedEarlierCreatedSession = saveSession(
                client,
                userA,
                "AS-TREND-SORT-003",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 6, 9, 0),
                1,
                false
        );
        SessionScale sameAssessedEarlierCreatedScale = saveSessionScale(
                sameAssessedEarlierCreatedSession,
                "PHQ9",
                "PHQ-9",
                1,
                7,
                "경도",
                false,
                LocalDateTime.of(2026, 4, 6, 9, 2)
        );

        flushAndClear();

        mockMvc.perform(get("/api/v1/clients/{clientId}/scale-trends/{scaleCode}", client.getId(), "PHQ9").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.points[0].sessionId").value(earliestSession.getId()))
                .andExpect(jsonPath("$.data.points[0].sessionScaleId").value(earliestScale.getId()))
                .andExpect(jsonPath("$.data.points[1].sessionId").value(sameAssessedEarlierCreatedSession.getId()))
                .andExpect(jsonPath("$.data.points[1].sessionScaleId").value(sameAssessedEarlierCreatedScale.getId()))
                .andExpect(jsonPath("$.data.points[1].createdAt").value("2026-04-06 09:02:00"))
                .andExpect(jsonPath("$.data.points[2].sessionId").value(sameAssessedLaterCreatedSession.getId()))
                .andExpect(jsonPath("$.data.points[2].sessionScaleId").value(sameAssessedLaterCreatedScale.getId()))
                .andExpect(jsonPath("$.data.points[2].createdAt").value("2026-04-06 09:07:00"));
    }

    @Test
    void clientScaleTrendReturnsScaleMetaWithEmptyPointsWhenHistoryIsMissing() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("추세대상D", LocalDate.of(1993, 4, 5), userA, ClientStatus.ACTIVE);

        flushAndClear();

        mockMvc.perform(get("/api/v1/clients/{clientId}/scale-trends/{scaleCode}", client.getId(), "PHQ9").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scaleName").value("PHQ-9"))
                .andExpect(jsonPath("$.data.maxScore").value(27))
                .andExpect(jsonPath("$.data.cutoffs.length()").value(4))
                .andExpect(jsonPath("$.data.cutoffs[0].score").value(5))
                .andExpect(jsonPath("$.data.cutoffs[0].label").value("경도"))
                .andExpect(jsonPath("$.data.points").isArray())
                .andExpect(jsonPath("$.data.points").isEmpty());
    }

    @Test
    void clientDetailReturnsLatestRecordedOperatingScaleCode() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("상세대상A", LocalDate.of(1994, 5, 6), userA, ClientStatus.ACTIVE);

        AssessmentSession firstSession = saveSession(
                client,
                userA,
                "AS-DETAIL-SCALE-001",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 4, 9, 0),
                1,
                false
        );
        saveSessionScale(
                firstSession,
                "PHQ9",
                "PHQ-9",
                1,
                8,
                "경도",
                false,
                LocalDateTime.of(2026, 4, 4, 9, 5)
        );

        AssessmentSession secondSession = saveSession(
                client,
                userA,
                "AS-DETAIL-SCALE-002",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 6, 10, 0),
                1,
                false
        );
        saveSessionScale(
                secondSession,
                "GAD7",
                "GAD-7",
                1,
                11,
                "중등도",
                false,
                LocalDateTime.of(2026, 4, 6, 10, 2)
        );

        flushAndClear();

        mockMvc.perform(get("/api/v1/clients/{clientId}", client.getId()).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latestRecordedScaleCode").value("GAD7"));
    }

    @Test
    void clientDetailIgnoresMoreRecentNonOperatingScaleRecordsWhenResolvingLatestRecordedScaleCode() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("상세대상B", LocalDate.of(1995, 6, 7), userA, ClientStatus.ACTIVE);

        AssessmentSession operatingScaleSession = saveSession(
                client,
                userA,
                "AS-DETAIL-SCALE-003",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 4, 9, 0),
                1,
                false
        );
        saveSessionScale(
                operatingScaleSession,
                "PHQ9",
                "PHQ-9",
                1,
                9,
                "경도",
                false,
                LocalDateTime.of(2026, 4, 4, 9, 5)
        );

        AssessmentSession legacyScaleSession = saveSession(
                client,
                userA,
                "AS-DETAIL-SCALE-004",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 8, 14, 0),
                1,
                false
        );
        saveSessionScale(
                legacyScaleSession,
                "LEGACY1",
                "레거시 척도",
                1,
                17,
                "레거시",
                false,
                LocalDateTime.of(2026, 4, 8, 14, 3)
        );

        flushAndClear();

        mockMvc.perform(get("/api/v1/clients/{clientId}", client.getId()).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latestRecordedScaleCode").value("PHQ9"));
    }

    @Test
    void clientDetailReturnsNullLatestRecordedScaleCodeWhenOperatingHistoryIsMissing() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("상세대상C", LocalDate.of(1996, 7, 8), userA, ClientStatus.ACTIVE);

        AssessmentSession legacyScaleSession = saveSession(
                client,
                userA,
                "AS-DETAIL-SCALE-005",
                AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 4, 9, 15, 0),
                1,
                false
        );
        saveSessionScale(
                legacyScaleSession,
                "LEGACY1",
                "레거시 척도",
                1,
                6,
                "레거시",
                false,
                LocalDateTime.of(2026, 4, 9, 15, 2)
        );

        flushAndClear();

        mockMvc.perform(get("/api/v1/clients/{clientId}", client.getId()).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latestRecordedScaleCode").value(Matchers.nullValue()));
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private MockHttpSession login(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "%s"
                                }
                                """.formatted(loginId, password)))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isInstanceOf(MockHttpSession.class);
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private User findUser(String loginId) {
        return userRepository.findByLoginId(loginId)
                .orElseThrow();
    }

    private Client saveClient(String name, LocalDate birthDate, User createdBy, ClientStatus status) {
        Client client = new Client();
        client.setClientNo("CL-TREND-" + System.nanoTime());
        client.setName(name);
        client.setGender(Gender.FEMALE);
        client.setBirthDate(birthDate);
        client.setPhone("010-0000-0000");
        client.setPrimaryWorker(createdBy);
        client.setCreatedBy(createdBy);
        client.setStatus(status);
        if (status == ClientStatus.MISREGISTERED) {
            client.setMisregisteredAt(LocalDateTime.of(2026, 4, 1, 9, 0));
            client.setMisregisteredBy(createdBy);
            client.setMisregisteredReason("테스트 오등록");
        }
        return clientRepository.save(client);
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
        session.setMemo("척도 추세 테스트");
        session.setStatus(status);
        if (status == AssessmentSessionStatus.MISENTERED) {
            session.setMisenteredAt(completedAt.plusMinutes(1));
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
            boolean hasAlert,
            LocalDateTime createdAt
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
        SessionScale savedScale = sessionScaleRepository.saveAndFlush(scale);
        savedScale.setCreatedAt(createdAt);
        entityManager.flush();
        return savedScale;
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
}
