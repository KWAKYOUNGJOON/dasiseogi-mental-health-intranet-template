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

    @Test
    void loadsPdfAlignedIesrDefinitionAndThresholds() {
        ScaleProperties scaleProperties = new ScaleProperties();
        scaleProperties.setResourcePath(null);
        ScaleResourceLoader loader = new ScaleResourceLoader(objectMapper, resourceLoader, scaleProperties);

        ScaleResourceLoader.LoadedScaleResources loaded = loader.load();

        assertThat(loaded.definitions()).containsKey("IESR");

        var iesr = loaded.definitions().get("IESR");

        assertThat(iesr.questionCount()).isEqualTo(22);
        assertThat(iesr.screeningThreshold()).isEqualTo(18);
        assertThat(iesr.items()).hasSize(22);
        assertThat(iesr.items().get(0).text()).isEqualTo("그 사건을 떠올리게 하는 어떤 것이 나에게 그때의 감정을 다시 불러 일으켰다");
        assertThat(iesr.items().get(iesr.items().size() - 1).text()).isEqualTo("나는 그 사건에 대해 이야기하지 않으려고 노력했다.");
        assertThat(iesr.items().get(0).options())
                .extracting(option -> option.label())
                .containsExactly("전혀 아니다", "약간 그렇다", "그런 편이다", "꽤 그렇다", "매우 그렇다");
        assertThat(iesr.interpretationRules())
                .extracting(rule -> rule.label())
                .containsExactly("정상", "약간 충격", "심한 충격", "매우 심한 충격");
        assertThat(iesr.alertRules())
                .extracting(rule -> rule.message())
                .containsExactly("주의 필요", "상담 권고 또는 고위험 경고");
    }

    @Test
    void loadsCriDefinitionWithTwentyThreeQuestionsAndReverseScoredSupportItems() {
        ScaleProperties scaleProperties = new ScaleProperties();
        scaleProperties.setResourcePath(null);
        ScaleResourceLoader loader = new ScaleResourceLoader(objectMapper, resourceLoader, scaleProperties);

        ScaleResourceLoader.LoadedScaleResources loaded = loader.load();

        assertThat(loaded.registryItems()).containsKey("CRI");
        assertThat(loaded.definitions()).containsKey("CRI");

        var cri = loaded.definitions().get("CRI");

        assertThat(cri.scaleName()).isEqualTo("정신과적 위기 분류 평정척도 (CRI)");
        assertThat(cri.displayOrder()).isEqualTo(9);
        assertThat(cri.questionCount()).isEqualTo(23);
        assertThat(cri.items()).hasSize(23);
        assertThat(cri.items().get(0).text()).isEqualTo("현재 자타해 폭력위험(기물파손, 욕설, 고함 등 명백한 폭력 위험)");
        assertThat(cri.items().get(22).text()).isEqualTo("현재 도움을 주지는 않으나 제공가능한 가족, 친구, 기타의 존재가 있습니까?");
        assertThat(cri.items().subList(21, 23))
                .extracting(item -> item.reverseScored())
                .containsExactly(true, true);
        assertThat(cri.items().subList(21, 23))
                .flatExtracting(item -> item.options().stream().map(option -> option.label()).toList())
                .containsExactly("없다", "있다", "없다", "있다");
        assertThat(cri.alertRules())
                .extracting(rule -> rule.code())
                .containsExactly("CRI_RESULT_A", "CRI_RESULT_B", "CRI_RESULT_C", "CRI_RESULT_D");
        assertThat(cri.alertRules())
                .extracting(rule -> rule.type())
                .containsExactly("HIGH_RISK", "HIGH_RISK", "CAUTION", "CAUTION");
        assertThat(cri.alertRules())
                .extracting(rule -> rule.message())
                .containsExactly(
                        "CRI 결과 A: 극도의 위기",
                        "CRI 결과 B: 위기",
                        "CRI 결과 C: 고위험",
                        "CRI 결과 D: 주의"
                );
        assertThat(cri.alertRules())
                .extracting(rule -> rule.resultLevelCodes())
                .containsExactly(
                        java.util.List.of("A"),
                        java.util.List.of("B"),
                        java.util.List.of("C"),
                        java.util.List.of("D")
                );
    }

    private String readClasspathResource(String location) throws IOException {
        return new String(
                resourceLoader.getResource(Objects.requireNonNull(location, "location")).getInputStream().readAllBytes(),
                StandardCharsets.UTF_8
        );
    }
}
