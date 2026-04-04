package com.dasisuhgi.mentalhealth.common.config;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ActivityLogSchemaSynchronizerTest {
    @Test
    void synchronizeIfNeededRepairsLegacyH2ActivityLogEnumColumns() throws Exception {
        Path tempDirectory = Files.createTempDirectory("activity-log-schema-sync");
        String jdbcUrl = "jdbc:h2:file:" + tempDirectory.resolve("legacy-activity-log").toAbsolutePath()
                + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE";

        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl(jdbcUrl);
        dataSource.setUsername("sa");
        dataSource.setPassword("");

        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("""
                CREATE TABLE activity_logs (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
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
                    )
                )
                """);
        jdbcTemplate.update("INSERT INTO activity_logs(action_type, target_type) VALUES ('BACKUP_RUN', 'BACKUP')");

        assertThatThrownBy(() ->
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM activity_logs WHERE action_type = 'RESTORE_UPLOAD'",
                        Integer.class
                )
        ).hasMessageContaining("Value not permitted");

        new ActivityLogSchemaSynchronizer(dataSource).synchronizeIfNeeded();

        jdbcTemplate.update("INSERT INTO activity_logs(action_type, target_type) VALUES ('RESTORE_UPLOAD', 'RESTORE')");
        jdbcTemplate.update("INSERT INTO activity_logs(action_type, target_type) VALUES ('RESTORE_EXECUTE', 'RESTORE')");
        jdbcTemplate.update("INSERT INTO activity_logs(action_type, target_type) VALUES ('USER_PROFILE_UPDATE', 'USER')");
        jdbcTemplate.update("INSERT INTO activity_logs(action_type, target_type) VALUES ('USER_POSITION_NAME_CHANGE', 'USER')");

        Integer restoreUploadCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM activity_logs WHERE action_type = 'RESTORE_UPLOAD' AND target_type = 'RESTORE'",
                Integer.class
        );
        Integer restoreExecuteCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM activity_logs WHERE action_type = 'RESTORE_EXECUTE' AND target_type = 'RESTORE'",
                Integer.class
        );
        Integer profileUpdateCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM activity_logs WHERE action_type = 'USER_PROFILE_UPDATE' AND target_type = 'USER'",
                Integer.class
        );
        Integer positionChangeCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM activity_logs WHERE action_type = 'USER_POSITION_NAME_CHANGE' AND target_type = 'USER'",
                Integer.class
        );

        assertThat(restoreUploadCount).isEqualTo(1);
        assertThat(restoreExecuteCount).isEqualTo(1);
        assertThat(profileUpdateCount).isEqualTo(1);
        assertThat(positionChangeCount).isEqualTo(1);
    }
}
