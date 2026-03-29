package com.dasisuhgi.mentalhealth.scale.controller;

import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleDefinitionResponse;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleListItemResponse;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/scales")
public class ScaleController {
    private final ScaleService scaleService;
    private final AuthService authService;

    public ScaleController(ScaleService scaleService, AuthService authService) {
        this.scaleService = scaleService;
        this.authService = authService;
    }

    @GetMapping
    public ApiResponse<List<ScaleListItemResponse>> getScales(HttpSession session) {
        authService.getRequiredSessionUser(session);
        return ApiResponse.success(scaleService.getScales());
    }

    @GetMapping("/{scaleCode}")
    public ApiResponse<ScaleDefinitionResponse> getScale(@PathVariable String scaleCode, HttpSession session) {
        authService.getRequiredSessionUser(session);
        return ApiResponse.success(scaleService.getScaleDetail(scaleCode));
    }
}
