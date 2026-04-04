package com.dasisuhgi.mentalhealth.scale.service;

import com.dasisuhgi.mentalhealth.common.config.ScaleProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.DefaultResourceLoader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScaleResourceLoaderTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DefaultResourceLoader resourceLoader = new DefaultResourceLoader();

    @Test
    void loadsDefaultClasspathScaleResourcesWhenResourcePathIsMissing() {
        ScaleProperties scaleProperties = new ScaleProperties();
        scaleProperties.setResourcePath(null);
        ScaleResourceLoader loader = new ScaleResourceLoader(objectMapper, resourceLoader, scaleProperties);

        ScaleResourceLoader.LoadedScaleResources loaded = loader.load();

        assertThat(loaded.registryItems()).containsKey("PHQ9");
        assertThat(loaded.definitions()).containsKey("PHQ9");
        assertThat(loaded.definitions().get("PHQ9").scaleName()).isEqualTo("PHQ-9");
    }

    @Test
    void loadsScaleResourcesFromConfiguredFilesystemPath(@TempDir Path tempDir) throws IOException {
        Path scalesRoot = tempDir.resolve("external-scales");
        Files.createDirectories(scalesRoot.resolve("common"));
        Files.writeString(scalesRoot.resolve("common").resolve("scale-registry.json"), """
                {
                  "items": [
                    {
                      "scaleCode": "PHQ9",
                      "scaleName": "PHQ-9 External",
                      "displayOrder": 1,
                      "isActive": true,
                      "implemented": true,
                      "definitionFile": "classpath:scales/phq9.json"
                    }
                  ]
                }
                """, StandardCharsets.UTF_8);
        Files.writeString(
                scalesRoot.resolve("phq9.json"),
                readClasspathResource("classpath:scales/phq9.json").replace("\"PHQ-9\"", "\"PHQ-9 External File\""),
                StandardCharsets.UTF_8
        );

        ScaleProperties scaleProperties = new ScaleProperties();
        scaleProperties.setResourcePath(scalesRoot.toString());
        ScaleResourceLoader loader = new ScaleResourceLoader(objectMapper, resourceLoader, scaleProperties);

        ScaleResourceLoader.LoadedScaleResources loaded = loader.load();

        assertThat(loaded.registryItems()).containsKey("PHQ9");
        assertThat(loaded.definitions()).containsKey("PHQ9");
        assertThat(loaded.definitions().get("PHQ9").scaleName()).isEqualTo("PHQ-9 External File");
    }

    @Test
    void failsClearlyWhenConfiguredScalePathIsInvalid(@TempDir Path tempDir) {
        ScaleProperties scaleProperties = new ScaleProperties();
        scaleProperties.setResourcePath(tempDir.resolve("missing-scales").toString());
        ScaleResourceLoader loader = new ScaleResourceLoader(objectMapper, resourceLoader, scaleProperties);

        assertThatThrownBy(loader::load)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("scale registry")
                .hasMessageContaining("missing-scales");
    }

    private String readClasspathResource(String location) throws IOException {
        return new String(
                resourceLoader.getResource(Objects.requireNonNull(location, "location")).getInputStream().readAllBytes(),
                StandardCharsets.UTF_8
        );
    }
}
