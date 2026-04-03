package com.dasisuhgi.mentalhealth.user.support;

import java.util.List;

public final class PositionNamePolicy {
    public static final String FIELD_NAME = "positionName";
    public static final String INVALID_SELECTION_MESSAGE = "직책 또는 역할은 팀장, 대리, 실무자 중에서 선택해주세요.";
    private static final List<String> ALLOWED_VALUES = List.of("팀장", "대리", "실무자");

    private PositionNamePolicy() {
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
}
