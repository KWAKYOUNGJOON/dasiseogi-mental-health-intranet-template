package com.dasisuhgi.mentalhealth.common.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionRuntimeGuardTest {
    @Test
    void acceptsExplicitMariaDbConfigurationWithSeedDisabled() {
        assertThatCode(() -> ProductionRuntimeGuard.validate(
                "jdbc:mariadb://prod-db.internal:3306/mental_health_prod?useUnicode=true&characterEncoding=utf8",
                "mental_health_app",
                "strong-password",
                "org.mariadb.jdbc.Driver",
                false
        )).doesNotThrowAnyException();
    }

    @Test
    void rejectsBlankRequiredValues() {
        assertThatThrownBy(() -> ProductionRuntimeGuard.validate(
                " ",
                "mental_health_app",
                "strong-password",
                "org.mariadb.jdbc.Driver",
                false
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("spring.datasource.url is required");
    }

    @Test
    void rejectsPlaceholderValues() {
        assertThatThrownBy(() -> ProductionRuntimeGuard.validate(
                "jdbc:mariadb://DB_HOST_PLACEHOLDER:3306/DB_NAME_PLACEHOLDER",
                "DB_USERNAME_PLACEHOLDER",
                "DB_PASSWORD_PLACEHOLDER",
                "org.mariadb.jdbc.Driver",
                false
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not contain placeholder values");
    }

    @Test
    void rejectsH2Urls() {
        assertThatThrownBy(() -> ProductionRuntimeGuard.validate(
                "jdbc:h2:file:./backend/data/localdb",
                "sa",
                "password",
                "org.h2.Driver",
                false
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not use jdbc:h2");
    }

    @Test
    void rejectsSeedEnablement() {
        assertThatThrownBy(() -> ProductionRuntimeGuard.validate(
                "jdbc:mariadb://prod-db.internal:3306/mental_health_prod",
                "mental_health_app",
                "strong-password",
                "org.mariadb.jdbc.Driver",
                true
        )).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.seed.enabled=false");
    }
}
