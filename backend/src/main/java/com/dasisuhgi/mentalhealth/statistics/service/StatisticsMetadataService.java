package com.dasisuhgi.mentalhealth.statistics.service;

import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.scale.service.ScaleResourceLoader;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertTypeMetadataResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsMetadataResponse;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StatisticsMetadataService {
    private static final String ALERT_TYPES_RESOURCE_PATH = "common/alert-types.json";

    private final ScaleResourceLoader scaleResourceLoader;

    private List<StatisticsAlertTypeMetadataResponse> alertTypes = List.of();

    public StatisticsMetadataService(ScaleResourceLoader scaleResourceLoader) {
        this.scaleResourceLoader = scaleResourceLoader;
    }

    @PostConstruct
    void load() {
        StatisticsAlertTypeResourceFile resourceFile = scaleResourceLoader.readCommonResource(
                ALERT_TYPES_RESOURCE_PATH,
                StatisticsAlertTypeResourceFile.class,
                "statistics alert-type metadata"
        );
        alertTypes = List.copyOf(validateAndMapAlertTypes(resourceFile));
    }

    @Transactional(readOnly = true)
    public StatisticsMetadataResponse getMetadata(SessionUser sessionUser) {
        validateAuthenticated(sessionUser);
        return new StatisticsMetadataResponse(alertTypes);
    }

    private void validateAuthenticated(SessionUser sessionUser) {
        if (sessionUser == null) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        }
    }

    private List<StatisticsAlertTypeMetadataResponse> validateAndMapAlertTypes(StatisticsAlertTypeResourceFile resourceFile) {
        if (resourceFile == null || resourceFile.items() == null || resourceFile.items().isEmpty()) {
            throw fail("Statistics alert-type metadata is empty or malformed.");
        }

        Map<AlertType, StatisticsAlertTypeMetadataResponse> mappedByCode = new LinkedHashMap<>();
        for (StatisticsAlertTypeResourceItem item : resourceFile.items()) {
            if (item == null) {
                throw fail("Statistics alert-type metadata contains a null item.");
            }
            AlertType alertType = parseAlertType(item.code());
            String label = normalizeLabel(item.label(), alertType);
            StatisticsAlertTypeMetadataResponse previous = mappedByCode.putIfAbsent(
                    alertType,
                    new StatisticsAlertTypeMetadataResponse(alertType, label)
            );
            if (previous != null) {
                throw fail("Duplicate statistics alert type code '" + alertType.name() + "' found in metadata.");
            }
        }

        EnumSet<AlertType> missingAlertTypes = EnumSet.allOf(AlertType.class);
        missingAlertTypes.removeAll(mappedByCode.keySet());
        if (!missingAlertTypes.isEmpty()) {
            throw fail("Statistics alert-type metadata is missing codes: " + missingAlertTypes);
        }

        return new ArrayList<>(mappedByCode.values());
    }

    private AlertType parseAlertType(String code) {
        if (code == null || code.isBlank()) {
            throw fail("Statistics alert-type metadata contains an item without code.");
        }
        try {
            return AlertType.valueOf(code.trim());
        } catch (IllegalArgumentException exception) {
            throw fail("Unsupported statistics alert type code '" + code + "' found in metadata.");
        }
    }

    private String normalizeLabel(String label, AlertType alertType) {
        if (label == null || label.isBlank()) {
            throw fail("Statistics alert-type metadata '" + alertType.name() + "' is missing label.");
        }
        return label.trim();
    }

    private IllegalStateException fail(String message) {
        return new IllegalStateException(message);
    }
}

record StatisticsAlertTypeResourceFile(
        List<StatisticsAlertTypeResourceItem> items
) {
}

record StatisticsAlertTypeResourceItem(
        String code,
        String label
) {
}
