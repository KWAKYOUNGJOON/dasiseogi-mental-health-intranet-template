package com.dasisuhgi.mentalhealth.auth.service;

import com.dasisuhgi.mentalhealth.auth.dto.AuthUserResponse;
import com.dasisuhgi.mentalhealth.auth.dto.LoginRequest;
import com.dasisuhgi.mentalhealth.auth.dto.LoginResponse;
import com.dasisuhgi.mentalhealth.auth.dto.UpdateMyProfileRequest;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.common.api.FieldErrorItem;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.session.SessionConstants;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\d{2,3}-?\\d{3,4}-?\\d{4}$");

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final ActivityLogService activityLogService;
    private final Duration sessionTimeout;

    public AuthService(
            UserRepository userRepository,
            BCryptPasswordEncoder passwordEncoder,
            ActivityLogService activityLogService,
            @Value("${server.servlet.session.timeout}") Duration sessionTimeout
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.activityLogService = activityLogService;
        this.sessionTimeout = Objects.requireNonNull(sessionTimeout, "sessionTimeout");
    }

    @Transactional
    public LoginResponse login(LoginRequest request, HttpSession session) {
        User user = userRepository.findByLoginId(request.loginId().trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED", "아이디 또는 비밀번호가 올바르지 않습니다."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "LOGIN_FAILED", "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        if (user.getStatus() == UserStatus.PENDING) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "USER_PENDING_APPROVAL", "승인 대기 중인 계정입니다.");
        }
        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "USER_INACTIVE", "비활성화된 계정입니다.");
        }
        if (user.getStatus() == UserStatus.REJECTED) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "USER_REJECTED", "반려된 계정입니다.");
        }

        user.setLastLoginAt(SeoulDateTimeSupport.now());
        session.setAttribute(SessionConstants.USER, SessionUser.from(user));
        activityLogService.log(
                user,
                ActivityActionType.LOGIN,
                ActivityTargetType.USER,
                user.getId(),
                user.getLoginId(),
                "로그인 성공"
        );
        return new LoginResponse(toResponse(user), getSessionTimeoutMinutes());
    }

    public AuthUserResponse getCurrentUser(HttpSession session) {
        SessionUser sessionUser = getRequiredSessionUser(session);
        User user = getCurrentUserEntity(sessionUser);
        return toResponse(user);
    }

    @Transactional
    public AuthUserResponse updateCurrentUser(UpdateMyProfileRequest request, HttpSession session) {
        SessionUser sessionUser = getRequiredSessionUser(session);
        User user = getCurrentUserEntity(sessionUser);
        validateProfileUpdateRequest(request);
        user.setName(request.getName().trim());
        user.setPhone(blankToNull(request.getPhone()));
        user.setTeamName(blankToNull(request.getTeamName()));

        session.setAttribute(SessionConstants.USER, SessionUser.from(user));
        activityLogService.log(
                user,
                ActivityActionType.USER_PROFILE_UPDATE,
                ActivityTargetType.USER,
                user.getId(),
                user.getLoginId(),
                "내 정보 수정"
        );
        return toResponse(user);
    }

    public SessionUser getRequiredSessionUser(HttpSession session) {
        Object value = session.getAttribute(SessionConstants.USER);
        if (value instanceof SessionUser sessionUser) {
            return sessionUser;
        }
        throw new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    public void logout(HttpSession session) {
        session.invalidate();
    }

    private User getCurrentUserEntity(SessionUser sessionUser) {
        return userRepository.findById(Objects.requireNonNull(sessionUser.userId(), "sessionUser.userId must not be null"))
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다."));
    }

    private void validateProfileUpdateRequest(UpdateMyProfileRequest request) {
        List<FieldErrorItem> fieldErrors = new ArrayList<>();

        request.unknownFieldNames().stream()
                .sorted(Comparator.naturalOrder())
                .forEach(fieldName -> fieldErrors.add(new FieldErrorItem(fieldName, "수정할 수 없는 항목입니다.")));

        String trimmedName = request.getName() == null ? "" : request.getName().trim();
        if (trimmedName.isEmpty()) {
            fieldErrors.add(new FieldErrorItem("name", "이름을 입력해주세요."));
        } else if (trimmedName.length() < 2) {
            fieldErrors.add(new FieldErrorItem("name", "이름은 2자 이상 입력해주세요."));
        } else if (trimmedName.length() > 50) {
            fieldErrors.add(new FieldErrorItem("name", "이름은 50자 이하로 입력해주세요."));
        }

        String normalizedPhone = blankToNull(request.getPhone());
        if (normalizedPhone != null && normalizedPhone.length() > 30) {
            fieldErrors.add(new FieldErrorItem("phone", "연락처는 30자 이하로 입력해주세요."));
        } else if (normalizedPhone != null && !PHONE_PATTERN.matcher(normalizedPhone).matches()) {
            fieldErrors.add(new FieldErrorItem("phone", "연락처 형식을 확인해주세요."));
        }

        String normalizedTeamName = blankToNull(request.getTeamName());
        if (normalizedTeamName != null && normalizedTeamName.length() > 100) {
            fieldErrors.add(new FieldErrorItem("teamName", "소속 팀은 100자 이하로 입력해주세요."));
        }

        if (!fieldErrors.isEmpty()) {
            String errorCode = request.unknownFieldNames().isEmpty() ? "VALIDATION_ERROR" : "USER_PROFILE_UPDATE_FIELD_NOT_ALLOWED";
            String message = request.unknownFieldNames().isEmpty() ? "입력값을 다시 확인해주세요." : "수정할 수 없는 항목이 포함되어 있습니다.";
            throw new AppException(HttpStatus.BAD_REQUEST, errorCode, message, fieldErrors);
        }
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private AuthUserResponse toResponse(User user) {
        return new AuthUserResponse(
                user.getId(),
                user.getLoginId(),
                user.getName(),
                user.getPhone(),
                user.getPositionName(),
                user.getTeamName(),
                user.getRole().name(),
                user.getStatus().name()
        );
    }

    private int getSessionTimeoutMinutes() {
        return Math.toIntExact(sessionTimeout.toMinutes());
    }
}
