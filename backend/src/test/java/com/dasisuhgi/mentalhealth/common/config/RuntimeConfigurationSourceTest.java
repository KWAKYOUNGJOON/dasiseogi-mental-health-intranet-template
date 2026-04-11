package com.dasisuhgi.mentalhealth.common.config;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RuntimeConfigurationSourceTest {
    @Test
    void runtimeFilesSharePortHealthAndUpstreamVariables() throws Exception {
        String applicationSource = Files.readString(Path.of("src", "main", "resources", "application.yml"), StandardCharsets.UTF_8);
        String composeSource = Files.readString(Path.of("..", "docker-compose.yml"), StandardCharsets.UTF_8);
        String prodComposeSource = Files.readString(Path.of("..", "docker-compose.prod.yml"), StandardCharsets.UTF_8);
        String nginxSource = Files.readString(Path.of("..", "frontend", "nginx.conf"), StandardCharsets.UTF_8);
        String viteSource = Files.readString(Path.of("..", "frontend", "vite.config.ts"), StandardCharsets.UTF_8);
        String backendDockerfileSource = Files.readString(Path.of("Dockerfile"), StandardCharsets.UTF_8);
        String frontendDockerfileSource = Files.readString(Path.of("..", "frontend", "Dockerfile"), StandardCharsets.UTF_8);

        assertThat(applicationSource).contains("${APP_SERVER_PORT:8080}");

        assertThat(composeSource).contains("APP_SERVER_PORT");
        assertThat(composeSource).contains("APP_FRONTEND_PORT");
        assertThat(composeSource).contains("APP_HEALTHCHECK_PATH");
        assertThat(composeSource).contains("APP_BACKEND_UPSTREAM_HOST");

        assertThat(prodComposeSource).contains("APP_SERVER_PORT");
        assertThat(prodComposeSource).contains("APP_FRONTEND_PORT");
        assertThat(prodComposeSource).contains("APP_HEALTHCHECK_PATH");
        assertThat(prodComposeSource).contains("APP_BACKEND_UPSTREAM_HOST");

        assertThat(nginxSource).contains("${APP_FRONTEND_PORT}");
        assertThat(nginxSource).contains("${APP_BACKEND_UPSTREAM_HOST}");
        assertThat(nginxSource).contains("${APP_BACKEND_UPSTREAM_PORT}");

        assertThat(viteSource).contains("APP_SERVER_PORT");
        assertThat(viteSource).contains("APP_FRONTEND_PORT");
        assertThat(viteSource).contains("VITE_API_PROXY_TARGET");

        assertThat(backendDockerfileSource).contains("ARG APP_SERVER_PORT=8080");
        assertThat(backendDockerfileSource).contains("EXPOSE ${APP_SERVER_PORT}");

        assertThat(frontendDockerfileSource).contains("ARG APP_FRONTEND_PORT=4173");
        assertThat(frontendDockerfileSource).contains("/etc/nginx/templates/default.conf.template");
        assertThat(frontendDockerfileSource).contains("EXPOSE ${APP_FRONTEND_PORT}");
    }
}
