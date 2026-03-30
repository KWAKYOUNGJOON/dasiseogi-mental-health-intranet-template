package com.dasisuhgi.mentalhealth.assessment.controller;

import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentSessionDetailResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentSessionPrintDataResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.MarkMisenteredRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.SaveAssessmentSessionRequest;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionStatusChangeResponse;
import com.dasisuhgi.mentalhealth.assessment.dto.SessionSaveResponse;
import com.dasisuhgi.mentalhealth.assessment.service.AssessmentService;
import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/assessment-sessions")
public class AssessmentSessionController {
    private final AssessmentService assessmentService;
    private final AuthService authService;

    public AssessmentSessionController(AssessmentService assessmentService, AuthService authService) {
        this.assessmentService = assessmentService;
        this.authService = authService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SessionSaveResponse>> saveSession(
            @Valid @RequestBody SaveAssessmentSessionRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ResponseEntity.status(201)
                .body(ApiResponse.success(assessmentService.saveSession(request, currentUser)));
    }

    @GetMapping("/{sessionId}")
    public ApiResponse<AssessmentSessionDetailResponse> getSession(
            @PathVariable Long sessionId,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(assessmentService.getSessionDetail(sessionId, currentUser));
    }

    @GetMapping("/{sessionId}/print-data")
    public ApiResponse<AssessmentSessionPrintDataResponse> getSessionPrintData(
            @PathVariable Long sessionId,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(assessmentService.getSessionPrintData(sessionId, currentUser));
    }

    @PostMapping("/{sessionId}/mark-misentered")
    public ApiResponse<SessionStatusChangeResponse> markMisentered(
            @PathVariable Long sessionId,
            @Valid @RequestBody MarkMisenteredRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(assessmentService.markMisentered(sessionId, request, currentUser));
    }
}
