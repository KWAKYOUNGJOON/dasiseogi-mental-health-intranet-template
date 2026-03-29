package com.dasisuhgi.mentalhealth.scale.service;

import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleDefinitionResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleListItemResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleOptionResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleQuestionResponse;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleRegistryFile;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleRegistryItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ScaleService {
    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;
    private final Map<String, ScaleRegistryItem> registryItems = new HashMap<>();
    private final Map<String, ScaleDefinition> definitions = new HashMap<>();

    public ScaleService(ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    void load() throws IOException {
        Resource registryResource = resourceLoader.getResource("classpath:scales/common/scale-registry.json");
        try (InputStream inputStream = registryResource.getInputStream()) {
            ScaleRegistryFile registryFile = objectMapper.readValue(inputStream, ScaleRegistryFile.class);
            for (ScaleRegistryItem item : registryFile.items()) {
                registryItems.put(item.scaleCode(), item);
                if (item.implemented() && item.definitionFile() != null) {
                    Resource definitionResource = resourceLoader.getResource(item.definitionFile());
                    try (InputStream definitionInputStream = definitionResource.getInputStream()) {
                        ScaleDefinition definition = objectMapper.readValue(definitionInputStream, ScaleDefinition.class);
                        definitions.put(definition.scaleCode(), definition);
                    }
                }
            }
        }
    }

    public List<ScaleListItemResponse> getScales() {
        return registryItems.values().stream()
                .sorted(Comparator.comparingInt(ScaleRegistryItem::displayOrder))
                .map(item -> new ScaleListItemResponse(
                        item.scaleCode(),
                        item.scaleName(),
                        item.displayOrder(),
                        item.isActive(),
                        item.implemented()
                ))
                .toList();
    }

    public ScaleDefinition getActiveDefinition(String scaleCode) {
        ScaleRegistryItem registryItem = registryItems.get(scaleCode);
        if (registryItem == null) {
            throw new AppException(HttpStatus.NOT_FOUND, "SCALE_NOT_FOUND", "존재하지 않는 척도입니다.");
        }
        if (!registryItem.isActive() || !registryItem.implemented()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "SCALE_NOT_ACTIVE", "아직 구현되지 않은 척도입니다.");
        }
        ScaleDefinition definition = definitions.get(scaleCode);
        if (definition == null) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "SCALE_DEFINITION_MISSING", "척도 정의를 찾을 수 없습니다.");
        }
        return definition;
    }

    public ScaleDefinitionResponse getScaleDetail(String scaleCode) {
        ScaleDefinition definition = getActiveDefinition(scaleCode);
        return new ScaleDefinitionResponse(
                definition.scaleCode(),
                definition.scaleName(),
                definition.displayOrder(),
                definition.questionCount(),
                definition.screeningThreshold(),
                definition.items().stream()
                        .map(item -> new ScaleQuestionResponse(
                                item.questionNo(),
                                item.questionKey(),
                                item.text(),
                                item.options().stream()
                                        .map(option -> new ScaleOptionResponse(option.value(), option.label(), option.score()))
                                        .toList()
                        ))
                        .toList()
        );
    }
}
