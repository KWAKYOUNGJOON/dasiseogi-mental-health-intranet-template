package com.dasisuhgi.mentalhealth.scale.registry;

public record ScaleAlertRule(
        String code,
        String type,
        String message,
        String questionKey,
        Integer minAnswerValue,
        Integer minTotalScore
) {
}
