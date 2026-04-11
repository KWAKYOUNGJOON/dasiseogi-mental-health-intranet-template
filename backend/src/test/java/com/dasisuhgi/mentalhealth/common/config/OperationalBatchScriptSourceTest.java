package com.dasisuhgi.mentalhealth.common.config;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OperationalBatchScriptSourceTest {
    @Test
    void adminSmokeCheckRequiresExplicitUrlAndCredentials() throws Exception {
        String script = Files.readString(Path.of("..", "scripts", "admin-smoke-check.bat"), StandardCharsets.UTF_8);

        assertThat(script).doesNotContain("DEFAULT_BASE_URL=");
        assertThat(script).doesNotContain("DEFAULT_LOGIN_ID=");
        assertThat(script).doesNotContain("DEFAULT_PASSWORD=");
        assertThat(script).contains("ADMIN_SMOKE_BASE_URL");
        assertThat(script).contains("ADMIN_SMOKE_LOGIN_ID");
        assertThat(script).contains("ADMIN_SMOKE_PASSWORD");
        assertThat(script).contains("base URL is required. Pass argument 1 or set ADMIN_SMOKE_BASE_URL.");
        assertThat(script).contains("loginId is required. Pass argument 2 or set ADMIN_SMOKE_LOGIN_ID.");
        assertThat(script).contains("password is required. Pass argument 3 or set ADMIN_SMOKE_PASSWORD.");
    }

    @Test
    void healthCheckRequiresExplicitTargetUrl() throws Exception {
        String script = Files.readString(Path.of("..", "scripts", "health-check.bat"), StandardCharsets.UTF_8);

        assertThat(script).doesNotContain("DEFAULT_TARGET_URL=");
        assertThat(script).contains("HEALTH_CHECK_URL");
        assertThat(script).contains("target URL is required. Pass argument 1 or set HEALTH_CHECK_URL.");
    }
}
