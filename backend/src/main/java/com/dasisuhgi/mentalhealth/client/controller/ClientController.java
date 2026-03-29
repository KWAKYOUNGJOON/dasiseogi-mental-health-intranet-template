package com.dasisuhgi.mentalhealth.client.controller;

import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.client.dto.ClientCreateResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientDetailResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientListItemResponse;
import com.dasisuhgi.mentalhealth.client.dto.CreateClientRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckResponse;
import com.dasisuhgi.mentalhealth.client.service.ClientService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/clients")
public class ClientController {
    private final ClientService clientService;
    private final AuthService authService;

    public ClientController(ClientService clientService, AuthService authService) {
        this.clientService = clientService;
        this.authService = authService;
    }

    @GetMapping
    public ApiResponse<List<ClientListItemResponse>> getClients(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String birthDate,
            HttpSession session
    ) {
        authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.getClients(name, birthDate));
    }

    @PostMapping("/duplicate-check")
    public ApiResponse<DuplicateCheckResponse> duplicateCheck(
            @Valid @RequestBody DuplicateCheckRequest request,
            HttpSession session
    ) {
        authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.duplicateCheck(request));
    }

    @PostMapping
    public ApiResponse<ClientCreateResponse> createClient(
            @Valid @RequestBody CreateClientRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.createClient(request, currentUser));
    }

    @GetMapping("/{clientId}")
    public ApiResponse<ClientDetailResponse> getClient(@PathVariable Long clientId, HttpSession session) {
        authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.getClientDetail(clientId));
    }
}
