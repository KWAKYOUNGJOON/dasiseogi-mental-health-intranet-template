package com.dasisuhgi.mentalhealth.audit.service;

import com.dasisuhgi.mentalhealth.audit.dto.ActivityLogListItemResponse;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityLog;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogQueryRepository;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.config.ActivityLogSchemaSynchronizer;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.web.RequestMetadataService;
import com.dasisuhgi.mentalhealth.user.entity.User;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;

@Service
public class ActivityLogService {
    private static final Logger log = LoggerFactory.getLogger(ActivityLogService.class);

    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogQueryRepository activityLogQueryRepository;
    private final AccessPolicyService accessPolicyService;
    private final RequestMetadataService requestMetadataService;
    private final TransactionTemplate requiresNewTransactionTemplate;
    private final ActivityLogSchemaSynchronizer activityLogSchemaSynchronizer;
    private final AtomicBoolean schemaSynchronized = new AtomicBoolean(false);

    public ActivityLogService(
            ActivityLogRepository activityLogRepository,
            ActivityLogQueryRepository activityLogQueryRepository,
            ActivityLogSchemaSynchronizer activityLogSchemaSynchronizer,
            AccessPolicyService accessPolicyService,
            RequestMetadataService requestMetadataService,
            PlatformTransactionManager transactionManager
    ) {
        this.activityLogRepository = activityLogRepository;
        this.activityLogQueryRepository = activityLogQueryRepository;
        this.activityLogSchemaSynchronizer = activityLogSchemaSynchronizer;
        this.accessPolicyService = accessPolicyService;
        this.requestMetadataService = requestMetadataService;
        this.requiresNewTransactionTemplate =
                new TransactionTemplate(Objects.requireNonNull(transactionManager, "transactionManager"));
        this.requiresNewTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
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
        ensureSchemaSynchronized();
        activityLogRepository.save(Objects.requireNonNull(
                buildActivityLog(user, actionType, targetType, targetId, targetLabel, description, ipAddress),
                "activityLog"
        ));
    }

    public void logBestEffort(
            User user,
            ActivityActionType actionType,
            ActivityTargetType targetType,
            Long targetId,
            String targetLabel,
            String description
    ) {
        logBestEffort(user, actionType, targetType, targetId, targetLabel, description, null);
    }

    public void logBestEffort(
            User user,
            ActivityActionType actionType,
            ActivityTargetType targetType,
            Long targetId,
            String targetLabel,
            String description,
            String ipAddress
    ) {
        ensureSchemaSynchronized();
        ActivityLog activityLog = buildActivityLog(user, actionType, targetType, targetId, targetLabel, description, ipAddress);

        try {
            requiresNewTransactionTemplate.executeWithoutResult(
                    status -> activityLogRepository.saveAndFlush(Objects.requireNonNull(activityLog, "activityLog"))
            );
        } catch (RuntimeException exception) {
            log.warn("Activity log persistence failed: actionType={}, targetType={}, targetId={}", actionType, targetType, targetId, exception);
        }
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

    private ActivityLog buildActivityLog(
            User user,
            ActivityActionType actionType,
            ActivityTargetType targetType,
            Long targetId,
            String targetLabel,
            String description,
            String ipAddress
    ) {
        ActivityLog activityLog = new ActivityLog();
        if (user != null) {
            activityLog.setUserId(user.getId());
            activityLog.setUserNameSnapshot(user.getName());
        }
        activityLog.setActionType(actionType);
        activityLog.setTargetType(targetType);
        activityLog.setTargetId(targetId);
        activityLog.setTargetLabel(targetLabel);
        activityLog.setDescription(description);
        activityLog.setIpAddress(ipAddress == null || ipAddress.isBlank() ? requestMetadataService.getClientIpAddress() : ipAddress);
        return activityLog;
    }

    private void ensureSchemaSynchronized() {
        if (schemaSynchronized.get()) {
            return;
        }

        synchronized (schemaSynchronized) {
            if (schemaSynchronized.get()) {
                return;
            }
            activityLogSchemaSynchronizer.synchronizeIfNeeded();
            schemaSynchronized.set(true);
        }
    }
}
