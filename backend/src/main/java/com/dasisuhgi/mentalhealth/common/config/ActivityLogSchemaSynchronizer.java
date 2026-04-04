package com.dasisuhgi.mentalhealth.common.config;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ActivityLogSchemaSynchronizer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ActivityLogSchemaSynchronizer.class);
    private static final Pattern QUOTED_TOKEN_PATTERN = Pattern.compile("'([^']+)'");

    private static final String TABLE_NAME = "activity_logs";
    private static final String ACTION_COLUMN = "action_type";
    private static final String TARGET_COLUMN = "target_type";
    private static final String ACTION_CONSTRAINT = "chk_activity_logs_action_type";
    private static final String TARGET_CONSTRAINT = "chk_activity_logs_target_type";

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    public ActivityLogSchemaSynchronizer(DataSource dataSource) {
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
        this.jdbcTemplate = new JdbcTemplate(this.dataSource);
    }

    @Override
    public void run(ApplicationArguments args) {
        synchronizeIfNeeded();
    }

    public void synchronizeIfNeeded() {
        try (Connection connection = dataSource.getConnection()) {
            if (!tableExists(connection, TABLE_NAME)) {
                return;
            }

            String databaseProductName = normalize(connection.getMetaData().getDatabaseProductName());
            Set<String> expectedActionValues = enumNames(ActivityActionType.values());
            Set<String> expectedTargetValues = enumNames(ActivityTargetType.values());

            boolean actionOutOfSync = !readAllowedValues(databaseProductName, ACTION_COLUMN, ACTION_CONSTRAINT)
                    .equals(expectedActionValues);
            boolean targetOutOfSync = !readAllowedValues(databaseProductName, TARGET_COLUMN, TARGET_CONSTRAINT)
                    .equals(expectedTargetValues);

            if (!actionOutOfSync && !targetOutOfSync) {
                return;
            }

            if (isH2(databaseProductName)) {
                synchronizeH2(actionOutOfSync, targetOutOfSync, expectedActionValues, expectedTargetValues);
            } else if (isMariaDbOrMySql(databaseProductName)) {
                synchronizeMariaDbOrMySql(actionOutOfSync, targetOutOfSync, expectedActionValues, expectedTargetValues);
            } else {
                log.warn("Skipping activity_logs schema synchronization for unsupported database: {}", databaseProductName);
                return;
            }

            Set<String> actualActionValues = readAllowedValues(databaseProductName, ACTION_COLUMN, ACTION_CONSTRAINT);
            Set<String> actualTargetValues = readAllowedValues(databaseProductName, TARGET_COLUMN, TARGET_CONSTRAINT);
            if (!actualActionValues.equals(expectedActionValues) || !actualTargetValues.equals(expectedTargetValues)) {
                throw new IllegalStateException("activity_logs schema synchronization did not complete successfully");
            }

            log.info(
                    "Synchronized activity_logs schema to current enum values: database={}, actionUpdated={}, targetUpdated={}",
                    databaseProductName,
                    actionOutOfSync,
                    targetOutOfSync
            );
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to inspect activity_logs schema", exception);
        }
    }

    private boolean tableExists(Connection connection, String tableName) throws SQLException {
        DatabaseMetaData metaData = connection.getMetaData();
        try (ResultSet resultSet = metaData.getTables(connection.getCatalog(), null, tableName, new String[]{"TABLE"})) {
            if (resultSet.next()) {
                return true;
            }
        }
        try (ResultSet resultSet = metaData.getTables(connection.getCatalog(), null, tableName.toUpperCase(Locale.ROOT), new String[]{"TABLE"})) {
            return resultSet.next();
        }
    }

    private Set<String> readAllowedValues(String databaseProductName, String columnName, String constraintName) {
        if (isH2(databaseProductName)) {
            Optional<String> h2ColumnType = findH2ColumnType(columnName);
            if (h2ColumnType.isPresent() && normalize(h2ColumnType.orElseThrow()).startsWith("enum(")) {
                return extractQuotedTokens(h2ColumnType.orElseThrow());
            }
        }

        return findCheckClause(databaseProductName, constraintName)
                .map(ActivityLogSchemaSynchronizer::extractQuotedTokens)
                .orElseGet(Set::of);
    }

    private Optional<String> findH2ColumnType(String columnName) {
        List<String> matches = jdbcTemplate.query(
                "SHOW COLUMNS FROM activity_logs",
                (resultSet, rowNum) -> {
                    String field = resultSet.getString("field");
                    if (field != null && field.equalsIgnoreCase(columnName)) {
                        return resultSet.getString("type");
                    }
                    return null;
                }
        );
        return matches.stream().filter(Objects::nonNull).findFirst();
    }

    private Optional<String> findCheckClause(String databaseProductName, String constraintName) {
        if (isMariaDbOrMySql(databaseProductName)) {
            String sql = """
                    SELECT cc.check_clause
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.check_constraints cc
                      ON tc.constraint_schema = cc.constraint_schema
                     AND tc.constraint_name = cc.constraint_name
                    WHERE tc.table_schema = DATABASE()
                      AND lower(tc.table_name) = ?
                      AND lower(tc.constraint_name) = ?
                      AND upper(tc.constraint_type) = 'CHECK'
                    """;
            return jdbcTemplate.query(sql, resultSet -> resultSet.next()
                            ? Optional.ofNullable(resultSet.getString("check_clause"))
                            : Optional.empty(),
                    TABLE_NAME,
                    constraintName.toLowerCase(Locale.ROOT));
        }

        String sql = """
                SELECT check_clause
                FROM information_schema.check_constraints
                WHERE lower(constraint_name) = ?
                """;
        List<String> clauses = jdbcTemplate.query(
                sql,
                (resultSet, rowNum) -> resultSet.getString("check_clause"),
                constraintName.toLowerCase(Locale.ROOT)
        );
        return clauses.stream().filter(Objects::nonNull).findFirst();
    }

    private void synchronizeH2(
            boolean actionOutOfSync,
            boolean targetOutOfSync,
            Set<String> expectedActionValues,
            Set<String> expectedTargetValues
    ) {
        if (actionOutOfSync) {
            jdbcTemplate.execute("ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS " + ACTION_CONSTRAINT);
            jdbcTemplate.execute("ALTER TABLE activity_logs ALTER COLUMN action_type VARCHAR(50)");
            jdbcTemplate.execute("ALTER TABLE activity_logs ADD CONSTRAINT " + ACTION_CONSTRAINT + " CHECK (" + buildActionCheckClause(expectedActionValues) + ")");
        }

        if (targetOutOfSync) {
            jdbcTemplate.execute("ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS " + TARGET_CONSTRAINT);
            jdbcTemplate.execute("ALTER TABLE activity_logs ALTER COLUMN target_type VARCHAR(50)");
            jdbcTemplate.execute("ALTER TABLE activity_logs ADD CONSTRAINT " + TARGET_CONSTRAINT + " CHECK (" + buildTargetCheckClause(expectedTargetValues) + ")");
        }
    }

    private void synchronizeMariaDbOrMySql(
            boolean actionOutOfSync,
            boolean targetOutOfSync,
            Set<String> expectedActionValues,
            Set<String> expectedTargetValues
    ) {
        if (actionOutOfSync) {
            if (findCheckClause("mariadb", ACTION_CONSTRAINT).isPresent()) {
                jdbcTemplate.execute("ALTER TABLE activity_logs DROP CONSTRAINT " + ACTION_CONSTRAINT);
            }
            jdbcTemplate.execute("ALTER TABLE activity_logs MODIFY action_type VARCHAR(50) NOT NULL");
            jdbcTemplate.execute("ALTER TABLE activity_logs ADD CONSTRAINT " + ACTION_CONSTRAINT + " CHECK (" + buildActionCheckClause(expectedActionValues) + ")");
        }

        if (targetOutOfSync) {
            if (findCheckClause("mariadb", TARGET_CONSTRAINT).isPresent()) {
                jdbcTemplate.execute("ALTER TABLE activity_logs DROP CONSTRAINT " + TARGET_CONSTRAINT);
            }
            jdbcTemplate.execute("ALTER TABLE activity_logs MODIFY target_type VARCHAR(50) NULL");
            jdbcTemplate.execute("ALTER TABLE activity_logs ADD CONSTRAINT " + TARGET_CONSTRAINT + " CHECK (" + buildTargetCheckClause(expectedTargetValues) + ")");
        }
    }

    private static Set<String> enumNames(Enum<?>[] values) {
        return Arrays.stream(values)
                .map(Enum::name)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<String> extractQuotedTokens(String source) {
        Matcher matcher = QUOTED_TOKEN_PATTERN.matcher(source);
        Set<String> tokens = new LinkedHashSet<>();
        while (matcher.find()) {
            tokens.add(matcher.group(1).toUpperCase(Locale.ROOT));
        }
        return tokens;
    }

    private static String buildActionCheckClause(Set<String> values) {
        return ACTION_COLUMN + " IN (" + joinSqlStringLiterals(values) + ")";
    }

    private static String buildTargetCheckClause(Set<String> values) {
        return TARGET_COLUMN + " IS NULL OR " + TARGET_COLUMN + " IN (" + joinSqlStringLiterals(values) + ")";
    }

    private static String joinSqlStringLiterals(Set<String> values) {
        return values.stream()
                .map(value -> "'" + value + "'")
                .collect(Collectors.joining(", "));
    }

    private static boolean isH2(String databaseProductName) {
        return databaseProductName.contains("h2");
    }

    private static boolean isMariaDbOrMySql(String databaseProductName) {
        return databaseProductName.contains("mariadb") || databaseProductName.contains("mysql");
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
