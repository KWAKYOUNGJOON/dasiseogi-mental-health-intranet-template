package com.dasisuhgi.mentalhealth.statistics.service;

import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentQueryRepository;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsScaleItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsSummaryResponse;
import com.dasisuhgi.mentalhealth.user.entity.User;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StatisticsExportService {
    private static final String UTF8_BOM = "\uFEFF";

    private final StatisticsService statisticsService;
    private final AssessmentQueryRepository assessmentQueryRepository;
    private final AccessPolicyService accessPolicyService;
    private final ActivityLogService activityLogService;

    public StatisticsExportService(
            StatisticsService statisticsService,
            AssessmentQueryRepository assessmentQueryRepository,
            AccessPolicyService accessPolicyService,
            ActivityLogService activityLogService
    ) {
        this.statisticsService = statisticsService;
        this.assessmentQueryRepository = assessmentQueryRepository;
        this.accessPolicyService = accessPolicyService;
        this.activityLogService = activityLogService;
    }

    @Transactional
    public StatisticsExportFile export(LocalDate dateFrom, LocalDate dateTo, String type, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        if (!accessPolicyService.isAdmin(currentUser)) {
            throw new AppException(HttpStatus.FORBIDDEN, "STATISTICS_EXPORT_FORBIDDEN", "통계 export 권한이 없습니다.");
        }

        StatisticsExportType exportType = parseType(type);
        StatisticsExportFile exportFile = switch (exportType) {
            case SUMMARY -> buildSummaryFile(dateFrom, dateTo, sessionUser);
            case SCALE_COMPARE -> buildScaleCompareFile(dateFrom, dateTo, sessionUser);
            case ALERT_LIST -> buildAlertListFile(dateFrom, dateTo);
        };
        activityLogService.log(
                currentUser,
                ActivityActionType.STATISTICS_EXPORT,
                ActivityTargetType.STATISTICS,
                null,
                exportType.name(),
                "통계 export 실행: " + exportType.name()
        );
        return exportFile;
    }

    private StatisticsExportFile buildSummaryFile(LocalDate dateFrom, LocalDate dateTo, SessionUser sessionUser) {
        StatisticsSummaryResponse summary = statisticsService.getSummary(dateFrom, dateTo, sessionUser);
        StringBuilder csv = new StringBuilder();
        csv.append(UTF8_BOM);
        csv.append("지표,값\n");
        csv.append("조회 시작일,").append(value(summary.dateFrom())).append('\n');
        csv.append("조회 종료일,").append(value(summary.dateTo())).append('\n');
        csv.append("전체 세션 수,").append(summary.totalSessionCount()).append('\n');
        csv.append("전체 척도 시행 건수,").append(summary.totalScaleCount()).append('\n');
        csv.append("경고 세션 수,").append(summary.alertSessionCount()).append('\n');
        csv.append("경고 척도 수,").append(summary.alertScaleCount()).append('\n');
        csv.append('\n');
        csv.append("담당자명,세션 수\n");
        for (var stat : summary.performedByStats()) {
            csv.append(csv(stat.userName())).append(',').append(stat.sessionCount()).append('\n');
        }
        return file("statistics-summary", summary.dateFrom(), summary.dateTo(), csv.toString());
    }

    private StatisticsExportFile buildScaleCompareFile(LocalDate dateFrom, LocalDate dateTo, SessionUser sessionUser) {
        var scales = statisticsService.getScaleStatistics(dateFrom, dateTo, sessionUser);
        StringBuilder csv = new StringBuilder();
        csv.append(UTF8_BOM);
        csv.append("scaleCode,scaleName,totalCount,alertCount,isActive\n");
        for (StatisticsScaleItemResponse item : scales.items()) {
            csv.append(csv(item.scaleCode())).append(',')
                    .append(csv(item.scaleName())).append(',')
                    .append(item.totalCount()).append(',')
                    .append(item.alertCount()).append(',')
                    .append(item.isActive()).append('\n');
        }
        return file("statistics-scale-compare", scales.dateFrom(), scales.dateTo(), csv.toString());
    }

    private StatisticsExportFile buildAlertListFile(LocalDate dateFrom, LocalDate dateTo) {
        var alerts = assessmentQueryRepository.findStatisticsAlerts(dateFrom, dateTo, null, null, 1, 10000).items();
        StringBuilder csv = new StringBuilder();
        csv.append(UTF8_BOM);
        csv.append("sessionCompletedAt,clientName,performedByName,scaleCode,alertType,alertMessage,sessionId\n");
        for (StatisticsAlertItemResponse item : alerts) {
            csv.append(csv(item.sessionCompletedAt())).append(',')
                    .append(csv(item.clientName())).append(',')
                    .append(csv(item.performedByName())).append(',')
                    .append(csv(item.scaleCode())).append(',')
                    .append(csv(item.alertType())).append(',')
                    .append(csv(item.alertMessage())).append(',')
                    .append(item.sessionId()).append('\n');
        }
        return file("statistics-alert-list", dateFrom, dateTo, csv.toString());
    }

    private StatisticsExportType parseType(String type) {
        if (type == null || type.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_EXPORT_TYPE", "허용되지 않은 export 유형입니다.");
        }
        try {
            return StatisticsExportType.valueOf(type.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_EXPORT_TYPE", "허용되지 않은 export 유형입니다.");
        }
    }

    private StatisticsExportFile file(String prefix, LocalDate dateFrom, LocalDate dateTo, String csv) {
        String filename = prefix + "-" + value(dateFrom) + "-" + value(dateTo) + ".csv";
        return new StatisticsExportFile(filename, csv.getBytes(StandardCharsets.UTF_8));
    }

    private String csv(String value) {
        String normalized = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + normalized + "\"";
    }

    private String value(LocalDate value) {
        return value == null ? "all" : value.toString();
    }

    private enum StatisticsExportType {
        SUMMARY,
        SCALE_COMPARE,
        ALERT_LIST
    }

    public record StatisticsExportFile(String filename, byte[] content) {
    }
}
