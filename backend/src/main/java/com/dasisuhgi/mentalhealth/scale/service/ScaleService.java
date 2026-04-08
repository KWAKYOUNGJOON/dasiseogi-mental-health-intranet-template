package com.dasisuhgi.mentalhealth.scale.service;

import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleDefinitionResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleListItemResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleOptionResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleQuestionResponse;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleRegistryItem;
import jakarta.annotation.PostConstruct;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ScaleService {
    private final ScaleResourceLoader scaleResourceLoader;
    private Map<String, ScaleRegistryItem> registryItems = Map.of();
    private Map<String, ScaleDefinition> definitions = Map.of();

    public ScaleService(ScaleResourceLoader scaleResourceLoader) {
        this.scaleResourceLoader = scaleResourceLoader;
    }

    @PostConstruct
    void load() {
        ScaleResourceLoader.LoadedScaleResources loadedScales = scaleResourceLoader.load();
        registryItems = loadedScales.registryItems();
        definitions = loadedScales.definitions();
    }

    public List<ScaleListItemResponse> getScales() {
        return registryItems.values().stream()
                .sorted(Comparator.comparingInt(ScaleRegistryItem::displayOrder))
                .map(item -> new ScaleListItemResponse(
                        item.scaleCode(),
                        item.scaleName(),
                        item.selectionTitle(),
                        item.selectionSubtitle(),
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
                                item.reverseScored(),
                                item.options().stream()
                                        .map(option -> new ScaleOptionResponse(option.value(), option.label(), option.score()))
                                        .toList(),
                                item.conditionalRequired() == null
                                        ? null
                                        : new ScaleQuestionResponse.ConditionalRequiredResponse(
                                                item.conditionalRequired().sourceQuestionNos(),
                                                item.conditionalRequired().minScoreSum()
                                        )
                        ))
                        .toList(),
                definition.interpretationRules().stream()
                        .map(rule -> new ScaleDefinitionResponse.InterpretationRuleResponse(
                                rule.min(),
                                rule.max(),
                                rule.label()
                        ))
                        .toList(),
                definition.alertRules().stream()
                        .map(rule -> new ScaleDefinitionResponse.AlertRuleResponse(
                                rule.minTotalScore(),
                                rule.message()
                        ))
                        .toList()
        );
    }

    public boolean isRegistryLoaded() {
        return !registryItems.isEmpty() && !definitions.isEmpty();
    }

    public int loadedDefinitionCount() {
        return definitions.size();
    }
}
