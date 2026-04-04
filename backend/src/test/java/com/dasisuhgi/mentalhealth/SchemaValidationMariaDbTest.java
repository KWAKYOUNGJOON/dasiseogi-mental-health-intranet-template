package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("mariadb")
@Testcontainers(disabledWithoutDocker = true)
class SchemaValidationMariaDbTest {
    @Container
    static final MariaDBContainer<?> MARIADB = new MariaDBContainer<>("mariadb:11.4");

    @Test
    void schemaSqlCreatesRequiredTablesAndIndexesOnMariaDb() throws Exception {
        applySchemaSql();

        assertThat(tableExists("identifier_sequences")).isTrue();
        assertThat(tableExists("users")).isTrue();
        assertThat(tableExists("clients")).isTrue();
        assertThat(tableExists("assessment_sessions")).isTrue();
        assertThat(tableExists("session_scales")).isTrue();
        assertThat(tableExists("session_answers")).isTrue();
        assertThat(tableExists("session_alerts")).isTrue();
        assertThat(tableExists("activity_logs")).isTrue();
        assertThat(tableExists("backup_histories")).isTrue();
        assertThat(tableExists("restore_histories")).isTrue();

        assertThat(indexExists("clients", "idx_clients_name_birth_date")).isTrue();
        assertThat(indexExists("assessment_sessions", "idx_assessment_sessions_client_date")).isTrue();
        assertThat(indexExists("activity_logs", "idx_activity_logs_created_at")).isTrue();
        assertThat(indexExists("backup_histories", "idx_backup_histories_backup_type")).isTrue();
        assertThat(indexExists("backup_histories", "idx_backup_histories_status")).isTrue();
        assertThat(indexExists("backup_histories", "idx_backup_histories_started_at")).isTrue();
        assertThat(indexExists("restore_histories", "idx_restore_histories_status")).isTrue();
        assertThat(indexExists("restore_histories", "idx_restore_histories_uploaded_at")).isTrue();
        assertThat(indexExists("restore_histories", "idx_restore_histories_validated_at")).isTrue();
    }

