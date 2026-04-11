package com.dasisuhgi.mentalhealth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ReferenceCatalogSynchronizationIntegrationTest {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void startupSynchronizesScaleCatalogFromScaleRegistryResource() throws Exception {
        JsonNode registryRoot = objectMapper.readTree(new ClassPathResource("scales/common/scale-registry.json").getInputStream());
        List<String> expectedScaleCodes = readTextValues(registryRoot.path("items"), "scaleCode");

        List<String> actualScaleCodes = jdbcTemplate.queryForList(
                "SELECT scale_code FROM scale_catalog ORDER BY display_order ASC, scale_code ASC",
                String.class
        );

        assertThat(actualScaleCodes).containsExactlyElementsOf(expectedScaleCodes);
    }

    @Test
    void startupSynchronizesAlertTypeCatalogFromAlertTypeResource() throws Exception {
        JsonNode alertTypeRoot = objectMapper.readTree(new ClassPathResource("scales/common/alert-types.json").getInputStream());
        List<String> expectedAlertTypes = readTextValues(alertTypeRoot.path("items"), "code");

        List<String> actualAlertTypes = jdbcTemplate.queryForList(
                "SELECT alert_type FROM alert_type_catalog ORDER BY display_order ASC, alert_type ASC",
                String.class
        );

        assertThat(actualAlertTypes).containsExactlyElementsOf(expectedAlertTypes);
    }

    private List<String> readTextValues(JsonNode itemsNode, String fieldName) {
        return java.util.stream.StreamSupport.stream(itemsNode.spliterator(), false)
                .map(node -> node.path(fieldName).asText())
                .collect(Collectors.toList());
    }
}
