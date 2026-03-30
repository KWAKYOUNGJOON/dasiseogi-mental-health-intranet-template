package com.dasisuhgi.mentalhealth.assessment.controller;

import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentRecordListItemResponse;
import com.dasisuhgi.mentalhealth.assessment.service.AssessmentService;
import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/assessment-records")
public class AssessmentRecordController {
    private final AssessmentService assessmentService;
    private final AuthService authService;

    public AssessmentRecordController(AssessmentService assessmentService, AuthService authService) {
        this.assessmentService = assessmentService;
        this.authService = authService;
    }

    @GetMapping
    public ApiResponse<PageResponse<AssessmentRecordListItemResponse>> getAssessmentRecords(
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(required = false) String clientName,
            @RequestParam(required = false) String scaleCode,
            @RequestParam(defaultValue = "false") boolean includeMisentered,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(
                assessmentService.getAssessmentRecords(dateFrom, dateTo, clientName, scaleCode, includeMisentered, page, size, currentUser)
        );
    }
}
