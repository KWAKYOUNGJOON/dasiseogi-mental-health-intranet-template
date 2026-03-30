package com.dasisuhgi.mentalhealth.audit.service;

import com.dasisuhgi.mentalhealth.audit.dto.ActivityLogListItemResponse;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityLog;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogQueryRepository;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.web.RequestMetadataService;
import com.dasisuhgi.mentalhealth.user.entity.User;
import java.time.LocalDate;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityLogService {
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogQueryRepository activityLogQueryRepository;
    private final AccessPolicyService accessPolicyService;
    private final RequestMetadataService requestMetadataService;

    public ActivityLogService(
            ActivityLogRepository activityLogRepository,
            ActivityLogQueryRepository activityLogQueryRepository,
            AccessPolicyService accessPolicyService,
            RequestMetadataService requestMetadataService
    ) {
        this.activityLogRepository = activityLogRepository;
        this.activityLogQueryRepository = activityLogQueryRepository;
        this.accessPolicyService = accessPolicyService;
        this.requestMetadataService = requestMetadataService;
    }

    @Transactional
    public void log(
            User user,
            ActivityActionType actionType,
            ActivityTargetType targetType,
            Long targetId,
            String targetLabel,
            String description
    ) {
        log(user, actionType, targetType, targetId, targetLabel, description, null);
    }

    @Transactional
    public void log(
            User user,
            ActivityActionType actionType,
            ActivityTargetType targetType,
            Long targetId,
            String targetLabel,
            String description,
            String ipAddress
    ) {
        ActivityLog log = new ActivityLog();
        if (user != null) {
            log.setUserId(user.getId());
            log.setUserNameSnapshot(user.getName());
        }
        log.setActionType(actionType);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setTargetLabel(targetLabel);
        log.setDescription(description);
        log.setIpAddress(ipAddress == null || ipAddress.isBlank() ? requestMetadataService.getClientIpAddress() : ipAddress);
        activityLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public PageResponse<ActivityLogListItemResponse> getLogs(
            LocalDate dateFrom,
            LocalDate dateTo,
            Long userId,
            String actionType,
            int page,
            int size,
            SessionUser sessionUser
    ) {
        if (page < 1 || size < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_PAGE_REQUEST", "페이지 요청 값을 다시 확인해주세요.");
        }
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);
        return activityLogQueryRepository.findLogs(dateFrom, dateTo, userId, parseActionType(actionType), page, size);
    }

    private ActivityActionType parseActionType(String actionType) {
        if (actionType == null || actionType.isBlank()) {
            return null;
        }
        try {
            return ActivityActionType.valueOf(actionType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "허용되지 않은 로그 액션 유형입니다.");
        }
    }
}
