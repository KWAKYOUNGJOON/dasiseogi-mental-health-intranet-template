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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("mariadb")
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MariaDbCompatibilityTest {
    @Container
    static final MariaDBContainer<?> MARIADB = new MariaDBContainer<>("mariadb:11.4");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MARIADB::getJdbcUrl);
        registry.add("spring.datasource.username", MARIADB::getUsername);
        registry.add("spring.datasource.password", MARIADB::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.mariadb.jdbc.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("app.seed.enabled", () -> true);
    }

    @Test
    void assessmentRecordsProjectionFilterAndPageableWorkOnMariaDb() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("마리아조회대상", LocalDate.of(1992, 2, 2), userA, ClientStatus.ACTIVE);

        AssessmentSession newestSession = saveSession(client, userA, "AS-MARIA-002", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 9, 0), 1, true);
        saveSessionScale(newestSession, "PHQ9", "PHQ-9", 1, 12, "중등도", true);

        AssessmentSession olderSession = saveSession(client, userA, "AS-MARIA-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 24, 9, 0), 1, false);
        saveSessionScale(olderSession, "PHQ9", "PHQ-9", 1, 4, "정상", false);

        mockMvc.perform(get("/api/v1/assessment-records")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29")
                        .param("clientName", "마리아조회")
                        .param("scaleCode", "PHQ9")
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items[0].sessionNo").value("AS-MARIA-002"));
    }

    @Test
    void statisticsSummaryAndScalesAggregateCorrectlyOnMariaDb() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client activeClient = saveClient("마리아통계대상", LocalDate.of(1986, 6, 6), userA, ClientStatus.ACTIVE);
        Client misregisteredClient = saveClient("마리아오등록", LocalDate.of(1987, 6, 6), userA, ClientStatus.MISREGISTERED);

        AssessmentSession completedSession = saveSession(activeClient, userA, "AS-MARIA-SUM-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 27, 14, 0), 2, true);
        SessionScale phq9 = saveSessionScale(completedSession, "PHQ9", "PHQ-9", 1, 11, "중등도", true);
        saveSessionAlert(completedSession, phq9, AlertType.CRITICAL_ITEM, "PHQ9_ITEM9_ANY", "요주의");
        saveSessionScale(completedSession, "GAD7", "GAD-7", 2, 7, "중등도", false);

        AssessmentSession misregisteredSession = saveSession(misregisteredClient, userA, "AS-MARIA-SUM-002", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 27, 16, 0), 1, true);
        SessionScale hiddenScale = saveSessionScale(misregisteredSession, "PHQ9", "PHQ-9", 1, 14, "중등도", true);
        saveSessionAlert(misregisteredSession, hiddenScale, AlertType.HIGH_RISK, "PHQ9_HIGH", "숨김");

        mockMvc.perform(get("/api/v1/statistics/summary")
                        .session(session)
                        .param("dateFrom", "2026-03-24")
                        .param("dateTo", "2026-03-29"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalSessionCount").value(1))
                .andExpect(jsonPath("$.data.totalScaleCount").value(2))
                .andExpect(jsonPath("$.data.alertSessionCount").value(1))
                .andExpect(jsonPath("$.data.alertScaleCount").value(1));

        JsonNode scaleItems = data("/api/v1/statistics/scales?dateFrom=2026-03-24&dateTo=2026-03-29", session).path("items");
        JsonNode phq9Item = findByField(scaleItems, "scaleCode", "PHQ9");
        JsonNode gad7Item = findByField(scaleItems, "scaleCode", "GAD7");

        assertThat(phq9Item.path("isActive").asBoolean()).isTrue();
        assertThat(phq9Item.path("totalCount").asLong()).isEqualTo(1L);
        assertThat(gad7Item.path("isActive").asBoolean()).isTrue();
        assertThat(gad7Item.path("totalCount").asLong()).isEqualTo(1L);
    }

    @Test
    void statisticsAlertsFiltersByScaleCodeAndAlertTypeOnMariaDb() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User userA = findUser("usera");
        Client client = saveClient("마리아경고대상", LocalDate.of(1988, 8, 8), userA, ClientStatus.ACTIVE);

        AssessmentSession matchingSession = saveSession(client, userA, "AS-MARIA-ALERT-001", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 10, 0), 1, true);
        SessionScale matchingScale = saveSessionScale(matchingSession, "PHQ9", "PHQ-9", 1, 16, "중증", true);
        saveSessionAlert(matchingSession, matchingScale, AlertType.CRITICAL_ITEM, "PHQ9_ITEM9_ANY", "일치");

        AssessmentSession hiddenByScale = saveSession(client, userA, "AS-MARIA-ALERT-002", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 11, 0), 1, true);
        SessionScale otherScale = saveSessionScale(hiddenByScale, "GAD7", "GAD-7", 1, 9, "중등도", true);
        saveSessionAlert(hiddenByScale, otherScale, AlertType.CRITICAL_ITEM, "GAD7_HIGH", "척도 불일치");

        AssessmentSession hiddenByType = saveSession(client, userA, "AS-MARIA-ALERT-003", AssessmentSessionStatus.COMPLETED,
                LocalDateTime.of(2026, 3, 28, 12, 0), 1, true);
        SessionScale otherType = saveSessionScale(hiddenByType, "PHQ9", "PHQ-9", 1, 9, "경도", true);
        saveSessionAlert(hiddenByType, otherType, AlertType.CAUTION, "PHQ9_CAUTION", "유형 불일치");

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
    void loginWorksAgainstMariaDbContainer() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "loginId", "usera",
                                "password", "Test1234!"
                        ))))
                .andExpect(status().isOk());
    }

    private MockHttpSession login(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "loginId", loginId,
                                "password", password
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private JsonNode data(String path, MockHttpSession session) throws Exception {
        MvcResult result = mockMvc.perform(get(path).session(session))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsByteArray()).path("data");
    }

    private JsonNode findByField(JsonNode arrayNode, String fieldName, String expectedValue) {
        for (JsonNode node : arrayNode) {
            if (expectedValue.equals(node.path(fieldName).asText())) {
                return node;
            }
        }
        throw new AssertionError("field not found: " + fieldName + "=" + expectedValue);
    }

    private User findUser(String loginId) {
        return userRepository.findByLoginId(loginId).orElseThrow();
    }

    private Client saveClient(String name, LocalDate birthDate, User createdBy, ClientStatus status) {
        Client client = new Client();
        client.setClientNo("CL-MARIA-" + System.nanoTime());
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
        session.setSessionStartedAt(completedAt.minusMinutes(15));
        session.setSessionCompletedAt(completedAt);
        session.setPerformedBy(performedBy);
        session.setScaleCount(scaleCount);
        session.setHasAlert(hasAlert);
        session.setMemo("MariaDB 테스트");
        session.setStatus(status);
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
}
