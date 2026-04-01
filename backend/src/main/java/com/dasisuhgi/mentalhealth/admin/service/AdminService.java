package com.dasisuhgi.mentalhealth.admin.service;

import com.dasisuhgi.mentalhealth.admin.dto.AdminUserListItemResponse;
import com.dasisuhgi.mentalhealth.admin.dto.AdminUserUpdateResponse;
import com.dasisuhgi.mentalhealth.admin.dto.SignupRequestListItemResponse;
import com.dasisuhgi.mentalhealth.admin.dto.SignupRequestProcessRequest;
import com.dasisuhgi.mentalhealth.admin.dto.SignupRequestProcessResponse;
import com.dasisuhgi.mentalhealth.admin.dto.UserRoleUpdateRequest;
import com.dasisuhgi.mentalhealth.admin.dto.UserStatusUpdateRequest;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.signup.entity.ApprovalRequestStatus;
import com.dasisuhgi.mentalhealth.signup.entity.UserApprovalRequest;
import com.dasisuhgi.mentalhealth.signup.repository.UserApprovalRequestRepository;
import com.dasisuhgi.mentalhealth.signup.service.SignupRequestService;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {
    private static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final UserRepository userRepository;
    private final UserApprovalRequestRepository userApprovalRequestRepository;
    private final SignupRequestService signupRequestService;
    private final AccessPolicyService accessPolicyService;
    private final ActivityLogService activityLogService;

    public AdminService(
            UserRepository userRepository,
            UserApprovalRequestRepository userApprovalRequestRepository,
            SignupRequestService signupRequestService,
            AccessPolicyService accessPolicyService,
            ActivityLogService activityLogService
    ) {
        this.userRepository = userRepository;
        this.userApprovalRequestRepository = userApprovalRequestRepository;
        this.signupRequestService = signupRequestService;
        this.accessPolicyService = accessPolicyService;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public PageResponse<SignupRequestListItemResponse> getSignupRequests(String status, int page, int size, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);
        validatePage(page, size);

        ApprovalRequestStatus parsedStatus = parseRequestStatus(status, ApprovalRequestStatus.PENDING);
        backfillApprovalRequestsIfNeeded(parsedStatus);
        Page<UserApprovalRequest> result = userApprovalRequestRepository.findByRequestStatus(
                parsedStatus,
                PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "requestedAt", "id"))
        );

        return new PageResponse<>(
                result.getContent().stream()
                        .map(requestItem -> new SignupRequestListItemResponse(
                                requestItem.getId(),
                                formatDateTime(requestItem.getRequestedAt()),
                                requestItem.getRequestedName(),
                                requestItem.getRequestedLoginId(),
                                requestItem.getRequestedPhone(),
                                requestItem.getRequestedPositionName(),
                                requestItem.getRequestedTeamName(),
                                requestItem.getRequestMemo(),
                                requestItem.getRequestStatus().name()
                        ))
                        .toList(),
                page,
                size,
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    @Transactional
    public SignupRequestProcessResponse approveSignupRequest(Long requestId, SignupRequestProcessRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);

        UserApprovalRequest approvalRequest = getApprovalRequest(requestId);
        User target = getUser(approvalRequest.getUserId());
        ensurePending(approvalRequest, target);

        target.setStatus(UserStatus.ACTIVE);
        target.setApprovedAt(LocalDateTime.now());
        target.setApprovedById(currentUser.getId());
        target.setRejectedAt(null);
        target.setRejectedById(null);
        target.setRejectionReason(null);
        approvalRequest.setRequestStatus(ApprovalRequestStatus.APPROVED);
        approvalRequest.setProcessedAt(target.getApprovedAt());
        approvalRequest.setProcessedBy(currentUser.getId());
        approvalRequest.setProcessNote(blankToNull(request.processNote()));
        activityLogService.log(
                currentUser,
                ActivityActionType.SIGNUP_APPROVE,
                ActivityTargetType.SIGNUP_REQUEST,
                approvalRequest.getId(),
                approvalRequest.getRequestedLoginId(),
                "가입 신청 승인"
        );

        return new SignupRequestProcessResponse(approvalRequest.getId(), target.getId(), approvalRequest.getRequestStatus().name(), target.getStatus().name());
    }

    @Transactional
    public SignupRequestProcessResponse rejectSignupRequest(Long requestId, SignupRequestProcessRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);

        UserApprovalRequest approvalRequest = getApprovalRequest(requestId);
        User target = getUser(approvalRequest.getUserId());
        ensurePending(approvalRequest, target);
        if (request.processNote() == null || request.processNote().isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "반려 사유를 입력해주세요.");
        }

        target.setStatus(UserStatus.REJECTED);
        target.setRejectedAt(LocalDateTime.now());
        target.setRejectedById(currentUser.getId());
        target.setRejectionReason(request.processNote().trim());
        approvalRequest.setRequestStatus(ApprovalRequestStatus.REJECTED);
        approvalRequest.setProcessedAt(target.getRejectedAt());
        approvalRequest.setProcessedBy(currentUser.getId());
        approvalRequest.setProcessNote(request.processNote().trim());
        activityLogService.log(
                currentUser,
                ActivityActionType.SIGNUP_REJECT,
                ActivityTargetType.SIGNUP_REQUEST,
                approvalRequest.getId(),
                approvalRequest.getRequestedLoginId(),
                "가입 신청 반려"
        );

        return new SignupRequestProcessResponse(approvalRequest.getId(), target.getId(), approvalRequest.getRequestStatus().name(), target.getStatus().name());
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUserListItemResponse> getUsers(
            String keyword,
            String role,
            String status,
            int page,
            int size,
            SessionUser sessionUser
    ) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);
        validatePage(page, size);

        UserRole parsedRole = role == null || role.isBlank() ? null : parseRole(role);
        UserStatus parsedStatus = status == null || status.isBlank() ? null : parseUserStatus(status, null);
        String normalizedKeyword = keyword == null || keyword.isBlank() ? null : keyword.trim().toLowerCase(Locale.ROOT);

        Page<User> result = userRepository.searchUsers(
                normalizedKeyword,
                parsedRole,
                parsedStatus,
                PageRequest.of(page - 1, size)
        );

        return new PageResponse<>(
                result.getContent().stream()
                        .map(user -> new AdminUserListItemResponse(
                                user.getId(),
                                user.getName(),
                                user.getLoginId(),
                                user.getPhone(),
                                user.getRole().name(),
                                user.getStatus().name(),
                                formatDateTime(user.getApprovedAt()),
                                formatDateTime(user.getLastLoginAt())
                        ))
                        .toList(),
                page,
                size,
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    @Transactional
    public AdminUserUpdateResponse updateUserRole(Long userId, UserRoleUpdateRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);

        User target = getUser(userId);
        UserRole nextRole = parseRole(request.role());
        ensureLastActiveAdminWillRemain(target, nextRole, target.getStatus());
        target.setRole(nextRole);
        activityLogService.log(
                currentUser,
                ActivityActionType.USER_ROLE_CHANGE,
                ActivityTargetType.USER,
                target.getId(),
                target.getLoginId(),
                "사용자 역할 변경: " + nextRole.name()
        );
        return new AdminUserUpdateResponse(target.getId(), target.getRole().name(), target.getStatus().name());
    }

    @Transactional
    public AdminUserUpdateResponse updateUserStatus(Long userId, UserStatusUpdateRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);

        User target = getUser(userId);
        UserStatus nextStatus = parseMutableStatus(request.status());
        ensureLastActiveAdminWillRemain(target, target.getRole(), nextStatus);
        target.setStatus(nextStatus);
        activityLogService.log(
                currentUser,
                ActivityActionType.USER_STATUS_CHANGE,
                ActivityTargetType.USER,
                target.getId(),
                target.getLoginId(),
                "사용자 상태 변경: " + nextStatus.name()
        );
        return new AdminUserUpdateResponse(target.getId(), target.getRole().name(), target.getStatus().name());
    }

    private void ensureLastActiveAdminWillRemain(User target, UserRole nextRole, UserStatus nextStatus) {
        boolean targetIsActiveAdmin = target.getRole() == UserRole.ADMIN && target.getStatus() == UserStatus.ACTIVE;
        boolean willRemainActiveAdmin = nextRole == UserRole.ADMIN && nextStatus == UserStatus.ACTIVE;
        if (!targetIsActiveAdmin || willRemainActiveAdmin) {
            return;
        }
        if (userRepository.countByRoleAndStatus(UserRole.ADMIN, UserStatus.ACTIVE) <= 1) {
            throw new AppException(HttpStatus.CONFLICT, "LAST_ACTIVE_ADMIN_REQUIRED", "마지막 활성 관리자는 변경할 수 없습니다.");
        }
    }

    private UserApprovalRequest getApprovalRequest(Long requestId) {
        Long requiredRequestId = Objects.requireNonNull(requestId, "requestId must not be null");
        return userApprovalRequestRepository.findById(requiredRequestId)
                .orElseThrow(() -> {
                    if (userRepository.existsById(requiredRequestId)) {
                        return new AppException(HttpStatus.BAD_REQUEST, "SIGNUP_REQUEST_ID_REQUIRED", "가입 신청 처리에는 requestId를 사용해야 합니다.");
                    }
                    return new AppException(HttpStatus.NOT_FOUND, "SIGNUP_REQUEST_NOT_FOUND", "가입 신청을 찾을 수 없습니다.");
                });
    }

    private User getUser(Long userId) {
        return userRepository.findById(Objects.requireNonNull(userId, "userId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다."));
    }

    private void ensurePending(UserApprovalRequest approvalRequest, User user) {
        if (approvalRequest.getRequestStatus() == ApprovalRequestStatus.PENDING && user.getStatus() == UserStatus.PENDING) {
            return;
        }
        throw new AppException(HttpStatus.CONFLICT, "SIGNUP_REQUEST_ALREADY_PROCESSED", "이미 처리된 가입 신청입니다.");
    }

    private void validatePage(int page, int size) {
        if (page < 1 || size < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_PAGE_REQUEST", "페이지 요청 값을 다시 확인해주세요.");
        }
    }

    private UserRole parseRole(String role) {
        if (role == null || role.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "허용되지 않은 권한입니다.");
        }
        try {
            return UserRole.valueOf(role.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "허용되지 않은 권한입니다.");
        }
    }

    private UserStatus parseMutableStatus(String status) {
        UserStatus parsedStatus = parseUserStatus(status, null);
        if (parsedStatus != UserStatus.ACTIVE && parsedStatus != UserStatus.INACTIVE) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_USER_STATUS", "허용되지 않은 사용자 상태입니다.");
        }
        return parsedStatus;
    }

    private UserStatus parseUserStatus(String status, UserStatus defaultValue) {
        if (status == null || status.isBlank()) {
            return defaultValue;
        }
        try {
            return UserStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_USER_STATUS", "허용되지 않은 사용자 상태입니다.");
        }
    }

    private ApprovalRequestStatus parseRequestStatus(String status, ApprovalRequestStatus defaultValue) {
        if (status == null || status.isBlank()) {
            return defaultValue;
        }
        try {
            return ApprovalRequestStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_STATUS", "허용되지 않은 가입 신청 상태입니다.");
        }
    }

    private void backfillApprovalRequestsIfNeeded(ApprovalRequestStatus requestStatus) {
        List<UserStatus> userStatuses = switch (requestStatus) {
            case PENDING -> List.of(UserStatus.PENDING);
            case REJECTED -> List.of(UserStatus.REJECTED);
            case APPROVED -> List.of(UserStatus.ACTIVE, UserStatus.INACTIVE);
        };
        for (UserStatus userStatus : userStatuses) {
            for (User user : userRepository.findAllByStatus(userStatus)) {
                signupRequestService.ensureApprovalRequest(user);
            }
        }
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? null : DATETIME_FORMAT.format(value);
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
