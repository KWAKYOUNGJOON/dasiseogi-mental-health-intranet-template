package com.dasisuhgi.mentalhealth.user.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashSet;
import java.util.List;

public final class PositionNamePolicy {
    public static final String FIELD_NAME = "positionName";
    private static final String POSITION_RESOURCE_PATH = "metadata/position-options.json";
    private static final List<String> ALLOWED_VALUES = loadAllowedValues();
    public static final String INVALID_SELECTION_MESSAGE =
            "직책 또는 역할은 " + String.join(", ", ALLOWED_VALUES) + " 중에서 선택해주세요.";

    private PositionNamePolicy() {
    }

    public static List<String> getAllowedValues() {
        return ALLOWED_VALUES;
    }

    public static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static boolean isAllowed(String value) {
        String normalizedValue = normalize(value);
        return normalizedValue != null && ALLOWED_VALUES.contains(normalizedValue);
    }

    private static List<String> loadAllowedValues() {
        try (InputStream inputStream = PositionNamePolicy.class.getClassLoader().getResourceAsStream(POSITION_RESOURCE_PATH)) {
            if (inputStream == null) {
                throw new IllegalStateException("Position metadata resource not found: " + POSITION_RESOURCE_PATH);
            }

            PositionCatalogFile resourceFile = new ObjectMapper().readValue(inputStream, PositionCatalogFile.class);
            return validate(resourceFile);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to load position metadata from " + POSITION_RESOURCE_PATH, exception);
        }
    }

    private static List<String> validate(PositionCatalogFile resourceFile) {
        if (resourceFile == null || resourceFile.items() == null || resourceFile.items().isEmpty()) {
            throw new IllegalStateException("Position metadata is empty or malformed: " + POSITION_RESOURCE_PATH);
        }

        LinkedHashSet<String> uniqueNames = new LinkedHashSet<>();
        for (PositionCatalogItem item : resourceFile.items()) {
            if (item == null) {
                throw new IllegalStateException("Position metadata contains a null item: " + POSITION_RESOURCE_PATH);
            }

            String normalizedName = normalize(item.name());
            if (normalizedName == null) {
                throw new IllegalStateException("Position metadata contains a blank name: " + POSITION_RESOURCE_PATH);
            }
            if (!uniqueNames.add(normalizedName)) {
                throw new IllegalStateException("Position metadata contains a duplicate name '" + normalizedName + "'");
            }
        }

        return List.copyOf(uniqueNames);
    }

    private record PositionCatalogFile(
            List<PositionCatalogItem> items
    ) {
    }

    private record PositionCatalogItem(
            String name
    ) {
    }
}