    @Test
    void schemaSqlDefinesDocumentAlignedColumnMetadataOnMariaDb() throws Exception {
        applySchemaSql();

        ColumnDefinition assessmentSessionCreatedBy = columnDefinition("assessment_sessions", "created_by");
        assertThat(assessmentSessionCreatedBy.dataType()).isEqualTo("bigint");
        assertThat(assessmentSessionCreatedBy.nullable()).isFalse();

        ColumnDefinition sessionAnswersSessionId = columnDefinition("session_answers", "session_id");
        assertThat(sessionAnswersSessionId.dataType()).isEqualTo("bigint");
        assertThat(sessionAnswersSessionId.nullable()).isFalse();

        ColumnDefinition sessionAnswersScaleCode = columnDefinition("session_answers", "scale_code");
        assertThat(sessionAnswersScaleCode.dataType()).isEqualTo("varchar");
        assertThat(sessionAnswersScaleCode.nullable()).isFalse();

        ColumnDefinition sessionAnswersQuestionText = columnDefinition("session_answers", "question_text_snapshot");
        assertThat(sessionAnswersQuestionText.dataType()).isEqualTo("text");
        assertThat(sessionAnswersQuestionText.nullable()).isFalse();

        // 문서 기준상 세션 전체 경고도 허용하므로 척도별 연결은 nullable 이어야 한다.
        ColumnDefinition sessionAlertsSessionScaleId = columnDefinition("session_alerts", "session_scale_id");
        assertThat(sessionAlertsSessionScaleId.dataType()).isEqualTo("bigint");
        assertThat(sessionAlertsSessionScaleId.nullable()).isTrue();

        ColumnDefinition sessionAlertsClientId = columnDefinition("session_alerts", "client_id");
        assertThat(sessionAlertsClientId.dataType()).isEqualTo("bigint");
        assertThat(sessionAlertsClientId.nullable()).isFalse();

        ColumnDefinition sessionAlertsAlertType = columnDefinition("session_alerts", "alert_type");
        assertThat(sessionAlertsAlertType.dataType()).isEqualTo("varchar");
        assertThat(sessionAlertsAlertType.nullable()).isFalse();
        assertThat(sessionAlertsAlertType.characterMaximumLength()).isEqualTo(50L);

        // 현재 구현이 user_id를 채우더라도, 문서 기준 DDL은 신청 이력 분리 보존을 위해 nullable 을 유지한다.
        ColumnDefinition userApprovalRequestUserId = columnDefinition("user_approval_requests", "user_id");
        assertThat(userApprovalRequestUserId.dataType()).isEqualTo("bigint");
        assertThat(userApprovalRequestUserId.nullable()).isTrue();

        ColumnDefinition restoreHistoryStatus = columnDefinition("restore_histories", "status");
        assertThat(restoreHistoryStatus.dataType()).isEqualTo("varchar");
        assertThat(restoreHistoryStatus.nullable()).isFalse();
        assertThat(restoreHistoryStatus.characterMaximumLength()).isEqualTo(20L);

        ColumnDefinition restoreHistoryFileName = columnDefinition("restore_histories", "file_name");
        assertThat(restoreHistoryFileName.dataType()).isEqualTo("varchar");
        assertThat(restoreHistoryFileName.nullable()).isFalse();
        assertThat(restoreHistoryFileName.characterMaximumLength()).isEqualTo(255L);

        ColumnDefinition restoreHistoryFilePath = columnDefinition("restore_histories", "file_path");
        assertThat(restoreHistoryFilePath.dataType()).isEqualTo("varchar");
        assertThat(restoreHistoryFilePath.nullable()).isFalse();
        assertThat(restoreHistoryFilePath.characterMaximumLength()).isEqualTo(500L);

        ColumnDefinition restoreHistoryUploadedAt = columnDefinition("restore_histories", "uploaded_at");
        assertThat(restoreHistoryUploadedAt.dataType()).isEqualTo("datetime");
        assertThat(restoreHistoryUploadedAt.nullable()).isFalse();

        ColumnDefinition restoreHistoryValidatedAt = columnDefinition("restore_histories", "validated_at");
        assertThat(restoreHistoryValidatedAt.dataType()).isEqualTo("datetime");
        assertThat(restoreHistoryValidatedAt.nullable()).isTrue();
    }

    @Test
    void schemaSqlKeepsJsonValidationConstraintForSessionScaleSnapshots() throws Exception {
        applySchemaSql();

        Optional<String> checkClause = checkConstraintClause("session_scales", "chk_session_scales_raw_result_snapshot");
        assertThat(checkClause).isPresent();
        assertThat(normalize(checkClause.orElseThrow())).contains("json_valid");
        assertThat(normalize(checkClause.orElseThrow())).contains("raw_result_snapshot");
    }

    @Test
    void schemaSqlKeepsActivityLogActionTypeCheckConstraintInSyncWithEnum() throws Exception {
        applySchemaSql();

        Optional<String> checkClause = checkConstraintClause("activity_logs", "chk_activity_logs_action_type");
        assertThat(checkClause).isPresent();

        String normalizedClause = normalize(checkClause.orElseThrow());
        Set<String> actualAllowedValues = extractQuotedUppercaseTokens(checkClause.orElseThrow());
        Set<String> expectedValues = Arrays.stream(ActivityActionType.values())
                .map(Enum::name)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        assertThat(normalizedClause).contains("action_type");
        assertThat(actualAllowedValues).contains("USER_PROFILE_UPDATE", "USER_POSITION_NAME_CHANGE", "RESTORE_UPLOAD");
        assertThat(actualAllowedValues).containsExactlyInAnyOrderElementsOf(expectedValues);
    }

