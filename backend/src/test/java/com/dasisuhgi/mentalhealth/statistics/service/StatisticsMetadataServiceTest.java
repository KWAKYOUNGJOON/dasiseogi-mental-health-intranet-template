package com.dasisuhgi.mentalhealth.statistics.service;

import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;
import com.dasisuhgi.mentalhealth.common.config.ScaleProperties;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.scale.service.ScaleResourceLoader;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertTypeMetadataResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsMetadataResponse;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.DefaultResourceLoader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StatisticsMetadataServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DefaultResourceLoader resourceLoader = new DefaultResourceLoader();

    @Test
    void getMetadataLoadsAlertTypesFromScaleCommonResourcesInStableOrder() {
        ScaleProperties scaleProperties = new ScaleProperties();
        scaleProperties.setResourcePath(null);
        ScaleResourceLoader scaleResourceLoader = new ScaleResourceLoader(objectMapper, resourceLoader, scaleProperties);
        StatisticsMetadataService service = new StatisticsMetadataService(scaleResourceLoader);

        service.load();

        StatisticsMetadataResponse response = service.getMetadata(sessionUser());

        assertThat(response.alertTypes()).containsExactly(
                new StatisticsAlertTypeMetadataResponse(AlertType.HIGH_RISK, "고위험"),
                new StatisticsAlertTypeMetadataResponse(AlertType.CAUTION, "주의"),
                new StatisticsAlertTypeMetadataResponse(AlertType.CRITICAL_ITEM, "개별 위험 항목"),
                new StatisticsAlertTypeMetadataResponse(AlertType.COMPOSITE_RULE, "복합 위험")
        );
    }

    @Test
    void loadFailsClearlyWhenAlertTypeMetadataMissesRequiredCodes(@TempDir Path tempDir) throws IOException {
        Path scalesRoot = tempDir.resolve("external-scales");
        Files.createDirectories(scalesRoot.resolve("common"));
        Files.writeString(scalesRoot.resolve("common").resolve("alert-types.json"), """
                {
                  "items": [
                    {
                      "code": "HIGH_RISK",
                      "label": "고위험"
                    },
                    {
                      "code": "CAUTION",
                      "label": "주의"
                    }
                  ]
                }
                """, StandardCharsets.UTF_8);

        ScaleProperties scaleProperties = new ScaleProperties();
        scaleProperties.setResourcePath(scalesRoot.toString());
        ScaleResourceLoader scaleResourceLoader = new ScaleResourceLoader(objectMapper, resourceLoader, scaleProperties);
        StatisticsMetadataService service = new StatisticsMetadataService(scaleResourceLoader);

        assertThatThrownBy(service::load)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("missing codes")
                .hasMessageContaining("CRITICAL_ITEM")
                .hasMessageContaining("COMPOSITE_RULE");
    }

    private SessionUser sessionUser() {
        return new SessionUser(1L, "admin", "관리자", UserRole.ADMIN, UserStatus.ACTIVE);
    }
}
