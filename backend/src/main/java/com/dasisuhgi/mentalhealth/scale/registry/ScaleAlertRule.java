package com.dasisuhgi.mentalhealth.scale.registry;

public record ScaleAlertRule(
        String code,
        String type,
        String message,
        String questionKey,
        java.util.List<String> questionKeys,
        Integer minAnswerValue,
        Integer minTotalScore,
        java.util.List<String> resultLevelCodes
) {
}
