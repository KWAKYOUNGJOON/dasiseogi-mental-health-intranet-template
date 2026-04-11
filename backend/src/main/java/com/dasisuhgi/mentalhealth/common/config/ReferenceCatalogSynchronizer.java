package com.dasisuhgi.mentalhealth.common.config;

import com.dasisuhgi.mentalhealth.scale.registry.ScaleRegistryItem;
import com.dasisuhgi.mentalhealth.scale.service.ScaleResourceLoader;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ReferenceCatalogSynchronizer implements ApplicationRunner {
    private static final String ALERT_TYPES_RESOURCE_PATH = "common/alert-types.json";

    private final JdbcTemplate jdbcTemplate;
    private final ScaleResourceLoader scaleResourceLoader;

    public ReferenceCatalogSynchronizer(JdbcTemplate jdbcTemplate, ScaleResourceLoader scaleResourceLoader) {
        this.jdbcTemplate = jdbcTemplate;
        this.scaleResourceLoader = scaleResourceLoader;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensureScaleCatalogTable();
        ensureAlertTypeCatalogTable();
        syncScaleCatalog();
        syncAlertTypeCatalog();
        validateLegacyReferenceIntegrity();
    }

    private void ensureScaleCatalogTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS scale_catalog (
                    scale_code VARCHAR(30) NOT NULL,
                    scale_name VARCHAR(100) NOT NULL,
                    display_order INT NOT NULL,
                    is_active BOOLEAN NOT NULL,
                    is_implemented BOOLEAN NOT NULL,
                    definition_file VARCHAR(255) NULL,
                    synced_at DATETIME NOT NULL,
                    PRIMARY KEY (scale_code)
                )
                """);
    }

    private void ensureAlertTypeCatalogTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS alert_type_catalog (
                    alert_type VARCHAR(50) NOT NULL,
                    label VARCHAR(100) NOT NULL,
                    display_order INT NOT NULL,
                    synced_at DATETIME NOT NULL,
                    PRIMARY KEY (alert_type)
                )
                """);
    }

    private void syncScaleCatalog() {
        List<ScaleRegistryItem> registryItems = scaleResourceLoader.load().registryItems().values().stream().toList();
        Timestamp syncedAt = Timestamp.valueOf(LocalDateTime.now());

        for (ScaleRegistryItem item : registryItems) {
            int updated = jdbcTemplate.update("""
                            UPDATE scale_catalog
                            SET scale_name = ?,
                                display_order = ?,
                                is_active = ?,
                                is_implemented = ?,
                                definition_file = ?,
                                synced_at = ?
                            WHERE scale_code = ?
                            """,
                    item.scaleName(),
                    item.displayOrder(),
                    item.isActive(),
                    item.implemented(),
                    item.definitionFile(),
                    syncedAt,
                    item.scaleCode()
            );

            if (updated == 0) {
                jdbcTemplate.update("""
                                INSERT INTO scale_catalog (
                                    scale_code,
                                    scale_name,
                                    display_order,
                                    is_active,
                                    is_implemented,
                                    definition_file,
                                    synced_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                                """,
                        item.scaleCode(),
                        item.scaleName(),
                        item.displayOrder(),
                        item.isActive(),
                        item.implemented(),
                        item.definitionFile(),
                        syncedAt
                );
            }
        }
    }

    private void syncAlertTypeCatalog() {
        AlertTypeCatalogResourceFile resourceFile = scaleResourceLoader.readCommonResource(
                ALERT_TYPES_RESOURCE_PATH,
                AlertTypeCatalogResourceFile.class,
                "alert-type catalog"
        );
        if (resourceFile == null || resourceFile.items() == null || resourceFile.items().isEmpty()) {
            throw new IllegalStateException("Alert-type catalog metadata is empty or malformed.");
        }

        Timestamp syncedAt = Timestamp.valueOf(LocalDateTime.now());
        for (int index = 0; index < resourceFile.items().size(); index++) {
            AlertTypeCatalogResourceItem item = resourceFile.items().get(index);
            if (item == null || item.code() == null || item.code().isBlank()) {
                throw new IllegalStateException("Alert-type catalog contains an invalid code.");
            }
            if (item.label() == null || item.label().isBlank()) {
                throw new IllegalStateException("Alert-type catalog contains a blank label for code " + item.code());
            }

            int updated = jdbcTemplate.update("""
                            UPDATE alert_type_catalog
                            SET label = ?,
                                display_order = ?,
                                synced_at = ?
                            WHERE alert_type = ?
                            """,
                    item.label().trim(),
                    index + 1,
                    syncedAt,
                    item.code().trim()
            );

            if (updated == 0) {
                jdbcTemplate.update("""
                                INSERT INTO alert_type_catalog (
                                    alert_type,
                                    label,
                                    display_order,
                                    synced_at
                                ) VALUES (?, ?, ?, ?)
                                """,
                        item.code().trim(),
                        item.label().trim(),
                        index + 1,
                        syncedAt
                );
            }
        }
    }

    private void validateLegacyReferenceIntegrity() {
        assertNoMissingReference("session_scales", "scale_code", "scale_catalog", "scale_code");
        assertNoMissingReference("session_answers", "scale_code", "scale_catalog", "scale_code");
        assertNoMissingReference("session_alerts", "scale_code", "scale_catalog", "scale_code");
        assertNoMissingReference("session_alerts", "alert_type", "alert_type_catalog", "alert_type");
    }

    private void assertNoMissingReference(String sourceTable, String sourceColumn, String referenceTable, String referenceColumn) {
        Integer invalidReferenceCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM %s source_row
                LEFT JOIN %s reference_row
                  ON source_row.%s = reference_row.%s
                WHERE source_row.%s IS NOT NULL
                  AND reference_row.%s IS NULL
                """.formatted(sourceTable, referenceTable, sourceColumn, referenceColumn, sourceColumn, referenceColumn), Integer.class);

        if (invalidReferenceCount != null && invalidReferenceCount > 0) {
            throw new IllegalStateException(
                    "Reference catalog is missing " + invalidReferenceCount + " value(s) for "
                            + sourceTable + "." + sourceColumn + " -> " + referenceTable + "." + referenceColumn
            );
        }
    }
}

record AlertTypeCatalogResourceFile(
        List<AlertTypeCatalogResourceItem> items
) {
}

record AlertTypeCatalogResourceItem(
        String code,
        String label
) {
}
