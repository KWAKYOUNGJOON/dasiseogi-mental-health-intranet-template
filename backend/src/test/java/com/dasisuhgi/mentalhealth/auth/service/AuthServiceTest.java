package com.dasisuhgi.mentalhealth.auth.service;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.auth.dto.LoginRequest;
import com.dasisuhgi.mentalhealth.auth.dto.LoginResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.session.SessionConstants;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import java.time.Duration;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private ActivityLogService activityLogService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Test
    void loginReturnsConfigured120MinuteTimeoutAndPreservesSuccessBehavior() {
        AuthService authService = authService(Duration.ofMinutes(120));
        User user = user("admin", "password123!", UserStatus.ACTIVE);
        MockHttpSession session = new MockHttpSession();

        when(userRepository.findByLoginId("admin")).thenReturn(Optional.of(user));

        LoginResponse response = authService.login(new LoginRequest(" ADMIN ", "password123!"), session);

        assertThat(response.sessionTimeoutMinutes()).isEqualTo(120);
        assertThat(response.user()).isNotNull();
        assertThat(response.user().loginId()).isEqualTo("admin");
        assertThat(user.getLastLoginAt()).isNotNull();
        assertThat(session.getAttribute(SessionConstants.USER)).isEqualTo(SessionUser.from(user));
        verify(userRepository).findByLoginId("admin");
        verify(activityLogService).log(
                user,
                ActivityActionType.LOGIN,
                ActivityTargetType.USER,
                user.getId(),
                user.getLoginId(),
                "로그인 성공"
        );
    }

    @Test
    void loginReturnsConfigured45MinuteTimeout() {
        AuthService authService = authService(Duration.ofMinutes(45));
        User user = user("caseworker", "password123!", UserStatus.ACTIVE);
        MockHttpSession session = new MockHttpSession();

        when(userRepository.findByLoginId("caseworker")).thenReturn(Optional.of(user));

        LoginResponse response = authService.login(new LoginRequest("caseworker", "password123!"), session);

        assertThat(response.sessionTimeoutMinutes()).isEqualTo(45);
        assertThat(session.getAttribute(SessionConstants.USER)).isEqualTo(SessionUser.from(user));
    }

    @Test
    void loginFailsWhenPasswordDoesNotMatch() {
        AuthService authService = authService(Duration.ofMinutes(120));
        User user = user("admin", "password123!", UserStatus.ACTIVE);
        MockHttpSession session = new MockHttpSession();

        when(userRepository.findByLoginId("admin")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin", "wrong-password"), session))
                .isInstanceOf(AppException.class)
                .satisfies(exception -> {
                    AppException appException = (AppException) exception;
                    assertThat(appException.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(appException.getErrorCode()).isEqualTo("LOGIN_FAILED");
                });

        assertThat(session.getAttribute(SessionConstants.USER)).isNull();
        verifyNoInteractions(activityLogService);
    }

    @ParameterizedTest
    @MethodSource("inactiveStatuses")
    void loginRejectsPendingInactiveAndRejectedUsers(UserStatus status, String errorCode) {
        AuthService authService = authService(Duration.ofMinutes(120));
        User user = user("admin", "password123!", status);
        MockHttpSession session = new MockHttpSession();

        when(userRepository.findByLoginId("admin")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin", "password123!"), session))
                .isInstanceOf(AppException.class)
                .satisfies(exception -> {
                    AppException appException = (AppException) exception;
                    assertThat(appException.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(appException.getErrorCode()).isEqualTo(errorCode);
                });

        assertThat(session.getAttribute(SessionConstants.USER)).isNull();
        verifyNoInteractions(activityLogService);
    }

    private AuthService authService(Duration sessionTimeout) {
        return new AuthService(userRepository, passwordEncoder, activityLogService, sessionTimeout);
    }

    private User user(String loginId, String rawPassword, UserStatus status) {
        User user = new User();
        user.setId(1L);
        user.setLoginId(loginId);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setName("테스트 사용자");
        user.setRole(UserRole.USER);
        user.setStatus(status);
        return user;
    }

    private static Stream<Arguments> inactiveStatuses() {
        return Stream.of(
                arguments(UserStatus.PENDING, "USER_PENDING_APPROVAL"),
                arguments(UserStatus.INACTIVE, "USER_INACTIVE"),
                arguments(UserStatus.REJECTED, "USER_REJECTED")
        );
    }
}
