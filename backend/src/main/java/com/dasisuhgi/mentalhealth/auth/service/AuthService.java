package com.dasisuhgi.mentalhealth.auth.service;

import com.dasisuhgi.mentalhealth.auth.dto.AuthUserResponse;
import com.dasisuhgi.mentalhealth.auth.dto.LoginRequest;
import com.dasisuhgi.mentalhealth.auth.dto.LoginResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.session.SessionConstants;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDateTime;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
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

        user.setLastLoginAt(LocalDateTime.now());
        session.setAttribute(SessionConstants.USER, SessionUser.from(user));
        return new LoginResponse(toResponse(user), 120);
    }

    public AuthUserResponse getCurrentUser(HttpSession session) {
        SessionUser sessionUser = getRequiredSessionUser(session);
        User user = userRepository.findById(sessionUser.userId())
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다."));
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
}
