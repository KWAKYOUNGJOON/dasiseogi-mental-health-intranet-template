package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@SuppressWarnings("null")
class ClientDetailLegacyAssessmentSchemaIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ClientRepository clientRepository;

    @Test
    void clientDetailAndCreateRemainAvailableWhenLegacyAssessmentSessionsColumnIsMissing() throws Exception {
        renameAssessmentSessionCreatedByColumn();
        MockHttpSession session = login("admina", "Test1234!");
        Client existingClient = findClient("김대상", LocalDate.of(1982, 7, 13));

        mockMvc.perform(get("/api/v1/clients/{clientId}", existingClient.getId()).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(existingClient.getId()))
                .andExpect(jsonPath("$.data.name").value("김대상"))
                .andExpect(jsonPath("$.data.recentSessions").isArray());

        MvcResult createResult = mockMvc.perform(post("/api/v1/clients")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "레거시상세대상",
                                "gender", "FEMALE",
                                "birthDate", "1994-04-12",
                                "phone", "010-7777-8888",
                                "primaryWorkerId", 1L
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andReturn();

        long clientId = body(createResult).path("data").path("id").asLong();

        mockMvc.perform(get("/api/v1/clients/{clientId}", clientId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(clientId))
                .andExpect(jsonPath("$.data.name").value("레거시상세대상"))
                .andExpect(jsonPath("$.data.recentSessions").isArray())
                .andExpect(jsonPath("$.data.recentSessions").isEmpty());
    }

    private void renameAssessmentSessionCreatedByColumn() {
        Integer columnCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'ASSESSMENT_SESSIONS'
                  AND COLUMN_NAME = 'CREATED_BY'
                """,
                Integer.class
        );
        if (columnCount == null || columnCount == 0) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE assessment_sessions ALTER COLUMN created_by RENAME TO legacy_created_by");
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
        return (MockHttpSession) Objects.requireNonNull(
                result.getRequest().getSession(false),
                "Expected a session after successful login"
        );
    }

    private Client findClient(String name, LocalDate birthDate) {
        return clientRepository.findAllByNameAndBirthDate(name, birthDate).stream()
                .findFirst()
                .orElseThrow();
    }

    private JsonNode body(MvcResult result) throws Exception {
        return Objects.requireNonNull(
                objectMapper.readTree(result.getResponse().getContentAsByteArray()),
                "Response body must contain JSON"
        );
    }

    private String json(Object payload) throws Exception {
        return objectMapper.writeValueAsString(payload);
    }
}
