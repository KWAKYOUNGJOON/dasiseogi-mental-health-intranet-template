package com.dasisuhgi.mentalhealth.signup.service;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.common.api.FieldErrorItem;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.signup.dto.CreateSignupRequestRequest;
import com.dasisuhgi.mentalhealth.signup.dto.CreateSignupRequestResponse;
import com.dasisuhgi.mentalhealth.signup.entity.ApprovalRequestStatus;
import com.dasisuhgi.mentalhealth.signup.entity.UserApprovalRequest;
import com.dasisuhgi.mentalhealth.signup.repository.UserApprovalRequestRepository;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import com.dasisuhgi.mentalhealth.user.support.PositionNamePolicy;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SignupRequestService {
    private final UserRepository userRepository;
    private final UserApprovalRequestRepository userApprovalRequestRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final ActivityLogService activityLogService;

    public SignupRequestService(
            UserRepository userRepository,
            UserApprovalRequestRepository userApprovalRequestRepository,
            BCryptPasswordEncoder passwordEncoder,
            ActivityLogService activityLogService
    ) {
        this.userRepository = userRepository;
        this.userApprovalRequestRepository = userApprovalRequestRepository;
        this.passwordEncoder = passwordEncoder;
        this.activityLogService = activityLogService;
    }

    @Transactional
    public CreateSignupRequestResponse createSignupRequest(CreateSignupRequestRequest request) {
        String normalizedPositionName = PositionNamePolicy.normalize(request.positionName());
        validatePositionName(normalizedPositionName);

        String normalizedLoginId = request.loginId().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByLoginId(normalizedLoginId).isPresent()) {
            throw new AppException(HttpStatus.CONFLICT, "LOGIN_ID_DUPLICATED", "이미 사용 중인 아이디입니다.");
        }

        User user = new User();
        user.setLoginId(normalizedLoginId);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setName(request.name().trim());
        user.setPhone(blankToNull(request.phone()));
        user.setPositionName(normalizedPositionName);
        user.setTeamName(blankToNull(request.teamName()));
        user.setRole(UserRole.USER);
        user.setStatus(UserStatus.PENDING);
        userRepository.save(user);

        UserApprovalRequest approvalRequest = new UserApprovalRequest();
        approvalRequest.setUserId(user.getId());
        approvalRequest.setRequestedName(user.getName());
        approvalRequest.setRequestedLoginId(user.getLoginId());
        approvalRequest.setRequestedPhone(user.getPhone());
        approvalRequest.setRequestedPositionName(user.getPositionName());
        approvalRequest.setRequestedTeamName(user.getTeamName());
        approvalRequest.setRequestMemo(blankToNull(request.requestMemo()));
        approvalRequest.setRequestStatus(ApprovalRequestStatus.PENDING);
        userApprovalRequestRepository.save(approvalRequest);

        activityLogService.log(
                user,
                ActivityActionType.SIGNUP_REQUEST,
                ActivityTargetType.SIGNUP_REQUEST,
                approvalRequest.getId(),
                user.getLoginId(),
                "회원가입 신청"
        );

        return new CreateSignupRequestResponse(approvalRequest.getId(), user.getId(), approvalRequest.getRequestStatus().name());
    }

    @Transactional
    public UserApprovalRequest ensureApprovalRequest(User user) {
        return userApprovalRequestRepository.findTopByUserIdOrderByRequestedAtDesc(user.getId())
                .orElseGet(() -> createCompatibilityRequest(user));
    }

    private UserApprovalRequest createCompatibilityRequest(User user) {
        UserApprovalRequest approvalRequest = new UserApprovalRequest();
        approvalRequest.setUserId(user.getId());
        approvalRequest.setRequestedName(user.getName());
        approvalRequest.setRequestedLoginId(user.getLoginId());
        approvalRequest.setRequestedPhone(user.getPhone());
        approvalRequest.setRequestedPositionName(user.getPositionName());
        approvalRequest.setRequestedTeamName(user.getTeamName());
        approvalRequest.setRequestMemo(user.getRejectionReason());
        approvalRequest.setRequestStatus(toApprovalRequestStatus(user.getStatus()));
        approvalRequest.setRequestedAt(user.getCreatedAt());
        if (user.getApprovedAt() != null) {
            approvalRequest.setProcessedAt(user.getApprovedAt());
            approvalRequest.setProcessedBy(user.getApprovedById());
        } else if (user.getRejectedAt() != null) {
            approvalRequest.setProcessedAt(user.getRejectedAt());
            approvalRequest.setProcessedBy(user.getRejectedById());
            approvalRequest.setProcessNote(user.getRejectionReason());
        }
        return userApprovalRequestRepository.save(approvalRequest);
    }

    private ApprovalRequestStatus toApprovalRequestStatus(UserStatus userStatus) {
        return switch (userStatus) {
            case PENDING -> ApprovalRequestStatus.PENDING;
            case REJECTED -> ApprovalRequestStatus.REJECTED;
            case ACTIVE, INACTIVE -> ApprovalRequestStatus.APPROVED;
        };
    }

    private void validatePositionName(String positionName) {
        if (PositionNamePolicy.isAllowed(positionName)) {
            return;
        }

        throw new AppException(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_ERROR",
                "입력값을 다시 확인해주세요.",
                List.of(new FieldErrorItem(PositionNamePolicy.FIELD_NAME, PositionNamePolicy.INVALID_SELECTION_MESSAGE))
        );
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
