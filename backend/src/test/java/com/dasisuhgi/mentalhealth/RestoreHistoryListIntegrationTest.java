package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.restore.entity.RestoreHistory;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus;
import com.dasisuhgi.mentalhealth.restore.repository.RestoreHistoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class RestoreHistoryListIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RestoreHistoryRepository restoreHistoryRepository;

    @Test
    void onlyAdminCanViewRestoreHistoryList() throws Exception {
        MockHttpSession userSession = login("usera", "Test1234!");

        mockMvc.perform(get("/api/v1/admin/restores").session(userSession))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void returnsRestoreHistoryListForAdminWithDefaultPagingShape() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        saveHistory(
                RestoreStatus.UPLOADED,
                "restore-uploaded.zip",
                512L,
                LocalDateTime.of(2026, 4, 2, 9, 30, 0),
                null,
                null,
                null,
                null,
                null
        );
        saveHistory(
                RestoreStatus.FAILED,
                "restore-failed.zip",
                1024L,
                LocalDateTime.of(2026, 4, 3, 10, 15, 0),
                LocalDateTime.of(2026, 4, 3, 10, 16, 0),
                null,
                null,
                null,
                "ZipException: manifest.json 파일이 없습니다."
        );
        RestoreHistory latest = saveHistory(
                RestoreStatus.VALIDATED,
                "restore-validated.zip",
                2048L,
                LocalDateTime.of(2026, 4, 4, 11, 45, 0),
                LocalDateTime.of(2026, 4, 4, 11, 46, 30),
                "FULL_BACKUP_ZIP_V1",
                "H2",
                44L,
                null
        );

        mockMvc.perform(get("/api/v1/admin/restores").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(20))
                .andExpect(jsonPath("$.data.totalItems").value(3))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.items.length()").value(3))
                .andExpect(jsonPath("$.data.items[0].restoreId").value(latest.getId()))
                .andExpect(jsonPath("$.data.items[0].status").value("VALIDATED"))
                .andExpect(jsonPath("$.data.items[0].fileName").value("restore-validated.zip"))
                .andExpect(jsonPath("$.data.items[0].fileSizeBytes").value(2048))
                .andExpect(jsonPath("$.data.items[0].uploadedAt").value("2026-04-04 11:45:00"))
                .andExpect(jsonPath("$.data.items[0].validatedAt").value("2026-04-04 11:46:30"))
                .andExpect(jsonPath("$.data.items[0].uploadedByName").value("관리자A"))
                .andExpect(jsonPath("$.data.items[0].formatVersion").value("FULL_BACKUP_ZIP_V1"))
                .andExpect(jsonPath("$.data.items[0].datasourceType").value("H2"))
                .andExpect(jsonPath("$.data.items[0].backupId").value(44))
                .andExpect(jsonPath("$.data.items[0].failureReason").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].detectedItems").doesNotExist());
    }

    @Test
    void sortsByUploadedAtDescThenIdDesc() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");
        LocalDateTime sameUploadedAt = LocalDateTime.of(2026, 4, 4, 9, 0, 0);

        RestoreHistory older = saveHistory(
                RestoreStatus.UPLOADED,
                "older.zip",
                100L,
                LocalDateTime.of(2026, 4, 3, 8, 0, 0),
                null,
                null,
                null,
                null,
                null
        );
        RestoreHistory sameTimeLowId = saveHistory(
                RestoreStatus.VALIDATED,
                "same-time-low-id.zip",
                200L,
                sameUploadedAt,
                sameUploadedAt.plusMinutes(1),
                "FULL_BACKUP_ZIP_V1",
                "H2",
                51L,
                null
        );
        RestoreHistory sameTimeHighId = saveHistory(
                RestoreStatus.FAILED,
                "same-time-high-id.zip",
                300L,
                sameUploadedAt,
                sameUploadedAt.plusMinutes(2),
                null,
                null,
                null,
                "ZipException: invalid zip"
        );

        JsonNode items = body(mockMvc.perform(get("/api/v1/admin/restores").session(adminSession))
                .andExpect(status().isOk())
                .andReturn()).path("data").path("items");

        assertThat(ids(items)).containsExactly(sameTimeHighId.getId(), sameTimeLowId.getId(), older.getId());
    }

    @Test
    void filtersByStatus() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        saveHistory(
                RestoreStatus.UPLOADED,
                "uploaded.zip",
                111L,
                LocalDateTime.of(2026, 4, 1, 8, 0, 0),
                null,
                null,
                null,
                null,
                null
        );
        RestoreHistory validated = saveHistory(
                RestoreStatus.VALIDATED,
                "validated.zip",
                222L,
                LocalDateTime.of(2026, 4, 2, 8, 0, 0),
                LocalDateTime.of(2026, 4, 2, 8, 1, 0),
                "FULL_BACKUP_ZIP_V1",
                "H2",
                61L,
                null
        );
        RestoreHistory failed = saveHistory(
                RestoreStatus.FAILED,
                "failed.zip",
                333L,
                LocalDateTime.of(2026, 4, 3, 8, 0, 0),
                LocalDateTime.of(2026, 4, 3, 8, 1, 0),
                null,
                null,
                null,
                "ZipException: manifest missing"
        );

        mockMvc.perform(get("/api/v1/admin/restores")
                        .param("status", "VALIDATED")
                        .session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].restoreId").value(validated.getId()))
                .andExpect(jsonPath("$.data.items[0].status").value("VALIDATED"));

        mockMvc.perform(get("/api/v1/admin/restores")
                        .param("status", "FAILED")
                        .session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].restoreId").value(failed.getId()))
                .andExpect(jsonPath("$.data.items[0].status").value("FAILED"));
    }

    @Test
    void filtersByUploadedAtDateRange() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        saveHistory(
                RestoreStatus.UPLOADED,
                "before-range.zip",
                100L,
                LocalDateTime.of(2026, 4, 1, 23, 59, 59),
                null,
                null,
                null,
                null,
                null
        );
        RestoreHistory fromBoundary = saveHistory(
                RestoreStatus.VALIDATED,
                "from-boundary.zip",
                200L,
                LocalDateTime.of(2026, 4, 2, 0, 0, 0),
                LocalDateTime.of(2026, 4, 2, 0, 1, 0),
                "FULL_BACKUP_ZIP_V1",
                "H2",
                71L,
                null
        );
        RestoreHistory toBoundary = saveHistory(
                RestoreStatus.FAILED,
                "to-boundary.zip",
                300L,
                LocalDateTime.of(2026, 4, 2, 23, 59, 59),
                LocalDateTime.of(2026, 4, 3, 0, 0, 0),
                null,
                null,
                null,
                "ZipException: invalid manifest"
        );
        saveHistory(
                RestoreStatus.UPLOADED,
                "after-range.zip",
                400L,
                LocalDateTime.of(2026, 4, 3, 0, 0, 0),
                null,
                null,
                null,
                null,
                null
        );

        JsonNode items = body(mockMvc.perform(get("/api/v1/admin/restores")
                        .param("dateFrom", "2026-04-02")
                        .param("dateTo", "2026-04-02")
                        .session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andReturn()).path("data").path("items");

        assertThat(ids(items)).containsExactly(toBoundary.getId(), fromBoundary.getId());
    }

    @Test
    void paginatesRestoreHistoryList() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        RestoreHistory first = saveHistory(
                RestoreStatus.UPLOADED,
                "first.zip",
                10L,
                LocalDateTime.of(2026, 4, 5, 9, 0, 0),
                null,
                null,
                null,
                null,
                null
        );
        RestoreHistory second = saveHistory(
                RestoreStatus.UPLOADED,
                "second.zip",
                20L,
                LocalDateTime.of(2026, 4, 4, 9, 0, 0),
                null,
                null,
                null,
                null,
                null
        );
        RestoreHistory third = saveHistory(
                RestoreStatus.UPLOADED,
                "third.zip",
                30L,
                LocalDateTime.of(2026, 4, 3, 9, 0, 0),
                null,
                null,
                null,
                null,
                null
        );
        RestoreHistory fourth = saveHistory(
                RestoreStatus.UPLOADED,
                "fourth.zip",
                40L,
                LocalDateTime.of(2026, 4, 2, 9, 0, 0),
                null,
                null,
                null,
                null,
                null
        );
        saveHistory(
                RestoreStatus.UPLOADED,
                "fifth.zip",
                50L,
                LocalDateTime.of(2026, 4, 1, 9, 0, 0),
                null,
                null,
                null,
                null,
                null
        );

        JsonNode body = body(mockMvc.perform(get("/api/v1/admin/restores")
                        .param("page", "2")
                        .param("size", "2")
                        .session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(2))
                .andExpect(jsonPath("$.data.size").value(2))
                .andExpect(jsonPath("$.data.totalItems").value(5))
                .andExpect(jsonPath("$.data.totalPages").value(3))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andReturn());

        assertThat(ids(body.path("data").path("items"))).containsExactly(third.getId(), fourth.getId());
        assertThat(ids(body.path("data").path("items"))).doesNotContain(first.getId(), second.getId());
    }

    @Test
    void rejectsInvalidStatusFilter() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        mockMvc.perform(get("/api/v1/admin/restores")
                        .param("status", "PROCESSING")
                        .session(adminSession))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
    }

    @Test
    void rejectsInvalidPageRequest() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        mockMvc.perform(get("/api/v1/admin/restores")
                        .param("page", "0")
                        .session(adminSession))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_PAGE_REQUEST"));
    }

    @Test
    void rejectsInvertedDateRange() throws Exception {
        MockHttpSession adminSession = login("admina", "Test1234!");

        mockMvc.perform(get("/api/v1/admin/restores")
                        .param("dateFrom", "2026-04-05")
                        .param("dateTo", "2026-04-04")
                        .session(adminSession))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_DATE_RANGE"));
    }

    private RestoreHistory saveHistory(
            RestoreStatus status,
            String fileName,
            Long fileSizeBytes,
            LocalDateTime uploadedAt,
            LocalDateTime validatedAt,
            String formatVersion,
            String datasourceType,
            Long backupId,
            String failureReason
    ) {
        RestoreHistory history = new RestoreHistory();
        history.setStatus(status);
        history.setFileName(fileName);
        history.setFilePath("/tmp/restores/" + fileName);
        history.setFileSizeBytes(fileSizeBytes);
        history.setUploadedAt(uploadedAt);
        history.setValidatedAt(validatedAt);
        history.setUploadedByNameSnapshot("관리자A");
        history.setFormatVersion(formatVersion);
        history.setDatasourceType(datasourceType);
        history.setBackupId(backupId);
        history.setFailureReason(failureReason);
        return restoreHistoryRepository.saveAndFlush(history);
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

    private List<Long> ids(JsonNode items) {
        return java.util.stream.StreamSupport.stream(items.spliterator(), false)
                .map(item -> item.path("restoreId").asLong())
                .toList();
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
