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

        Map<String, StatisticsScaleItemResponse> countedByCode = new LinkedHashMap<>();
        for (StatisticsScaleItemResponse item : assessmentQueryRepository.findScaleStatistics(dateRange.dateFrom(), dateRange.dateTo())) {
            countedByCode.put(item.scaleCode(), item);
        }

        List<StatisticsScaleItemResponse> orderedItems = new java.util.ArrayList<>(scaleService.getScales().stream()
                .filter(ScaleListItemResponse::isActive)
                .filter(ScaleListItemResponse::implemented)
                .map(scale -> countedByCode.getOrDefault(
                        scale.scaleCode(),
                        new StatisticsScaleItemResponse(scale.scaleCode(), scale.scaleName(), 0, 0, true)
                ))
                .map(item -> new StatisticsScaleItemResponse(
                        item.scaleCode(),
                        item.scaleName(),
                        item.totalCount(),
                        item.alertCount(),
                        true
                ))
                .toList());
        countedByCode.forEach((scaleCode, item) -> {
            boolean alreadyIncluded = orderedItems.stream().anyMatch(candidate -> candidate.scaleCode().equals(scaleCode));
            if (!alreadyIncluded && item.totalCount() > 0) {
                orderedItems.add(new StatisticsScaleItemResponse(
                        item.scaleCode(),
                        item.scaleName(),
                        item.totalCount(),
                        item.alertCount(),
                        false
                ));
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
        return assessmentQueryRepository.findStatisticsAlerts(
                dateRange.dateFrom(),
                dateRange.dateTo(),
                scaleCode,
                parsedAlertType,
                page,
                size
        );
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
}
