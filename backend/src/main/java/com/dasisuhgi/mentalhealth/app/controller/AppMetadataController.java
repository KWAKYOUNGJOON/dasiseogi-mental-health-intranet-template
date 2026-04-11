package com.dasisuhgi.mentalhealth.app.controller;

import com.dasisuhgi.mentalhealth.app.dto.AppMetadataResponse;
import com.dasisuhgi.mentalhealth.app.service.AppMetadataService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppMetadataController {
    private final AppMetadataService appMetadataService;

    public AppMetadataController(AppMetadataService appMetadataService) {
        this.appMetadataService = appMetadataService;
    }

    @GetMapping("/metadata")
    public ApiResponse<AppMetadataResponse> getMetadata() {
        return ApiResponse.success(appMetadataService.getMetadata());
    }
}
