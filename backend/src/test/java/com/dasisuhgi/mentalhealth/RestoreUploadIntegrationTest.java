package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityLog;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
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
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class RestoreUploadIntegrationTest {
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

    @Test
    void onlyAdminCanUploadRestoreZip() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "restore.zip",
                "application/zip",
                createZip(Map.of("notes.txt", "not a restore zip".getBytes(StandardCharsets.UTF_8)))
        );

        mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                        .file(file)
                        .session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("RESTORE_UPLOAD_FORBIDDEN"));
    }

    @Test
    void onlyAdminCanViewRestoreDetail() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");
        MockHttpSession userSession = login("usera", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedRestore(adminSession).path("data").path("restoreId").asLong();

            mockMvc.perform(get("/api/v1/admin/restores/{restoreId}", restoreId)
                            .session(userSession))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_DETAIL_FORBIDDEN"));
        });
    }

    @Test
    void returnsNotFoundWhenRestoreHistoryDoesNotExist() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");

        mockMvc.perform(get("/api/v1/admin/restores/{restoreId}", 999999L)
                        .session(session))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESTORE_HISTORY_NOT_FOUND"));
    }

    @Test
    void rejectsNonZipFile() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        withTempRestoreRoot(() -> {
            mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                            .file(new MockMultipartFile("file", "restore.txt", "text/plain", "plain text".getBytes(StandardCharsets.UTF_8)))
                            .session(session))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_FILE_INVALID"));

            RestoreHistory history = latestRestoreHistory();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.FAILED);
        });
    }

    @Test
    void failsWhenManifestIsMissing() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        byte[] zipBytes = createZip(Map.of(
                "config/application.yml", "app: test".getBytes(StandardCharsets.UTF_8)
        ));

        withTempRestoreRoot(() -> {
            mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                            .file(new MockMultipartFile("file", "missing-manifest.zip", "application/zip", zipBytes))
                            .session(session))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_MANIFEST_INVALID"));

            RestoreHistory history = latestRestoreHistory();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.FAILED);
            assertThat(history.getFailureReason()).contains("manifest.json");
        });
    }

    @Test
    void failsWhenManifestRequiredFieldIsMissing() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        Map<String, byte[]> payloadEntries = minimalPayloadEntries();
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("formatVersion", "FULL_BACKUP_ZIP_V1");
        manifest.put("createdAt", "2026-04-04T12:00:00+09:00");
        manifest.put("datasourceType", "H2");
        manifest.put("appVersion", "unknown");
        manifest.put("backupId", 1L);
        manifest.put("executedBy", Map.of("loginId", "admina", "name", "관리자A"));
        manifest.put("profile", "test");
        manifest.put("environment", "test");
        // summary omitted
        manifest.put("entries", manifestEntries(payloadEntries));

        byte[] zipBytes = createStandardZip(manifest, payloadEntries);

        withTempRestoreRoot(() -> {
            mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                            .file(new MockMultipartFile("file", "manifest-missing-field.zip", "application/zip", zipBytes))
                            .session(session))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_MANIFEST_INVALID"));

            RestoreHistory history = latestRestoreHistory();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.FAILED);
        });
    }

    @Test
    void returnsValidatedRestoreDetailAndDetectedItemsConsistentWithUploadResponse() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            JsonNode uploadBody = uploadValidatedRestore(session);
            long restoreId = uploadBody.path("data").path("restoreId").asLong();

            MvcResult detailResult = mockMvc.perform(get("/api/v1/admin/restores/{restoreId}", restoreId)
                            .session(session))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.restoreId").value(restoreId))
                    .andExpect(jsonPath("$.data.status").value("VALIDATED"))
                    .andExpect(jsonPath("$.data.fileName").value(uploadBody.path("data").path("fileName").asText()))
                    .andExpect(jsonPath("$.data.uploadedAt").isString())
                    .andExpect(jsonPath("$.data.validatedAt").isString())
                    .andExpect(jsonPath("$.data.uploadedByName").value("관리자A"))
                    .andExpect(jsonPath("$.data.formatVersion").value("FULL_BACKUP_ZIP_V1"))
                    .andExpect(jsonPath("$.data.datasourceType").value("H2"))
                    .andExpect(jsonPath("$.data.backupId").value(uploadBody.path("data").path("backupId").asLong()))
                    .andExpect(jsonPath("$.data.failureReason").doesNotExist())
                    .andReturn();

            JsonNode detailBody = body(detailResult);
            assertThat(detailBody.path("data").path("detectedItems"))
                    .isEqualTo(uploadBody.path("data").path("detectedItems"));
        });
    }

    @Test
    void uploadsAndValidatesStandardBackupZipSuccessfully() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        MvcResult backupRunResult = mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "restore validation success test"))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode backupData = body(backupRunResult).path("data");
        Path backupPath = Path.of(backupData.path("filePath").asText());
        byte[] backupZipBytes = Files.readAllBytes(backupPath);

        withTempRestoreRoot(() -> {
            mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                            .file(new MockMultipartFile("file", backupData.path("fileName").asText(), "application/zip", backupZipBytes))
                            .session(session))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.restoreId").isNumber())
                    .andExpect(jsonPath("$.data.status").value("VALIDATED"))
                    .andExpect(jsonPath("$.data.fileName").value(backupData.path("fileName").asText()))
                    .andExpect(jsonPath("$.data.validatedAt").isString())
                    .andExpect(jsonPath("$.data.formatVersion").value("FULL_BACKUP_ZIP_V1"))
                    .andExpect(jsonPath("$.data.datasourceType").value("H2"))
                    .andExpect(jsonPath("$.data.backupId").value(backupData.path("backupId").asLong()))
                    .andExpect(jsonPath("$.data.detectedItems[*].itemType").value(org.hamcrest.Matchers.hasItems("CONFIG", "SCALES", "METADATA")))
                    .andExpect(jsonPath("$.data.failureReason").doesNotExist());

            RestoreHistory history = latestRestoreHistory();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.VALIDATED);
            assertThat(history.getFormatVersion()).isEqualTo("FULL_BACKUP_ZIP_V1");
            assertThat(history.getDatasourceType()).isEqualTo("H2");
            assertThat(history.getBackupId()).isEqualTo(backupData.path("backupId").asLong());
            assertThat(Path.of(history.getFilePath())).exists();

            ActivityLog log = latestActivityLog(ActivityActionType.RESTORE_UPLOAD);
            assertThat(log.getTargetType()).isEqualTo(ActivityTargetType.RESTORE);
            assertThat(log.getTargetId()).isEqualTo(history.getId());
            assertThat(log.getTargetLabel()).isEqualTo(history.getFileName());
            assertThat(log.getDescription()).contains("복원 ZIP 업로드 및 검증 성공");
        });
    }

    @Test
    void returnsFailedRestoreDetailWithFailureReasonAndEmptyDetectedItems() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        byte[] zipBytes = createZip(Map.of(
                "config/application.yml", "app: test".getBytes(StandardCharsets.UTF_8)
        ));

        withTempRestoreRoot(() -> {
            mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                            .file(new MockMultipartFile("file", "missing-manifest.zip", "application/zip", zipBytes))
                            .session(session))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_MANIFEST_INVALID"));

            RestoreHistory history = latestRestoreHistory();

            mockMvc.perform(get("/api/v1/admin/restores/{restoreId}", history.getId())
                            .session(session))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.restoreId").value(history.getId()))
                    .andExpect(jsonPath("$.data.status").value("FAILED"))
                    .andExpect(jsonPath("$.data.failureReason").value(org.hamcrest.Matchers.containsString("manifest.json")))
                    .andExpect(jsonPath("$.data.detectedItems").isArray())
                    .andExpect(jsonPath("$.data.detectedItems").isEmpty());
        });
    }

    @Test
    void failsWhenValidatedRestoreArchiveIsMissingDuringDetailLookup() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            JsonNode uploadBody = uploadValidatedRestore(session);
            long restoreId = uploadBody.path("data").path("restoreId").asLong();
            RestoreHistory history = restoreHistoryRepository.findById(restoreId).orElseThrow();
            Files.delete(Path.of(history.getFilePath()));

            mockMvc.perform(get("/api/v1/admin/restores/{restoreId}", restoreId)
                            .session(session))
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_ARCHIVE_UNAVAILABLE"));
        });
    }

    @Test
    void failsWhenManifestEntriesDoNotMatchActualZipEntries() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        Map<String, byte[]> payloadEntries = minimalPayloadEntries();
        List<Map<String, Object>> manifestEntries = new ArrayList<>(manifestEntries(payloadEntries));
        Map<String, Object> firstEntry = manifestEntries.get(0);
        firstEntry.put("relativePath", "config/missing.yml");

        Map<String, Object> manifest = standardManifest(manifestEntries);
        byte[] zipBytes = createStandardZip(manifest, payloadEntries);

        withTempRestoreRoot(() -> {
            mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                            .file(new MockMultipartFile("file", "entry-mismatch.zip", "application/zip", zipBytes))
                            .session(session))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_MANIFEST_INVALID"));

            RestoreHistory history = latestRestoreHistory();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.FAILED);
            assertThat(history.getFailureReason()).contains("config/application.yml");
        });
    }

    @Test
    void failsWhenDatabaseDumpFlagDoesNotMatchManifestEntries() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        Map<String, byte[]> payloadEntries = minimalPayloadEntries();
        Map<String, Object> manifest = standardManifest(manifestEntries(payloadEntries), true);
        byte[] zipBytes = createStandardZip(manifest, payloadEntries);

        withTempRestoreRoot(() -> {
            mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                            .file(new MockMultipartFile("file", "db-flag-mismatch.zip", "application/zip", zipBytes))
                            .session(session))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errorCode").value("RESTORE_MANIFEST_INVALID"));

            RestoreHistory history = latestRestoreHistory();
            assertThat(history.getStatus()).isEqualTo(RestoreStatus.FAILED);
            assertThat(history.getFailureReason()).contains("includesDatabaseDump");
        });
    }

    private void withTempRestoreRoot(ThrowingRunnable runnable) throws Exception {
        String originalRootPath = (String) ReflectionTestUtils.getField(restoreService, "restoreRootPath");
        Path tempRoot = Files.createTempDirectory("restore-upload-test");
        ReflectionTestUtils.setField(restoreService, "restoreRootPath", tempRoot.toString());
        try {
            runnable.run();
        } finally {
            ReflectionTestUtils.setField(restoreService, "restoreRootPath", originalRootPath);
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

    private JsonNode uploadValidatedRestore(MockHttpSession session) throws Exception {
        MvcResult backupRunResult = mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "restore detail integration test"))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode backupData = body(backupRunResult).path("data");
        byte[] backupZipBytes = Files.readAllBytes(Path.of(backupData.path("filePath").asText()));

        MvcResult uploadResult = mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                        .file(new MockMultipartFile("file", backupData.path("fileName").asText(), "application/zip", backupZipBytes))
                        .session(session))
                .andExpect(status().isOk())
                .andReturn();

        return body(uploadResult);
    }

    private RestoreHistory latestRestoreHistory() {
        return restoreHistoryRepository.findAll().stream()
                .max(Comparator.comparing(RestoreHistory::getId))
                .orElseThrow();
    }

    private ActivityLog latestActivityLog(ActivityActionType actionType) {
        return activityLogRepository.findAll().stream()
                .filter(log -> log.getActionType() == actionType)
                .max(Comparator.comparing(ActivityLog::getId))
                .orElseThrow();
    }

    private Map<String, byte[]> minimalPayloadEntries() {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        entries.put("config/application.yml", "app:\n  name: test\n".getBytes(StandardCharsets.UTF_8));
        entries.put("config/application-prod.yml", "spring:\n  profiles: prod\n".getBytes(StandardCharsets.UTF_8));
        entries.put("scales/test-scale.json", "{\"code\":\"TEST\"}".getBytes(StandardCharsets.UTF_8));
        entries.put("metadata/summary.json", "{\"summary\":\"ok\"}".getBytes(StandardCharsets.UTF_8));
        return entries;
    }

    private Map<String, Object> standardManifest(List<Map<String, Object>> entries) {
        return standardManifest(entries, false);
    }

    private Map<String, Object> standardManifest(List<Map<String, Object>> entries, boolean includesDatabaseDump) {
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("formatVersion", "FULL_BACKUP_ZIP_V1");
        manifest.put("createdAt", "2026-04-04T12:00:00+09:00");
        manifest.put("datasourceType", "H2");
        manifest.put("appVersion", "unknown");
        manifest.put("backupId", 1L);
        manifest.put("executedBy", Map.of("loginId", "admina", "name", "관리자A"));
        manifest.put("profile", "test");
        manifest.put("environment", "test");
        manifest.put("summary", Map.of(
                "backupType", "MANUAL",
                "backupMethod", includesDatabaseDump ? "DB_DUMP" : "SNAPSHOT",
                "datasourceType", "H2",
                "includesDatabaseDump", includesDatabaseDump,
                "userCount", 3,
                "clientCount", 2,
                "sessionCount", 1,
                "reason", "restore validation test"
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
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
