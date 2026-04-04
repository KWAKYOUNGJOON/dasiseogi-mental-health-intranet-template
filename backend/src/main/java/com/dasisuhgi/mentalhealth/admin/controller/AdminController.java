package com.dasisuhgi.mentalhealth.admin.controller;

import com.dasisuhgi.mentalhealth.admin.dto.AdminUserListItemResponse;
import com.dasisuhgi.mentalhealth.admin.dto.AdminUserUpdateResponse;
import com.dasisuhgi.mentalhealth.admin.dto.SignupRequestListItemResponse;
import com.dasisuhgi.mentalhealth.admin.dto.SignupRequestProcessRequest;
import com.dasisuhgi.mentalhealth.admin.dto.SignupRequestProcessResponse;
import com.dasisuhgi.mentalhealth.admin.dto.UserPositionNameUpdateRequest;
import com.dasisuhgi.mentalhealth.admin.dto.UserRoleUpdateRequest;
import com.dasisuhgi.mentalhealth.admin.dto.UserStatusUpdateRequest;
import com.dasisuhgi.mentalhealth.admin.service.AdminService;
import com.dasisuhgi.mentalhealth.audit.dto.ActivityLogListItemResponse;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.backup.dto.BackupHistoryListItemResponse;
import com.dasisuhgi.mentalhealth.backup.dto.ManualBackupRunRequest;
import com.dasisuhgi.mentalhealth.backup.dto.ManualBackupRunResponse;
import com.dasisuhgi.mentalhealth.backup.service.BackupService;
import com.dasisuhgi.mentalhealth.auth.service.AuthService;
import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreDetailResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreHistoryListItemResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreUploadResponse;
import com.dasisuhgi.mentalhealth.restore.service.RestoreService;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDate;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private final AdminService adminService;
    private final ActivityLogService activityLogService;
    private final BackupService backupService;
    private final RestoreService restoreService;
    private final AuthService authService;

    public AdminController(
            AdminService adminService,
            ActivityLogService activityLogService,
            BackupService backupService,
            RestoreService restoreService,
            AuthService authService
    ) {
        this.adminService = adminService;
        this.activityLogService = activityLogService;
        this.backupService = backupService;
        this.restoreService = restoreService;
        this.authService = authService;
    }

    @GetMapping("/signup-requests")
    public ApiResponse<PageResponse<SignupRequestListItemResponse>> getSignupRequests(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(adminService.getSignupRequests(status, page, size, currentUser));
    }

    @PostMapping("/signup-requests/{requestId}/approve")
    public ApiResponse<SignupRequestProcessResponse> approveSignupRequest(
            @PathVariable Long requestId,
            @RequestBody(required = false) SignupRequestProcessRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(adminService.approveSignupRequest(
                requestId,
                request == null ? new SignupRequestProcessRequest(null) : request,
                currentUser
        ));
    }

    @PostMapping("/signup-requests/{requestId}/reject")
    public ApiResponse<SignupRequestProcessResponse> rejectSignupRequest(
            @PathVariable Long requestId,
            @RequestBody(required = false) SignupRequestProcessRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(adminService.rejectSignupRequest(
                requestId,
                request == null ? new SignupRequestProcessRequest(null) : request,
                currentUser
        ));
    }

    @GetMapping("/users")
    public ApiResponse<PageResponse<AdminUserListItemResponse>> getUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(adminService.getUsers(keyword, role, status, page, size, currentUser));
    }

    @PatchMapping("/users/{userId}/role")
    public ApiResponse<AdminUserUpdateResponse> updateUserRole(
            @PathVariable Long userId,
            @RequestBody UserRoleUpdateRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(adminService.updateUserRole(userId, request, currentUser));
    }

    @PatchMapping("/users/{userId}/status")
    public ApiResponse<AdminUserUpdateResponse> updateUserStatus(
            @PathVariable Long userId,
            @RequestBody UserStatusUpdateRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(adminService.updateUserStatus(userId, request, currentUser));
    }

    @PatchMapping("/users/{userId}/position-name")
    public ApiResponse<AdminUserUpdateResponse> updateUserPositionName(
            @PathVariable Long userId,
            @RequestBody UserPositionNameUpdateRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(adminService.updateUserPositionName(userId, request, currentUser));
    }

    @GetMapping("/activity-logs")
    public ApiResponse<PageResponse<ActivityLogListItemResponse>> getActivityLogs(
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String actionType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(activityLogService.getLogs(dateFrom, dateTo, userId, actionType, page, size, currentUser));
    }

    @GetMapping("/backups")
    public ApiResponse<PageResponse<BackupHistoryListItemResponse>> getBackups(
            @RequestParam(required = false) String backupType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(backupService.getBackups(backupType, status, dateFrom, dateTo, page, size, currentUser));
    }

    @PostMapping("/backups/run")
    public ApiResponse<ManualBackupRunResponse> runBackup(
            @RequestBody(required = false) ManualBackupRunRequest request,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(backupService.runManualBackup(
                request == null ? new ManualBackupRunRequest(null) : request,
                currentUser
        ));
    }

    @GetMapping("/restores")
    public ApiResponse<PageResponse<RestoreHistoryListItemResponse>> getRestoreHistories(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(restoreService.getRestoreHistories(status, dateFrom, dateTo, page, size, currentUser));
    }

    @PostMapping(value = "/restores/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<RestoreUploadResponse> uploadRestoreZip(
            @RequestPart(value = "file", required = false) MultipartFile file,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(restoreService.uploadAndValidate(file, currentUser));
    }

    @GetMapping("/restores/{restoreId}")
    public ApiResponse<RestoreDetailResponse> getRestoreDetail(
            @PathVariable Long restoreId,
            HttpSession session
    ) {
        SessionUser currentUser = authService.getRequiredSessionUser(session);
        return ApiResponse.success(restoreService.getRestoreDetail(restoreId, currentUser));
    }
}
