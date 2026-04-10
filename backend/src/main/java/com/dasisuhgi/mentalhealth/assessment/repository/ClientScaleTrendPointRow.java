package com.dasisuhgi.mentalhealth.assessment.repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ClientScaleTrendPointRow(
        Long sessionId,
        Long sessionScaleId,
        LocalDateTime assessedAt,
        LocalDateTime createdAt,
        BigDecimal totalScore,
        String resultLevel
) {
}