    private void applySchemaSql() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                MARIADB.getJdbcUrl(),
                MARIADB.getUsername(),
                MARIADB.getPassword()
        )) {
            ScriptUtils.executeSqlScript(Objects.requireNonNull(connection, "connection"), new ClassPathResource("schema.sql"));
        }
    }

    private boolean tableExists(String tableName) throws Exception {
        String sql = """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = ?
                  AND table_name = ?
                """;
        try (Connection connection = DriverManager.getConnection(
                MARIADB.getJdbcUrl(),
                MARIADB.getUsername(),
                MARIADB.getPassword()
        );
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, MARIADB.getDatabaseName());
            statement.setString(2, tableName);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getInt(1) == 1;
            }
        }
    }

    private ColumnDefinition columnDefinition(String tableName, String columnName) throws Exception {
        String sql = """
                SELECT data_type, column_type, is_nullable, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = ?
                  AND table_name = ?
                  AND column_name = ?
                """;
        try (Connection connection = DriverManager.getConnection(
                MARIADB.getJdbcUrl(),
                MARIADB.getUsername(),
                MARIADB.getPassword()
        );
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, MARIADB.getDatabaseName());
            statement.setString(2, tableName);
            statement.setString(3, columnName);
            try (ResultSet resultSet = statement.executeQuery()) {
                assertThat(resultSet.next()).isTrue();
                return new ColumnDefinition(
                        normalize(resultSet.getString("data_type")),
                        normalize(resultSet.getString("column_type")),
                        "YES".equalsIgnoreCase(resultSet.getString("is_nullable")),
                        resultSet.getObject("character_maximum_length") == null
                                ? null
                                : resultSet.getLong("character_maximum_length")
                );
            }
        }
    }

    private boolean indexExists(String tableName, String indexName) throws Exception {
        try (Connection connection = DriverManager.getConnection(
                MARIADB.getJdbcUrl(),
                MARIADB.getUsername(),
                MARIADB.getPassword()
        )) {
            DatabaseMetaData metaData = connection.getMetaData();
            try (ResultSet resultSet = metaData.getIndexInfo(MARIADB.getDatabaseName(), null, tableName, false, false)) {
                while (resultSet.next()) {
                    String actualIndexName = resultSet.getString("INDEX_NAME");
                    if (actualIndexName != null && actualIndexName.toLowerCase(Locale.ROOT).equals(indexName.toLowerCase(Locale.ROOT))) {
                        return true;
                    }
                }
                return false;
            }
        }
    }

    private Optional<String> checkConstraintClause(String tableName, String constraintName) throws Exception {
        String sql = """
                SELECT cc.check_clause
                FROM information_schema.table_constraints tc
                JOIN information_schema.check_constraints cc
                  ON tc.constraint_schema = cc.constraint_schema
                 AND tc.constraint_name = cc.constraint_name
                WHERE tc.table_schema = ?
                  AND tc.table_name = ?
                  AND tc.constraint_name = ?
                  AND tc.constraint_type = 'CHECK'
                """;
        try (Connection connection = DriverManager.getConnection(
                MARIADB.getJdbcUrl(),
                MARIADB.getUsername(),
                MARIADB.getPassword()
        );
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, MARIADB.getDatabaseName());
            statement.setString(2, tableName);
            statement.setString(3, constraintName);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                return Optional.ofNullable(resultSet.getString("check_clause"));
            }
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private Set<String> extractQuotedUppercaseTokens(String clause) {
        Set<String> tokens = new LinkedHashSet<>();
        Matcher matcher = Pattern.compile("'([A-Z_]+)'").matcher(clause == null ? "" : clause);
        while (matcher.find()) {
            tokens.add(matcher.group(1));
        }
        return tokens;
    }

    private record ColumnDefinition(
            String dataType,
            String columnType,
            boolean nullable,
            Long characterMaximumLength
    ) {
    }
}
