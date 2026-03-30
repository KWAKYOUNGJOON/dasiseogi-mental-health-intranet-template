package com.dasisuhgi.mentalhealth;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
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
    void applicationStartsWithMariaDbWhenSchemaSqlIsAppliedAndJpaValidates() throws Exception {
        applySchemaSql();

        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(MentalhealthApplication.class)
                .web(WebApplicationType.NONE)
                .properties(
                        "spring.datasource.url=" + MARIADB.getJdbcUrl(),
                        "spring.datasource.username=" + MARIADB.getUsername(),
                        "spring.datasource.password=" + MARIADB.getPassword(),
                        "spring.datasource.driver-class-name=org.mariadb.jdbc.Driver",
                        "spring.jpa.hibernate.ddl-auto=validate",
                        "spring.sql.init.mode=never",
                        "app.seed.enabled=false",
                        "logging.level.root=WARN"
                )
                .run()) {
            assertThat(context.isActive()).isTrue();
            assertThat(tableExists("users")).isTrue();
            assertThat(tableExists("clients")).isTrue();
            assertThat(tableExists("assessment_sessions")).isTrue();
        }
    }

    private void applySchemaSql() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                MARIADB.getJdbcUrl(),
                MARIADB.getUsername(),
                MARIADB.getPassword()
        )) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("schema.sql"));
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
}
