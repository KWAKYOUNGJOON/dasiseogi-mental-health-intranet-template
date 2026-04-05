package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.restore.service.RestoreService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
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

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class RestorePreparationIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RestoreService restoreService;

    @Test
    void createsDatabaseRestoreGroupButRemainsNotReadyWhenNothingIsSelected() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedRestore(adminSession, "MYSQL", true);

            withField(restoreService, "datasourceUrl", "jdbc:mysql://127.0.0.1:3306/mentalhealth", () ->
                    mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/preparation", restoreId)
                                    .session(adminSession)
                                    .contentType(APPLICATION_JSON)
                                    .content(preparationRequestBody(List.of(), "")))
                            .andExpect(status().isOk())
                            .andExpect(jsonPath("$.data.restoreId").value(restoreId))
                            .andExpect(jsonPath("$.data.status").value("VALIDATED"))
                            .andExpect(jsonPath("$.data.confirmationTextStatus").value("WAITING_INPUT"))
                            .andExpect(jsonPath("$.data.itemGroups[0].itemType").value("DATABASE"))
                            .andExpect(jsonPath("$.data.itemGroups[0].relativePaths[0]").value("db/database.sql"))
                            .andExpect(jsonPath("$.data.itemGroups[0].selectable").value(true))
                            .andExpect(jsonPath("$.data.itemGroups[0].selected").value(false))
                            .andExpect(jsonPath("$.data.selectedGroupCount").value(0))
                            .andExpect(jsonPath("$.data.confirmationTextMatched").value(false))
                            .andExpect(jsonPath("$.data.readyToExecute").value(false))
                            .andExpect(jsonPath("$.data.blockedReason").value("복원 대상 항목을 하나 이상 선택해주세요."))
            );
        });
    }

    @Test
    void becomesReadyWhenDatabaseGroupIsSelectedAndConfirmationTextMatches() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedRestore(adminSession, "MYSQL", true);

            withField(restoreService, "datasourceUrl", "jdbc:mysql://127.0.0.1:3306/mentalhealth", () ->
                    mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/preparation", restoreId)
                                    .session(adminSession)
                                    .contentType(APPLICATION_JSON)
                                    .content(preparationRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                            .andExpect(status().isOk())
                            .andExpect(jsonPath("$.data.restoreId").value(restoreId))
                            .andExpect(jsonPath("$.data.confirmationTextStatus").value("MATCHED"))
                            .andExpect(jsonPath("$.data.itemGroups[0].itemType").value("DATABASE"))
                            .andExpect(jsonPath("$.data.itemGroups[0].selectable").value(true))
                            .andExpect(jsonPath("$.data.itemGroups[0].selected").value(true))
                            .andExpect(jsonPath("$.data.selectedItemTypes[0]").value("DATABASE"))
                            .andExpect(jsonPath("$.data.selectedGroupCount").value(1))
                            .andExpect(jsonPath("$.data.confirmationTextMatched").value(true))
                            .andExpect(jsonPath("$.data.readyToExecute").value(true))
                            .andExpect(jsonPath("$.data.blockedReason").doesNotExist())
            );
        });
    }

    @Test
    void returnsExplicitBlockedReasonForIncompatibleSnapshotZip() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedRestore(adminSession, "H2", false);

            mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/preparation", restoreId)
                            .session(adminSession)
                            .contentType(APPLICATION_JSON)
                            .content(preparationRequestBody(List.of(), "")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.restoreId").value(restoreId))
                    .andExpect(jsonPath("$.data.status").value("VALIDATED"))
                    .andExpect(jsonPath("$.data.confirmationTextStatus").value("NOT_APPLICABLE"))
                    .andExpect(jsonPath("$.data.itemGroups[0].itemType").value("DATABASE"))
                    .andExpect(jsonPath("$.data.itemGroups[0].relativePaths").isEmpty())
                    .andExpect(jsonPath("$.data.itemGroups[0].selectable").value(false))
                    .andExpect(jsonPath("$.data.itemGroups[0].blockedReason")
                            .value(org.hamcrest.Matchers.containsString("db/database.sql")))
                    .andExpect(jsonPath("$.data.blockedReason")
                            .value(org.hamcrest.Matchers.containsString("datasourceType=H2")))
                    .andExpect(jsonPath("$.data.readyToExecute").value(false));
        });
    }

    @Test
    void keepsConfirmationStatusNotApplicableForUnsupportedSnapshotEvenWhenClientSendsSelectionAndText() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        withTempRestoreRoot(() -> {
            long restoreId = uploadValidatedRestore(adminSession, "H2", false);

            mockMvc.perform(post("/api/v1/admin/restores/{restoreId}/preparation", restoreId)
                            .session(adminSession)
                            .contentType(APPLICATION_JSON)
                            .content(preparationRequestBody(List.of("DATABASE"), "전체 복원을 실행합니다")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.restoreId").value(restoreId))
                    .andExpect(jsonPath("$.data.confirmationTextStatus").value("NOT_APPLICABLE"))
                    .andExpect(jsonPath("$.data.itemGroups[0].itemType").value("DATABASE"))
                    .andExpect(jsonPath("$.data.itemGroups[0].selected").value(false))
                    .andExpect(jsonPath("$.data.selectedItemTypes").isEmpty())
                    .andExpect(jsonPath("$.data.selectedGroupCount").value(0))
                    .andExpect(jsonPath("$.data.confirmationTextMatched").value(false))
                    .andExpect(jsonPath("$.data.readyToExecute").value(false))
                    .andExpect(jsonPath("$.data.blockedReason")
                            .value(org.hamcrest.Matchers.allOf(
                                    org.hamcrest.Matchers.containsString("db/database.sql"),
                                    org.hamcrest.Matchers.containsString("datasourceType=H2"),
                                    org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("확인 문구"))
                            )));
        });
    }

    private void withTempRestoreRoot(ThrowingRunnable runnable) throws Exception {
        Path tempRoot = Files.createTempDirectory("restore-preparation-test");
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

    private long uploadValidatedRestore(MockHttpSession session, String datasourceType, boolean includeDatabaseDump) throws Exception {
        Map<String, byte[]> payloadEntries = standardPayloadEntries(includeDatabaseDump);
        Map<String, Object> manifest = standardManifest(
                manifestEntries(payloadEntries),
                datasourceType,
                9001L,
                includeDatabaseDump
        );

        MvcResult uploadResult = mockMvc.perform(multipart("/api/v1/admin/restores/upload")
                        .file(new MockMultipartFile(
                                "file",
                                "restore-validation.zip",
                                "application/zip",
                                createStandardZip(manifest, payloadEntries)
                        ))
                        .session(session))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(uploadResult.getResponse().getContentAsByteArray()).path("data").path("restoreId").asLong();
    }

    private String preparationRequestBody(List<String> selectedItemTypes, String confirmationText) throws Exception {
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
                "reason", "restore preparation integration test"
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
