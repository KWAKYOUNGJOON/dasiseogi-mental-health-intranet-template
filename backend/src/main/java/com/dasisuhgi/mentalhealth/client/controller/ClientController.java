package com.dasisuhgi.mentalhealth.client.controller;

import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.client.dto.ClientCreateResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientDetailResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientListItemResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientStatusChangeResponse;
import com.dasisuhgi.mentalhealth.client.dto.CreateClientRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckResponse;
import com.dasisuhgi.mentalhealth.client.dto.MarkMisregisteredRequest;
import com.dasisuhgi.mentalhealth.client.dto.UpdateClientRequest;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.client.service.ClientService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
    public ApiResponse<PageResponse<ClientListItemResponse>> getClients(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String birthDate,
            @RequestParam(required = false) Long primaryWorkerId,
            @RequestParam(defaultValue = "false") boolean includeMisregistered,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.getClients(name, birthDate, primaryWorkerId, includeMisregistered, page, size, currentUser));
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
    public ResponseEntity<ApiResponse<ClientCreateResponse>> createClient(
            @Valid @RequestBody CreateClientRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ResponseEntity.status(201)
                .body(ApiResponse.success(clientService.createClient(request, currentUser)));
    }

    @GetMapping("/{clientId}")
    public ApiResponse<ClientDetailResponse> getClient(@PathVariable Long clientId, HttpSession session) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.getClientDetail(clientId, currentUser));
    }

    @PatchMapping("/{clientId}")
    public ApiResponse<ClientDetailResponse> updateClient(
            @PathVariable Long clientId,
            @Valid @RequestBody UpdateClientRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.updateClient(clientId, request, currentUser));
    }

    @PostMapping("/{clientId}/mark-misregistered")
    public ApiResponse<ClientStatusChangeResponse> markMisregistered(
            @PathVariable Long clientId,
            @Valid @RequestBody MarkMisregisteredRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(clientService.markMisregistered(clientId, request, currentUser));
    }
}
