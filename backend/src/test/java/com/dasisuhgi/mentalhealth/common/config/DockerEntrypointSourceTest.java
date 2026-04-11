package com.dasisuhgi.mentalhealth.common.config;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DockerEntrypointSourceTest {
    @Test
    void prodPathRequiresExplicitDatabaseValuesAndRejectsH2() throws Exception {
        String script = Files.readString(Path.of("docker-entrypoint.sh"), StandardCharsets.UTF_8);

        assertThat(script).contains("require_non_blank 'APP_DB_URL_DOCKER or APP_DB_URL' \"$DB_URL_CANDIDATE\"");
        assertThat(script).contains("require_non_blank 'APP_DB_USERNAME' \"${APP_DB_USERNAME:-}\"");
        assertThat(script).contains("require_non_blank 'APP_DB_PASSWORD' \"${APP_DB_PASSWORD:-}\"");
        assertThat(script).contains("require_non_blank 'APP_DB_DRIVER' \"${APP_DB_DRIVER:-}\"");
        assertThat(script).contains("fail 'prod/deploy startup must not use jdbc:h2 datasource URLs'");
        assertThat(script).doesNotContain("falling back to local H2 profile");
    }

    @Test
    void localProfileKeepsExplicitLocalFallbackPath() throws Exception {
        String script = Files.readString(Path.of("docker-entrypoint.sh"), StandardCharsets.UTF_8);

        assertThat(script).contains("if is_local_profile; then");
        assertThat(script).contains("export APP_DB_URL=\"$DEFAULT_H2_URL\"");
        assertThat(script).contains("export APP_DB_USERNAME='sa'");
        assertThat(script).contains("export APP_DB_DRIVER='org.h2.Driver'");
        assertThat(script).contains("using explicit local profile with local H2 fallback");
    }
}
