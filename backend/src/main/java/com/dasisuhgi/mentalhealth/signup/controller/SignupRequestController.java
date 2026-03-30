package com.dasisuhgi.mentalhealth.signup.controller;

import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.signup.dto.CreateSignupRequestRequest;
import com.dasisuhgi.mentalhealth.signup.dto.CreateSignupRequestResponse;
import com.dasisuhgi.mentalhealth.signup.service.SignupRequestService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/signup-requests")
public class SignupRequestController {
    private final SignupRequestService signupRequestService;

    public SignupRequestController(SignupRequestService signupRequestService) {
        this.signupRequestService = signupRequestService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CreateSignupRequestResponse>> createSignupRequest(
            @Valid @RequestBody CreateSignupRequestRequest request
    ) {
        return ResponseEntity.status(201)
                .body(ApiResponse.success(signupRequestService.createSignupRequest(request)));
    }
}
