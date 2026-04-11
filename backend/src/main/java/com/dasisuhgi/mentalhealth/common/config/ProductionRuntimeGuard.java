package com.dasisuhgi.mentalhealth.common.config;

import jakarta.annotation.PostConstruct;
import java.util.Locale;
import java.util.Objects;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class ProductionRuntimeGuard {
    private static final String URL_PROPERTY = "spring.datasource.url";
    private static final String USERNAME_PROPERTY = "spring.datasource.username";
    private static final String PASSWORD_PROPERTY = "spring.datasource.password";
    private static final String DRIVER_PROPERTY = "spring.datasource.driver-class-name";
    private static final String SEED_PROPERTY = "app.seed.enabled";

    private final Environment environment;

    public ProductionRuntimeGuard(Environment environment) {
        this.environment = Objects.requireNonNull(environment, "environment");
    }

    @PostConstruct
    void validate() {
        validate(
                environment.getProperty(URL_PROPERTY),
                environment.getProperty(USERNAME_PROPERTY),
                environment.getProperty(PASSWORD_PROPERTY),
                environment.getProperty(DRIVER_PROPERTY),
                Boolean.parseBoolean(environment.getProperty(SEED_PROPERTY, "false"))
        );
    }

    static void validate(
            String datasourceUrl,
            String datasourceUsername,
            String datasourcePassword,
            String driverClassName,
            boolean seedEnabled
    ) {
        requireNonBlank(URL_PROPERTY, datasourceUrl);
        requireNonBlank(USERNAME_PROPERTY, datasourceUsername);
        requireNonBlank(PASSWORD_PROPERTY, datasourcePassword);
        requireNonBlank(DRIVER_PROPERTY, driverClassName);

        requireNonPlaceholder(URL_PROPERTY, datasourceUrl);
        requireNonPlaceholder(USERNAME_PROPERTY, datasourceUsername);
        requireNonPlaceholder(PASSWORD_PROPERTY, datasourcePassword);
        requireNonPlaceholder(DRIVER_PROPERTY, driverClassName);

        String normalizedUrl = datasourceUrl.trim().toLowerCase(Locale.ROOT);
        if (normalizedUrl.startsWith("jdbc:h2:")) {
            throw new IllegalStateException("Production runtime must not use jdbc:h2 datasource URLs");
        }
        if (!normalizedUrl.startsWith("jdbc:mariadb:") && !normalizedUrl.startsWith("jdbc:mysql:")) {
            throw new IllegalStateException("Production runtime must use a MariaDB/MySQL JDBC URL");
        }
        if (seedEnabled) {
            throw new IllegalStateException("Production runtime must keep app.seed.enabled=false");
        }
    }

    private static void requireNonBlank(String propertyName, String propertyValue) {
        if (propertyValue == null || propertyValue.isBlank()) {
            throw new IllegalStateException(propertyName + " is required for prod startup");
        }
    }

    private static void requireNonPlaceholder(String propertyName, String propertyValue) {
        if (propertyValue.toUpperCase(Locale.ROOT).contains("PLACEHOLDER")) {
            throw new IllegalStateException(propertyName + " must not contain placeholder values for prod startup");
        }
    }
}
