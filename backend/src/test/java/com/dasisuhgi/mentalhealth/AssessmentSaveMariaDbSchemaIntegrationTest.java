package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("mariadb")
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@AutoConfigureMockMvc
class AssessmentSaveMariaDbSchemaIntegrationTest {
    @Container
    static final MariaDBContainer<?> MARIADB = new MariaDBContainer<>("mariadb:11.4");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MARIADB::getJdbcUrl);
        registry.add("spring.datasource.username", MARIADB::getUsername);
        registry.add("spring.datasource.password", MARIADB::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.mariadb.jdbc.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.sql.init.mode", () -> "always");
        registry.add("spring.sql.init.schema-locations", () -> "classpath:schema.sql");
        registry.add("app.seed.enabled", () -> true);
    }

    @Test
    void savePhq9SessionAgainstSchemaSqlOnMariaDb() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "MariaDB schema PHQ9", List.of(
                                scaleRequest("PHQ9", 0, 0, 0, 0, 0, 0, 0, 0, 1)
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(1))
                .andExpect(jsonPath("$.data.hasAlert").value(true))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scales[0].totalScore").value(1))
                .andExpect(jsonPath("$.data.scales[0].alerts[0].alertCode").value("PHQ9_ITEM9_ANY"));
    }

    @Test
    void savePhq9AndGad7SessionAgainstSchemaSqlOnMariaDb() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "MariaDB schema PHQ9 + GAD7", List.of(
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
    void saveSessionWithBlankMemoAgainstSchemaSqlOnMariaDb() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        MvcResult saveResult = mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(sessionSaveRequest(client.getId(), "   ", List.of(
                                scaleRequest("PHQ9", 0, 0, 0, 0, 0, 0, 0, 0, 1),
                                scaleRequest("GAD7", 3, 3, 2, 2, 2, 2, 1)
                        )))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.scaleCount").value(2))
                .andReturn();

        long sessionId = body(saveResult).path("data").path("sessionId").asLong();

        mockMvc.perform(get("/api/v1/assessment-sessions/{sessionId}", sessionId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memo").isEmpty())
                .andExpect(jsonPath("$.data.scales[0].scaleCode").value("PHQ9"))
                .andExpect(jsonPath("$.data.scales[1].scaleCode").value("GAD7"));
    }

    @Test
    void createClientAndFetchDetailAgainstSchemaSqlOnMariaDb() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");

        MvcResult createResult = mockMvc.perform(post("/api/v1/clients")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "마리아신규대상",
                                "gender", "FEMALE",
                                "birthDate", "1991-05-17",
                                "phone", "010-1111-2222",
                                "primaryWorkerId", 2L
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.clientNo").isString())
                .andReturn();

        long clientId = body(createResult).path("data").path("id").asLong();

        mockMvc.perform(get("/api/v1/clients/{clientId}", clientId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(clientId))
                .andExpect(jsonPath("$.data.name").value("마리아신규대상"))
                .andExpect(jsonPath("$.data.birthDate").value("1991-05-17"))
                .andExpect(jsonPath("$.data.phone").value("010-1111-2222"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.recentSessions").isArray())
                .andExpect(jsonPath("$.data.recentSessions").isEmpty());
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

    private Client findClient(String name, LocalDate birthDate) {
        return clientRepository.findAllByNameAndBirthDate(name, birthDate).stream()
                .findFirst()
                .orElseThrow();
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String json(Object payload) throws Exception {
        return objectMapper.writeValueAsString(payload);
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

    private Map<String, Object> answer(int questionNo, String answerValue) {
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("questionNo", questionNo);
        answer.put("answerValue", answerValue);
        return answer;
    }
}
