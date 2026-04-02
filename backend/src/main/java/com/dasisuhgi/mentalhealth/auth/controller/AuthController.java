package com.dasisuhgi.mentalhealth.auth.controller;

import com.dasisuhgi.mentalhealth.auth.dto.AuthUserResponse;
import com.dasisuhgi.mentalhealth.auth.dto.LoginRequest;
import com.dasisuhgi.mentalhealth.auth.dto.LoginResponse;
import com.dasisuhgi.mentalhealth.auth.dto.UpdateMyProfileRequest;
import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpSession session) {
        return ApiResponse.success(authService.login(request, session));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpSession session) {
        authService.logout(session);
        return ApiResponse.successMessage("로그아웃되었습니다.");
    }

    @GetMapping("/me")
    public ApiResponse<AuthUserResponse> me(HttpSession session) {
        return ApiResponse.success(authService.getCurrentUser(session));
    }

    @PatchMapping("/me")
    public ApiResponse<AuthUserResponse> updateMe(@Valid @RequestBody UpdateMyProfileRequest request, HttpSession session) {
        return ApiResponse.success(authService.updateCurrentUser(request, session));
    }
}
