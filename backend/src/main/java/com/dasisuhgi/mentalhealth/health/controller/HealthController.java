package com.dasisuhgi.mentalhealth.health.controller;

import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.health.dto.HealthResponse;
import com.dasisuhgi.mentalhealth.health.service.HealthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {
    private final HealthService healthService;

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<HealthResponse>> getHealth() {
        HealthResponse response = healthService.getHealth();
        return ResponseEntity.status("UP".equals(response.status()) ? 200 : 503)
                .body(ApiResponse.success(response));
    }
}
