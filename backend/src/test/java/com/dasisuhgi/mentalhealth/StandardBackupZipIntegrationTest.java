package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.backup.entity.BackupHistory;
import com.dasisuhgi.mentalhealth.backup.repository.BackupHistoryRepository;
import com.dasisuhgi.mentalhealth.backup.service.BackupService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.util.ReflectionTestUtils;
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
class StandardBackupZipIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BackupHistoryRepository backupHistoryRepository;

    @Autowired
    private BackupService backupService;

    @Test
    void manualBackupCreatesStandardSnapshotZipAndPreservesHistoryFlow() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");

        JsonNode backupData = runManualBackup(session, "표준 ZIP 스냅샷 검증");
        Path backupPath = Path.of(backupData.path("filePath").asText());
        Map<String, byte[]> zipEntries = readZipEntries(backupPath);
        JsonNode manifest = Objects.requireNonNull(
                objectMapper.readTree(Objects.requireNonNull(zipEntries.get("manifest.json"), "manifest.json")),
                "manifest"
        );

        assertThat(backupData.path("status").asText()).isEqualTo("SUCCESS");
        assertThat(backupData.path("backupMethod").asText()).isEqualTo("SNAPSHOT");
        assertThat(backupData.path("datasourceType").asText()).isEqualTo("H2");
        assertThat(backupData.path("fileName").asText()).endsWith("-snapshot-full-v1.zip");
        assertThat(zipEntries).containsKeys(
                "manifest.json",
                "config/application.yml",
                "config/application-prod.yml",
                "metadata/summary.json"
        );
        assertThat(zipEntries.keySet()).anyMatch(path -> path.startsWith("scales/"));
        assertThat(zipEntries).doesNotContainKey("db/database.sql");

        assertThat(manifest.path("formatVersion").asText()).isEqualTo("FULL_BACKUP_ZIP_V1");
        assertThat(manifest.path("createdAt").asText()).isNotBlank();
        assertThat(manifest.path("datasourceType").asText()).isEqualTo("H2");
        assertThat(manifest.path("appVersion").asText()).isNotBlank();
        assertThat(manifest.path("backupId").asLong()).isGreaterThan(0L);
        assertThat(manifest.path("executedBy").path("loginId").asText()).isEqualTo("admina");
        assertThat(manifest.path("profile").asText()).isNotBlank();
        assertThat(manifest.path("environment").asText()).isNotBlank();
        assertThat(manifest.path("summary").path("backupMethod").asText()).isEqualTo("SNAPSHOT");
        assertThat(manifest.path("summary").path("includesDatabaseDump").asBoolean()).isFalse();
        assertThat(manifest.path("entries").isArray()).isTrue();
        assertThat(manifest.path("entries").size()).isGreaterThan(0);
        for (JsonNode entry : manifest.path("entries")) {
            assertThat(entry.path("itemType").asText()).isNotBlank();
            assertThat(entry.path("relativePath").asText()).isNotBlank();
            assertThat(entry.path("size").asLong()).isGreaterThan(0L);
            assertThat(entry.path("sha256").asText()).hasSize(64);
        }

        BackupHistory latestHistory = latestBackupHistory();
        assertThat(latestHistory.getId()).isEqualTo(backupData.path("backupId").asLong());
        assertThat(latestHistory.getFileName()).isEqualTo(backupData.path("fileName").asText());
        assertThat(latestHistory.getFilePath()).isEqualTo(backupData.path("filePath").asText());

        MvcResult historyResult = mockMvc.perform(get("/api/v1/admin/backups")
                        .session(session)
                        .param("status", "SUCCESS")
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode historyBody = body(historyResult);
        JsonNode firstHistoryItem = Objects.requireNonNull(historyBody.path("data").path("items").get(0), "first history item");

        assertThat(historyBody.path("data").path("totalItems").asLong()).isGreaterThan(0L);
        assertThat(firstHistoryItem.path("backupId").asLong()).isEqualTo(latestHistory.getId());
        assertThat(firstHistoryItem.path("backupMethod").asText()).isEqualTo("SNAPSHOT");
        assertThat(firstHistoryItem.path("fileName").asText()).isEqualTo(latestHistory.getFileName());
    }

    @Test
    void manualBackupIncludesDatabaseSqlWhenMariaDumpIsAvailable() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        String originalDatasourceUrl = (String) Objects.requireNonNull(
                ReflectionTestUtils.getField(backupService, "datasourceUrl"),
                "datasourceUrl"
        );
        String originalDumpCommand = (String) Objects.requireNonNull(
                ReflectionTestUtils.getField(backupService, "dbDumpCommand"),
                "dbDumpCommand"
        );
        String originalRootPath = (String) Objects.requireNonNull(
                ReflectionTestUtils.getField(backupService, "backupRootPath"),
                "backupRootPath"
        );
        Path backupRoot = Files.createTempDirectory("standard-backup-db-dump");
        Path fakeDumpCommand = createFakeDumpCommand();

        ReflectionTestUtils.setField(backupService, "datasourceUrl", "jdbc:mariadb://127.0.0.1:3306/mental_health_test");
        ReflectionTestUtils.setField(backupService, "dbDumpCommand", fakeDumpCommand.toString());
        ReflectionTestUtils.setField(backupService, "backupRootPath", backupRoot.toString());
        try {
            JsonNode backupData = runManualBackup(session, "표준 ZIP DB_DUMP 검증");
            Map<String, byte[]> zipEntries = readZipEntries(Path.of(backupData.path("filePath").asText()));
            JsonNode manifest = Objects.requireNonNull(
                    objectMapper.readTree(Objects.requireNonNull(zipEntries.get("manifest.json"), "manifest.json")),
                    "manifest"
            );
            byte[] databaseDumpBytes = Objects.requireNonNull(zipEntries.get("db/database.sql"), "db/database.sql");

            assertThat(backupData.path("backupMethod").asText()).isEqualTo("DB_DUMP");
            assertThat(backupData.path("fileName").asText()).endsWith("-db-dump-full-v1.zip");
            assertThat(zipEntries).containsKey("db/database.sql");
            assertThat(new String(databaseDumpBytes, StandardCharsets.UTF_8)).contains("-- fake db dump");
            assertThat(manifest.path("summary").path("backupMethod").asText()).isEqualTo("DB_DUMP");
            assertThat(manifest.path("summary").path("includesDatabaseDump").asBoolean()).isTrue();

            JsonNode databaseEntry = findManifestEntry(manifest.path("entries"), "db/database.sql");
            assertThat(databaseEntry.path("itemType").asText()).isEqualTo("DATABASE_DUMP");
            assertThat(databaseEntry.path("size").asLong()).isEqualTo(databaseDumpBytes.length);
            assertThat(databaseEntry.path("sha256").asText()).hasSize(64);
        } finally {
            ReflectionTestUtils.setField(backupService, "datasourceUrl", originalDatasourceUrl);
            ReflectionTestUtils.setField(backupService, "dbDumpCommand", originalDumpCommand);
            ReflectionTestUtils.setField(backupService, "backupRootPath", originalRootPath);
        }
    }

    @Test
    void manualBackupFallbackZipOmitsDatabaseSqlWhenDumpCommandIsUnavailable() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        String originalDatasourceUrl = (String) Objects.requireNonNull(
                ReflectionTestUtils.getField(backupService, "datasourceUrl"),
                "datasourceUrl"
        );
        String originalDumpCommand = (String) Objects.requireNonNull(
                ReflectionTestUtils.getField(backupService, "dbDumpCommand"),
                "dbDumpCommand"
        );
        String originalRootPath = (String) Objects.requireNonNull(
                ReflectionTestUtils.getField(backupService, "backupRootPath"),
                "backupRootPath"
        );
        Path backupRoot = Files.createTempDirectory("standard-backup-fallback");

        ReflectionTestUtils.setField(backupService, "datasourceUrl", "jdbc:mariadb://127.0.0.1:3306/mental_health_test");
        ReflectionTestUtils.setField(backupService, "dbDumpCommand", "missing-dump-command-xyz");
        ReflectionTestUtils.setField(backupService, "backupRootPath", backupRoot.toString());
        try {
            JsonNode backupData = runManualBackup(session, "표준 ZIP fallback 검증");
            Map<String, byte[]> zipEntries = readZipEntries(Path.of(backupData.path("filePath").asText()));

            assertThat(backupData.path("backupMethod").asText()).isEqualTo("SNAPSHOT");
            assertThat(backupData.path("preflightSummary").asText()).contains("fallback=SNAPSHOT");
            assertThat(backupData.path("fileName").asText()).endsWith("-snapshot-full-v1.zip");
            assertThat(zipEntries).doesNotContainKey("db/database.sql");
        } finally {
            ReflectionTestUtils.setField(backupService, "datasourceUrl", originalDatasourceUrl);
            ReflectionTestUtils.setField(backupService, "dbDumpCommand", originalDumpCommand);
            ReflectionTestUtils.setField(backupService, "backupRootPath", originalRootPath);
        }
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

    private JsonNode runManualBackup(MockHttpSession session, String reason) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/backups/run")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("reason", reason))))
                .andExpect(status().isOk())
                .andReturn();
        return body(result).path("data");
    }

    private JsonNode body(MvcResult result) throws Exception {
        return Objects.requireNonNull(
                objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8)),
                "Response body must contain JSON"
        );
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private Map<String, byte[]> readZipEntries(Path zipPath) throws Exception {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipFile zipFile = new ZipFile(zipPath.toFile(), StandardCharsets.UTF_8)) {
            Enumeration<? extends ZipEntry> enumeration = zipFile.entries();
            while (enumeration.hasMoreElements()) {
                ZipEntry entry = enumeration.nextElement();
                if (entry.isDirectory()) {
                    continue;
                }
                try (InputStream inputStream = zipFile.getInputStream(entry)) {
                    entries.put(entry.getName(), inputStream.readAllBytes());
                }
            }
        }
        return entries;
    }

    private JsonNode findManifestEntry(JsonNode entries, String relativePath) {
        for (JsonNode entry : entries) {
            if (relativePath.equals(entry.path("relativePath").asText())) {
                return entry;
            }
        }
        throw new AssertionError("Manifest entry not found: " + relativePath);
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
                  set "ARG=%%~A"
                  if "!NEXT_IS_OUTPUT!"=="1" (
                    set "OUTPUT=!ARG!"
                    set "NEXT_IS_OUTPUT=0"
                  )
                  if /I "!ARG!"=="--result-file" set "NEXT_IS_OUTPUT=1"
                  echo !ARG!| findstr /B /C:"--result-file=" >nul
                  if not errorlevel 1 set "OUTPUT=!ARG:~14!"
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
                next_is_output=0
                for arg in "$@"; do
                  if [ "$next_is_output" = "1" ]; then
                    output="$arg"
                    next_is_output=0
                  fi
                  case "$arg" in
                    --result-file)
                      next_is_output=1
                      ;;
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
