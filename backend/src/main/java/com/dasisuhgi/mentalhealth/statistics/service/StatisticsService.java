package com.dasisuhgi.mentalhealth.statistics.service;

import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentQueryRepository;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleListItemResponse;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsScaleItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsScaleResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsSummaryResponse;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StatisticsService {
    private final AssessmentQueryRepository assessmentQueryRepository;
    private final ScaleService scaleService;

    public StatisticsService(AssessmentQueryRepository assessmentQueryRepository, ScaleService scaleService) {
        this.assessmentQueryRepository = assessmentQueryRepository;
        this.scaleService = scaleService;
    }

    @Transactional(readOnly = true)
    public StatisticsSummaryResponse getSummary(LocalDate dateFrom, LocalDate dateTo, SessionUser sessionUser) {
        validateAuthenticated(sessionUser);
        DateRange dateRange = resolveDateRange(dateFrom, dateTo);
        return assessmentQueryRepository.findStatisticsSummary(dateRange.dateFrom(), dateRange.dateTo());
    }

    @Transactional(readOnly = true)
    public StatisticsScaleResponse getScaleStatistics(LocalDate dateFrom, LocalDate dateTo, SessionUser sessionUser) {
        validateAuthenticated(sessionUser);
        DateRange dateRange = resolveDateRange(dateFrom, dateTo);
        Map<String, ScaleListItemResponse> scaleMetadataByCode = getScaleMetadataByCode();

        Map<String, StatisticsScaleItemResponse> countedByCode = new LinkedHashMap<>();
        for (StatisticsScaleItemResponse item : assessmentQueryRepository.findScaleStatistics(dateRange.dateFrom(), dateRange.dateTo())) {
            countedByCode.put(item.scaleCode(), item);
        }

        List<StatisticsScaleItemResponse> orderedItems = new ArrayList<>(scaleService.getScales().stream()
                .filter(ScaleListItemResponse::isActive)
                .filter(ScaleListItemResponse::implemented)
                .map(scale -> enrichScaleItem(
                        countedByCode.getOrDefault(
                                scale.scaleCode(),
                                new StatisticsScaleItemResponse(scale.scaleCode(), scale.scaleName(), null, null, 0, 0, true)
                        ),
                        scale,
                        true
                ))
                .toList());
        countedByCode.forEach((scaleCode, item) -> {
            boolean alreadyIncluded = orderedItems.stream().anyMatch(candidate -> candidate.scaleCode().equals(scaleCode));
            if (!alreadyIncluded && item.totalCount() > 0) {
                orderedItems.add(enrichScaleItem(item, scaleMetadataByCode.get(scaleCode), false));
            }
        });

        return new StatisticsScaleResponse(dateRange.dateFrom(), dateRange.dateTo(), List.copyOf(orderedItems));
    }

    @Transactional(readOnly = true)
    public PageResponse<StatisticsAlertItemResponse> getAlertStatistics(
            LocalDate dateFrom,
            LocalDate dateTo,
            String scaleCode,
            String alertType,
            int page,
            int size,
            SessionUser sessionUser
    ) {
        validateAuthenticated(sessionUser);
        if (page < 1 || size < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_PAGE_REQUEST", "페이지 요청 값을 다시 확인해주세요.");
        }

        DateRange dateRange = resolveDateRange(dateFrom, dateTo);
        AlertType parsedAlertType = parseAlertType(alertType);
        Map<String, ScaleListItemResponse> scaleMetadataByCode = getScaleMetadataByCode();
        PageResponse<StatisticsAlertItemResponse> alertPage = assessmentQueryRepository.findStatisticsAlerts(
                dateRange.dateFrom(),
                dateRange.dateTo(),
                scaleCode,
                parsedAlertType,
                page,
                size
        );
        List<StatisticsAlertItemResponse> items = alertPage.items().stream()
                .map(item -> enrichAlertItem(item, scaleMetadataByCode.get(item.scaleCode())))
                .toList();
        return new PageResponse<>(items, alertPage.page(), alertPage.size(), alertPage.totalItems(), alertPage.totalPages());
    }

    private void validateAuthenticated(SessionUser sessionUser) {
        if (sessionUser == null) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
        }
    }

    private DateRange resolveDateRange(LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "조회 기간을 다시 확인해주세요.");
        }
        if (dateFrom == null && dateTo == null) {
            LocalDate today = LocalDate.now();
            return new DateRange(
                    today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)),
                    today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY))
            );
        }
        return new DateRange(dateFrom, dateTo);
    }

    private AlertType parseAlertType(String alertType) {
        if (alertType == null || alertType.isBlank()) {
            return null;
        }
        try {
            return AlertType.valueOf(alertType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_ALERT_TYPE", "허용되지 않은 경고 유형입니다.");
        }
    }

    private record DateRange(LocalDate dateFrom, LocalDate dateTo) {
    }

    private Map<String, ScaleListItemResponse> getScaleMetadataByCode() {
        Map<String, ScaleListItemResponse> scaleMetadataByCode = new LinkedHashMap<>();
        for (ScaleListItemResponse scale : scaleService.getScales()) {
            scaleMetadataByCode.put(scale.scaleCode(), scale);
        }
        return scaleMetadataByCode;
    }

    private StatisticsScaleItemResponse enrichScaleItem(
            StatisticsScaleItemResponse item,
            ScaleListItemResponse scaleMetadata,
            boolean isActive
    ) {
        String resolvedScaleName = resolveScaleName(item.scaleCode(), item.scaleName(), scaleMetadata);
        return new StatisticsScaleItemResponse(
                item.scaleCode(),
                resolvedScaleName,
                resolveDisplayTitle(item.scaleCode(), resolvedScaleName, scaleMetadata),
                resolveDisplaySubtitle(scaleMetadata),
                item.totalCount(),
                item.alertCount(),
                isActive
        );
    }

    private StatisticsAlertItemResponse enrichAlertItem(
            StatisticsAlertItemResponse item,
            ScaleListItemResponse scaleMetadata
    ) {
        String resolvedScaleName = resolveScaleName(item.scaleCode(), item.scaleName(), scaleMetadata);
        return new StatisticsAlertItemResponse(
                item.clientName(),
                item.sessionCompletedAt(),
                item.performedByName(),
                item.scaleCode(),
                resolvedScaleName,
                resolveDisplayTitle(item.scaleCode(), resolvedScaleName, scaleMetadata),
                resolveDisplaySubtitle(scaleMetadata),
                item.alertType(),
                item.alertMessage(),
                item.sessionId()
        );
    }

    private String resolveScaleName(String scaleCode, String scaleName, ScaleListItemResponse scaleMetadata) {
        if (scaleName != null && !scaleName.isBlank()) {
            return scaleName;
        }
        if (scaleMetadata != null && scaleMetadata.scaleName() != null && !scaleMetadata.scaleName().isBlank()) {
            return scaleMetadata.scaleName();
        }
        return scaleCode;
    }

    private String resolveDisplayTitle(String scaleCode, String scaleName, ScaleListItemResponse scaleMetadata) {
        if (scaleMetadata != null && scaleMetadata.selectionTitle() != null && !scaleMetadata.selectionTitle().isBlank()) {
            return scaleMetadata.selectionTitle();
        }
        if (scaleName != null && !scaleName.isBlank()) {
            return scaleName;
        }
        return scaleCode;
    }

    private String resolveDisplaySubtitle(ScaleListItemResponse scaleMetadata) {
        if (scaleMetadata == null || scaleMetadata.selectionSubtitle() == null || scaleMetadata.selectionSubtitle().isBlank()) {
            return null;
        }
        return scaleMetadata.selectionSubtitle();
    }
}
