package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus;
import com.dasisuhgi.mentalhealth.restore.repository.RestoreHistoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Comparator;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@SuppressWarnings("null")
class RestoreUploadLegacyActivityLogSchemaIntegrationTest {
    private static final Path TEMP_DIRECTORY = createTempDirectory();
    private static final Path BACKUP_ROOT = createDirectory(TEMP_DIRECTORY.resolve("backups"));
    private static final Path RESTORE_ROOT = createDirectory(TEMP_DIRECTORY.resolve("restores"));
    private static final String JDBC_URL = "jdbc:h2:file:" + TEMP_DIRECTORY.resolve("legacy-restore-upload-db").toAbsolutePath()
            + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE";

    static {
        initializeLegacyActivityLogSchema();
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private RestoreHistoryRepository restoreHistoryRepository;

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
        registry.add("spring.datasource.username", () -> "sa");
        registry.add("spring.datasource.password", () -> "");
        registry.add("spring.datasource.driver-class-name", () -> "org.h2.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        registry.add("app.backup.root-path", () -> BACKUP_ROOT.toString());
        registry.add("app.restore.root-path", () -> RESTORE_ROOT.toString());
        registry.add("app.backup.auto.enabled", () -> "false");
    }

    @Test
    void uploadsStandardBackupZipSuccessfullyEvenWhenLegacyActivityLogEnumSchemaExists() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");

        MvcResult backupRunResult = mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "legacy activity log schema restore upload test"))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode backupData = body(backupRunResult).path("data");
        byte[] backupZipBytes = Files.readAllBytes(Path.of(backupData.path("filePath").asText()));

        mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                        .file(new MockMultipartFile("file", backupData.path("fileName").asText(), "application/zip", backupZipBytes))
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("VALIDATED"))
                .andExpect(jsonPath("$.data.fileName").value(backupData.path("fileName").asText()))
                .andExpect(jsonPath("$.data.formatVersion").value("FULL_BACKUP_ZIP_V1"));

        assertThat(restoreHistoryRepository.findAll()).isNotEmpty();
        assertThat(restoreHistoryRepository.findAll().stream()
                .max(Comparator.comparing(history -> history.getId()))
                .orElseThrow()
                .getStatus()).isEqualTo(RestoreStatus.VALIDATED);

        assertThat(activityLogRepository.findAll().stream()
                .anyMatch(log -> log.getActionType() == ActivityActionType.RESTORE_UPLOAD
                        && log.getTargetType() == ActivityTargetType.RESTORE))
                .isTrue();
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

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private static Path createTempDirectory() {
        try {
            return Files.createTempDirectory("restore-upload-legacy-activity-log");
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to create temp directory for restore upload legacy schema test", exception);
        }
    }

    private static Path createDirectory(Path path) {
        try {
            return Files.createDirectories(path);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to create directory: " + path, exception);
        }
    }

    private static void initializeLegacyActivityLogSchema() {
        try (var connection = DriverManager.getConnection(JDBC_URL, "sa", "");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE activity_logs (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        user_id BIGINT NULL,
                        user_name_snapshot VARCHAR(50) NULL,
                        action_type ENUM(
                            'BACKUP_RUN',
                            'CLIENT_CREATE',
                            'CLIENT_MARK_MISREGISTERED',
                            'CLIENT_UPDATE',
                            'LOGIN',
                            'PRINT_SESSION',
                            'SESSION_CREATE',
                            'SESSION_MARK_MISENTERED',
                            'SIGNUP_APPROVE',
                            'SIGNUP_REJECT',
                            'SIGNUP_REQUEST',
                            'STATISTICS_EXPORT',
                            'USER_PROFILE_UPDATE',
                            'USER_ROLE_CHANGE',
                            'USER_STATUS_CHANGE'
                        ) NOT NULL,
                        target_type ENUM(
                            'BACKUP',
                            'CLIENT',
                            'SESSION',
                            'SIGNUP_REQUEST',
                            'STATISTICS',
                            'USER'
                        ),
                        target_id BIGINT NULL,
                        target_label VARCHAR(255) NULL,
                        description VARCHAR(500) NULL,
                        ip_address VARCHAR(45) NULL,
                        created_at TIMESTAMP NOT NULL
                    )
                    """);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to initialize legacy activity_logs schema", exception);
        }
    }
}
