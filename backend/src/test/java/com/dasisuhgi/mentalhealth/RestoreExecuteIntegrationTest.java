package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
import com.dasisuhgi.mentalhealth.backup.service.BackupService;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreHistory;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus;
import com.dasisuhgi.mentalhealth.restore.repository.RestoreHistoryRepository;
import com.dasisuhgi.mentalhealth.restore.service.RestoreService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class RestoreExecuteIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RestoreHistoryRepository restoreHistoryRepository;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private RestoreService restoreService;

    @Autowired
    private BackupService backupService;

    @Test
    void onlyAdminCanExecuteRestore() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");
        MockHttpSession userSession = login("usera", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedDatabaseRestore(adminSession, "MYSQL");

            mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", restoreId)
                            .session(userSession)
                            .contentType(APPLICATION_JSON)
                            .content(executeRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_EXECUTE_FORBIDDEN"));
        });
    }

    @Test
    void returnsNotFoundWhenRestoreHistoryDoesNotExist() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", 999999L)
                        .session(adminSession)
                        .contentType(APPLICATION_JSON)
                        .content(executeRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESTORE_HISTORY_NOT_FOUND"));
    }

    @Test
    void rejectsExecutionWhenRestoreStatusIsNotValidated() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");
        RestoreHistory history = createRestoreHistory(RestoreStatus.UPLOADED, "restore-uploaded.zip");

        mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", history.getId())
                        .session(adminSession)
                        .contentType(APPLICATION_JSON)
                        .content(executeRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("RESTORE_EXECUTE_INVALID_STATUS"));
    }

    @Test
    void rejectsExecutionWhenConfirmationTextDoesNotMatchExactly() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedDatabaseRestore(adminSession, "MYSQL");

            mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", restoreId)
                            .session(adminSession)
                            .contentType(APPLICATION_JSON)
                            .content(executeRequestBody(List.of("DATABASE"), " 전체 복원을 실행합니다 ")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_CONFIRMATION_TEXT_MISMATCH"));

            RestoreHistory history = restoreHistoryRepository.findById(restoreId).orElseThrow();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.VALIDATED);
        });
    }

    @Test
    void rejectsExecutionWhenNoSelectedItemTypeIsProvided() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedDatabaseRestore(adminSession, "MYSQL");

            mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", restoreId)
                            .session(adminSession)
                            .contentType(APPLICATION_JSON)
                            .content(executeRequestBody(List.of(), "전체 복원을 실행합니다")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_ITEM_SELECTION_INVALID"));
        });
    }

    @Test
    void rejectsExecutionWhenUnsupportedItemTypeIsSelected() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedDatabaseRestore(adminSession, "MYSQL");

            mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", restoreId)
                            .session(adminSession)
                            .contentType(APPLICATION_JSON)
                            .content(executeRequestBody(List.of("DATABASE", "CONFIG"), "전체 복원을 실행합니다")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_UNSUPPORTED_ITEM_TYPE"));
        });
    }

    @Test
    void rejectsExecutionWhenDatasourceTypeIsH2() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedDatabaseRestore(adminSession, "H2");

            mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", restoreId)
                            .session(adminSession)
                            .contentType(APPLICATION_JSON)
                            .content(executeRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_UNSUPPORTED_DATASOURCE"));

            RestoreHistory history = restoreHistoryRepository.findById(restoreId).orElseThrow();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.VALIDATED);
        });
    }

    @Test
    void marksRestoreAsPreBackupFailedWhenAutomaticBackupFails() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedDatabaseRestore(adminSession, "MYSQL");
            Path invalidBackupRoot = Files.createTempFile("restore-pre-backup-failure", ".tmp");

            withField(restoreService, "datasourceUrl", "jdbc:mysql://127.0.0.1:3306/mentalhealth", () ->
                    withField(backupService, "backupRootPath", invalidBackupRoot.toString(), () -> {
                        MvcResult result = mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", restoreId)
                                        .session(adminSession)
                                        .contentType(APPLICATION_JSON)
                                        .content(executeRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.restoreId").value(restoreId))
                                .andExpect(jsonPath("$.data.status").value("PRE_BACKUP_FAILED"))
                                .andExpect(jsonPath("$.data.message").value("복원 직전 자동 백업에 실패했습니다."))
                                .andExpect(jsonPath("$.data.failureReason").isString())
                                .andReturn();

                        JsonNode body = body(result).path("data");
                        assertThat(body.path("preBackupId").isNull()).isTrue();

                        RestoreHistory history = restoreHistoryRepository.findById(restoreId).orElseThrow();
                        assertThat(history.getStatus()).isEqualTo(RestoreStatus.PRE_BACKUP_FAILED);
                        assertThat(history.getFailureReason()).contains("백업 경로를 사용할 수 없습니다");
                        assertThat(history.getPreBackupId()).isNull();
                    })
            );
        });
    }

    @Test
    void executesDatabaseRestoreSuccessfullyWithFakeImportCommand() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedDatabaseRestore(adminSession, "MYSQL");
            Path backupRoot = Files.createTempDirectory("restore-execute-backups");
            String fakeImportCommand = createFakeImportCommand(true);

            withFields(Map.of(
                    "datasourceUrl", "jdbc:mysql://127.0.0.1:3306/mentalhealth",
                    "dbImportCommand", fakeImportCommand
            ), restoreService, () ->
                    withFields(Map.of(
                            "backupRootPath", backupRoot.toString(),
                            "datasourceUrl", "jdbc:mysql://127.0.0.1:3306/mentalhealth",
                            "dbDumpCommand", "__missing_dump_command__"
                    ), backupService, () -> {
                        MvcResult result = mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/execute", restoreId)
                                        .session(adminSession)
                                        .contentType(APPLICATION_JSON)
                                        .content(executeRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.restoreId").value(restoreId))
                                .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                                .andExpect(jsonPath("$.data.executedAt").isString())
                                .andExpect(jsonPath("$.data.selectedItemTypes[0]").value("DATABASE"))
                                .andExpect(jsonPath("$.data.preBackupId").isNumber())
                                .andExpect(jsonPath("$.data.preBackupFileName").isString())
                                .andExpect(jsonPath("$.data.message").value("복원 실행이 완료되었습니다."))
                                .andReturn();

                        JsonNode body = body(result).path("data");
                        RestoreHistory history = restoreHistoryRepository.findById(restoreId).orElseThrow();
                        assertThat(history.getStatus()).isEqualTo(RestoreStatus.SUCCESS);
                        assertThat(history.getExecutedAt()).isNotNull();
                        assertThat(history.getSelectedItemTypes()).isEqualTo("DATABASE");
                        assertThat(history.getPreBackupId()).isNotNull();
                        assertThat(history.getPreBackupFileName()).isEqualTo(body.path("preBackupFileName").asText());
                        assertThat(history.getFailureReason()).isNull();
                        assertThat(activityLogRepository.findAll().stream()
                                .anyMatch(log -> log.getActionType() == ActivityActionType.RESTORE_EXECUTE
                                        && restoreId == log.getTargetId()
                                        && log.getDescription() != null
                                        && log.getDescription().contains("복원 실행 성공"))).isTrue();
                    })
            );
        });
    }

    private RestoreHistory createRestoreHistory(RestoreStatus status, String fileName) throws Exception {
        Path tempFile = Files.createTempFile("restore-history-", ".zip");
        RestoreHistory history = new RestoreHistory();
        history.setStatus(status);
        history.setFileName(fileName);
        history.setFilePath(tempFile.toString());
        history.setFileSizeBytes(0L);
        history.setUploadedAt(LocalDateTime.now());
        history.setUploadedById(1L);
        history.setUploadedByNameSnapshot("관리자A");
        return restoreHistoryRepository.saveAndFlush(history);
    }

    private void withTempRestoreRoot(ThrowingRunnable runnable) throws Exception {
        Path tempRoot = Files.createTempDirectory("restore-execute-test");
        withField(restoreService, "restoreRootPath", tempRoot.toString(), runnable);
    }

    private void withField(Object target, String fieldName, Object value, ThrowingRunnable runnable) throws Exception {
        Object originalValue = ReflectionTestUtils.getField(target, fieldName);
        ReflectionTestUtils.setField(target, fieldName, value);
        try {
            runnable.run();
        } finally {
            ReflectionTestUtils.setField(target, fieldName, originalValue);
        }
    }

    private void withFields(Map<String, Object> fieldValues, Object target, ThrowingRunnable runnable) throws Exception {
        Map<String, Object> originals = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : fieldValues.entrySet()) {
            originals.put(entry.getKey(), ReflectionTestUtils.getField(target, entry.getKey()));
            ReflectionTestUtils.setField(target, entry.getKey(), entry.getValue());
        }
        try {
            runnable.run();
        } finally {
            for (Map.Entry<String, Object> entry : originals.entrySet()) {
                ReflectionTestUtils.setField(target, entry.getKey(), entry.getValue());
            }
        }
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

    private long uploadValidatedDatabaseRestore(MockHttpSession session, String datasourceType) throws Exception {
        Map<String, byte[]> payloadEntries = standardPayloadEntries(true);
        Map<String, Object> manifest = standardManifest(manifestEntries(payloadEntries), datasourceType, 9001L, true);

        MvcResult uploadResult = mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                        .file(new MockMultipartFile(
                                "file",
                                "restore-database.zip",
                                "application/zip",
                                createStandardZip(manifest, payloadEntries)
                        ))
                        .session(session))
                .andExpect(status().isOk())
                .andReturn();

        return body(uploadResult).path("data").path("restoreId").asLong();
    }

    private String executeRequestBody(List<String> selectedItemTypes, String confirmationText) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "selectedItemTypes", selectedItemTypes,
                "confirmationText", confirmationText
        ));
    }

    private Map<String, byte[]> standardPayloadEntries(boolean includeDatabaseDump) {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        entries.put("config/application.yml", "app:\n  name: test\n".getBytes(StandardCharsets.UTF_8));
        entries.put("config/application-prod.yml", "spring:\n  profiles: prod\n".getBytes(StandardCharsets.UTF_8));
        entries.put("scales/test-scale.json", "{\"code\":\"TEST\"}".getBytes(StandardCharsets.UTF_8));
        entries.put("metadata/summary.json", "{\"summary\":\"ok\"}".getBytes(StandardCharsets.UTF_8));
        if (includeDatabaseDump) {
            entries.put("db/database.sql", "create table test (id bigint);\n".getBytes(StandardCharsets.UTF_8));
        }
        return entries;
    }

    private Map<String, Object> standardManifest(
            List<Map<String, Object>> entries,
            String datasourceType,
            long backupId,
            boolean includesDatabaseDump
    ) {
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("formatVersion", "FULL_BACKUP_ZIP_V1");
        manifest.put("createdAt", "2026-04-04T12:00:00+09:00");
        manifest.put("datasourceType", datasourceType);
        manifest.put("appVersion", "unknown");
        manifest.put("backupId", backupId);
        manifest.put("executedBy", Map.of("loginId", "admina", "name", "관리자A"));
        manifest.put("profile", "test");
        manifest.put("environment", "test");
        manifest.put("summary", Map.of(
                "backupType", "MANUAL",
                "backupMethod", includesDatabaseDump ? "DB_DUMP" : "SNAPSHOT",
                "datasourceType", datasourceType,
                "includesDatabaseDump", includesDatabaseDump,
                "userCount", 3,
                "clientCount", 2,
                "sessionCount", 1,
                "reason", "restore execute integration test"
        ));
        manifest.put("entries", entries);
        return manifest;
    }

    private List<Map<String, Object>> manifestEntries(Map<String, byte[]> payloadEntries) {
        List<Map<String, Object>> manifestEntries = new ArrayList<>();
        for (Map.Entry<String, byte[]> entry : payloadEntries.entrySet()) {
            Map<String, Object> manifestEntry = new HashMap<>();
            manifestEntry.put("itemType", itemType(entry.getKey()));
            manifestEntry.put("relativePath", entry.getKey());
            manifestEntry.put("size", entry.getValue().length);
            manifestEntry.put("sha256", sha256(entry.getValue()));
            manifestEntries.add(manifestEntry);
        }
        return manifestEntries;
    }

    private String itemType(String relativePath) {
        if ("db/database.sql".equals(relativePath)) {
            return "DATABASE_DUMP";
        }
        if (relativePath.startsWith("config/")) {
            return "CONFIG_FILE";
        }
        if (relativePath.startsWith("scales/")) {
            return "SCALE_JSON";
        }
        if (relativePath.startsWith("metadata/")) {
            return "METADATA_SUMMARY";
        }
        return "FILE";
    }

    private byte[] createStandardZip(Map<String, Object> manifest, Map<String, byte[]> payloadEntries) throws Exception {
        Map<String, byte[]> zipEntries = new LinkedHashMap<>();
        zipEntries.put("manifest.json", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(manifest));
        zipEntries.putAll(payloadEntries);
        return createZip(zipEntries);
    }

    private byte[] createZip(Map<String, byte[]> entries) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        try (ZipOutputStream zipOutputStream = new ZipOutputStream(outputStream, StandardCharsets.UTF_8)) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                zipOutputStream.putNextEntry(new ZipEntry(entry.getKey()));
                zipOutputStream.write(entry.getValue());
                zipOutputStream.closeEntry();
            }
        }
        return outputStream.toByteArray();
    }

    private String sha256(byte[] bytes) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private String createFakeImportCommand(boolean succeed) throws Exception {
        if (System.getProperty("os.name", "").toLowerCase().contains("windows")) {
            Path script = Files.createTempFile("fake-db-import-", ".cmd");
            Files.writeString(script, """
                    @echo off
                    if "%1"=="--version" exit /b 0
                    more > nul
                    """ + (succeed ? "exit /b 0" : "echo forced failure 1>&2\r\nexit /b 1") + "\r\n");
            return script.toString();
        }

        Path script = Files.createTempFile("fake-db-import-", ".sh");
        Files.writeString(script, """
                #!/bin/sh
                if [ "$1" = "--version" ]; then
                  exit 0
                fi
                cat >/dev/null
                """ + (succeed ? "exit 0" : "echo forced failure 1>&2\nexit 1") + "\n");
        script.toFile().setExecutable(true);
        return script.toString();
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
