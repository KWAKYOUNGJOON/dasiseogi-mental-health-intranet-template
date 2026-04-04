package com.dasisuhgi.mentalhealth.statistics.controller;

import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsScaleResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsSummaryResponse;
import com.dasisuhgi.mentalhealth.statistics.service.StatisticsExportService;
import com.dasisuhgi.mentalhealth.statistics.service.StatisticsService;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/statistics")
public class StatisticsController {
    private final StatisticsService statisticsService;
    private final StatisticsExportService statisticsExportService;
    private final AuthService authService;

    public StatisticsController(StatisticsService statisticsService, StatisticsExportService statisticsExportService, AuthService authService) {
        this.statisticsService = statisticsService;
        this.statisticsExportService = statisticsExportService;
        this.authService = authService;
    }

    @GetMapping("/summary")
    public ApiResponse<StatisticsSummaryResponse> getSummary(
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(statisticsService.getSummary(dateFrom, dateTo, currentUser));
    }

    @GetMapping("/scales")
    public ApiResponse<StatisticsScaleResponse> getScales(
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(statisticsService.getScaleStatistics(dateFrom, dateTo, currentUser));
    }

    @GetMapping("/alerts")
    public ApiResponse<PageResponse<StatisticsAlertItemResponse>> getAlerts(
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(required = false) String scaleCode,
            @RequestParam(required = false) String alertType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(statisticsService.getAlertStatistics(dateFrom, dateTo, scaleCode, alertType, page, size, currentUser));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam String type,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        StatisticsExportService.StatisticsExportFile exportFile = statisticsExportService.export(dateFrom, dateTo, type, currentUser);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + exportFile.filename() + "\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=" + StandardCharsets.UTF_8.name()))
                .body(exportFile.content());
    }
}
