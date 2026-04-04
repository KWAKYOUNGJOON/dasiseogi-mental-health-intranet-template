package com.dasisuhgi.mentalhealth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.Test;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class AdminOperationsSmokeIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void seededAdminSessionCanSmokeTestAdminOperationsEndpoints() throws Exception {
        MockHttpSession adminSession = Objects.requireNonNull(
                login("admina", "Test1234!"),
                "POST /api/v1/auth/login should create a session for the seeded admin account"
        );
        assertThat(adminSession)
                .as("POST /api/v1/auth/login should create a session for the seeded admin account")
                .isNotNull();

        MvcResult healthResult = mockMvc.perform(get("/api/v1/health").session(adminSession))
                .andReturn();
        JsonNode healthBody = body(healthResult);

        assertThat(healthResult.getResponse().getStatus())
                .as("GET /api/v1/health should return 200 for a healthy seeded application")
                .isEqualTo(200);
        assertThat(healthBody.path("success").asBoolean())
                .as("GET /api/v1/health should return success=true")
                .isTrue();
        assertThat(healthBody.path("data").path("status").asText())
                .as("GET /api/v1/health should report overall status UP")
                .isEqualTo("UP");
        assertThat(healthBody.path("data").path("dbStatus").asText())
                .as("GET /api/v1/health should report database status UP")
                .isEqualTo("UP");
        assertThat(healthBody.path("data").path("scaleRegistryStatus").asText())
                .as("GET /api/v1/health should report scale registry status UP")
                .isEqualTo("UP");
        assertThat(healthBody.path("data").path("loadedScaleCount").asInt())
                .as("GET /api/v1/health should expose at least one loaded scale definition")
                .isGreaterThan(0);

        MvcResult signupRequestsResult = mockMvc.perform(get("/api/v1/admin/signup-requests")
                        .session(adminSession)
                        .param("status", "PENDING"))
                .andReturn();
        JsonNode signupRequestsBody = body(signupRequestsResult);
        JsonNode pendingRequest = findByField(signupRequestsBody.path("data").path("items"), "loginId", "pendinguser");

        assertThat(signupRequestsResult.getResponse().getStatus())
                .as("GET /api/v1/admin/signup-requests?status=PENDING should return 200 for an admin session")
                .isEqualTo(200);
        assertThat(signupRequestsBody.path("success").asBoolean())
                .as("GET /api/v1/admin/signup-requests?status=PENDING should return success=true")
                .isTrue();
        assertThat(signupRequestsBody.path("data").path("items").isArray())
                .as("GET /api/v1/admin/signup-requests?status=PENDING should return a paged items array")
                .isTrue();
        assertThat(signupRequestsBody.path("data").path("totalItems").asLong())
                .as("GET /api/v1/admin/signup-requests?status=PENDING should expose at least one pending request")
                .isGreaterThan(0L);
        assertThat(pendingRequest)
                .as("GET /api/v1/admin/signup-requests?status=PENDING should include the seeded pendinguser request")
                .isNotNull();
        assertThat(pendingRequest.path("requestStatus").asText())
                .as("GET /api/v1/admin/signup-requests?status=PENDING should keep the seeded request in PENDING status")
                .isEqualTo("PENDING");

        MvcResult usersResult = mockMvc.perform(get("/api/v1/admin/users").session(adminSession))
                .andReturn();
        JsonNode usersBody = body(usersResult);
        JsonNode adminUser = findByField(usersBody.path("data").path("items"), "loginId", "admina");

        assertThat(usersResult.getResponse().getStatus())
                .as("GET /api/v1/admin/users should return 200 for an admin session")
                .isEqualTo(200);
        assertThat(usersBody.path("success").asBoolean())
                .as("GET /api/v1/admin/users should return success=true")
                .isTrue();
        assertThat(usersBody.path("data").path("items").isArray())
                .as("GET /api/v1/admin/users should return a paged items array")
                .isTrue();
        assertThat(usersBody.path("data").path("totalItems").asLong())
                .as("GET /api/v1/admin/users should list at least one user")
                .isGreaterThan(0L);
        assertThat(adminUser)
                .as("GET /api/v1/admin/users should include the seeded admin account")
                .isNotNull();
        assertThat(adminUser.path("role").asText())
                .as("GET /api/v1/admin/users should report the seeded admin account with ADMIN role")
                .isEqualTo("ADMIN");
        assertThat(adminUser.path("status").asText())
                .as("GET /api/v1/admin/users should report the seeded admin account with ACTIVE status")
                .isEqualTo("ACTIVE");

        MvcResult activityLogsResult = mockMvc.perform(get("/api/v1/admin/activity-logs").session(adminSession))
                .andReturn();
        JsonNode activityLogsBody = body(activityLogsResult);
        JsonNode adminLoginLog = findByField(activityLogsBody.path("data").path("items"), "targetLabel", "admina");

        assertThat(activityLogsResult.getResponse().getStatus())
                .as("GET /api/v1/admin/activity-logs should return 200 for an admin session")
                .isEqualTo(200);
        assertThat(activityLogsBody.path("success").asBoolean())
                .as("GET /api/v1/admin/activity-logs should return success=true")
                .isTrue();
        assertThat(activityLogsBody.path("data").path("items").isArray())
                .as("GET /api/v1/admin/activity-logs should return a paged items array")
                .isTrue();
        assertThat(activityLogsBody.path("data").path("totalItems").asLong())
                .as("GET /api/v1/admin/activity-logs should expose at least one activity record after admin login")
                .isGreaterThan(0L);
        assertThat(adminLoginLog)
                .as("GET /api/v1/admin/activity-logs should include the seeded admin login record")
                .isNotNull();
        assertThat(adminLoginLog.path("actionType").asText())
                .as("GET /api/v1/admin/activity-logs should expose the admin login record as LOGIN action")
                .isEqualTo("LOGIN");

        MvcResult backupsResult = mockMvc.perform(get("/api/v1/admin/backups").session(adminSession))
                .andReturn();
        JsonNode backupsBody = body(backupsResult);

        assertThat(backupsResult.getResponse().getStatus())
                .as("GET /api/v1/admin/backups should return 200 for an admin session")
                .isEqualTo(200);
        assertThat(backupsBody.path("success").asBoolean())
                .as("GET /api/v1/admin/backups should return success=true")
                .isTrue();
        assertThat(backupsBody.path("data").path("items").isArray())
                .as("GET /api/v1/admin/backups should return a paged items array even before a manual run")
                .isTrue();
        assertThat(backupsBody.path("data").path("totalItems").asLong())
                .as("GET /api/v1/admin/backups should return a non-negative total item count")
                .isGreaterThanOrEqualTo(0L);

        MvcResult backupRunResult = mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(adminSession)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", "관리자 운영 스모크 진단"))))
                .andReturn();
        JsonNode backupRunBody = body(backupRunResult);

        assertThat(backupRunResult.getResponse().getStatus())
                .as("POST /api/v1/admin/backups/run should return 200 for an admin session on H2")
                .isEqualTo(200);
        assertThat(backupRunBody.path("success").asBoolean())
                .as("POST /api/v1/admin/backups/run should return success=true")
                .isTrue();
        assertThat(backupRunBody.path("data").path("backupId").asLong())
                .as("POST /api/v1/admin/backups/run should return a persisted backupId")
                .isGreaterThan(0L);
        assertThat(backupRunBody.path("data").path("status").asText())
                .as("POST /api/v1/admin/backups/run should finish with SUCCESS status")
                .isEqualTo("SUCCESS");
        assertThat(backupRunBody.path("data").path("backupMethod").asText())
                .as("POST /api/v1/admin/backups/run should use SNAPSHOT method in the H2 test environment")
                .isEqualTo("SNAPSHOT");
        assertThat(backupRunBody.path("data").path("datasourceType").asText())
                .as("POST /api/v1/admin/backups/run should identify the H2 test datasource")
                .isEqualTo("H2");
        assertThat(backupRunBody.path("data").path("preflightSummary").asText())
                .as("POST /api/v1/admin/backups/run should expose a preflight summary that records SNAPSHOT selection")
                .contains("preferred=SNAPSHOT");
        assertThat(backupRunBody.path("data").path("fileName").asText())
                .as("POST /api/v1/admin/backups/run should return the generated backup file name")
                .startsWith("backup-");
        assertThat(backupRunBody.path("data").path("filePath").asText())
                .as("POST /api/v1/admin/backups/run should return the generated backup file path")
                .isNotBlank();
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
        Object session = Objects.requireNonNull(
                result.getRequest().getSession(false),
                "Expected a session after successful login"
        );
        assertThat(session).isInstanceOf(MockHttpSession.class);
        return (MockHttpSession) session;
    }

    private JsonNode body(MvcResult result) throws Exception {
        return Objects.requireNonNull(
                objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8)),
                "Response body must contain JSON"
        );
    }

    private JsonNode findByField(JsonNode items, String fieldName, String expectedValue) {
        for (JsonNode item : items) {
            if (expectedValue.equals(item.path(fieldName).asText())) {
                return item;
            }
        }
        return null;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
