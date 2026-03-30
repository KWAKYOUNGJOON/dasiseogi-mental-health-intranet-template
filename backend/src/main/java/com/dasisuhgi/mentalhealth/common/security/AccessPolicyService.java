package com.dasisuhgi.mentalhealth.common.security;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AccessPolicyService {
    private final UserRepository userRepository;

    public AccessPolicyService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getCurrentUser(SessionUser sessionUser) {
        return userRepository.findById(sessionUser.userId())
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다."));
    }

    public void assertCanViewClient(User currentUser, Client client) {
        if (client.getStatus() != ClientStatus.MISREGISTERED) {
            return;
        }
        if (canManageClient(currentUser, client)) {
            return;
        }
        throw new AppException(HttpStatus.FORBIDDEN, "CLIENT_VIEW_FORBIDDEN", "해당 대상자를 조회할 권한이 없습니다.");
    }

    public void assertCanViewSession(User currentUser, AssessmentSession session) {
        if (session.getStatus() != AssessmentSessionStatus.MISENTERED) {
            return;
        }
        if (canManageSession(currentUser, session)) {
            return;
        }
        throw new AppException(HttpStatus.FORBIDDEN, "SESSION_VIEW_FORBIDDEN", "해당 세션을 조회할 권한이 없습니다.");
    }

    public void assertCanMarkClientMisregistered(User currentUser, Client client) {
        if (canManageClient(currentUser, client)) {
            return;
        }
        throw new AppException(HttpStatus.FORBIDDEN, "CLIENT_MARK_MISREGISTERED_FORBIDDEN", "해당 대상자를 오등록 처리할 권한이 없습니다.");
    }

    public void assertCanUpdateClient(User currentUser, Client client) {
        if (canManageClient(currentUser, client)) {
            return;
        }
        throw new AppException(HttpStatus.FORBIDDEN, "CLIENT_UPDATE_FORBIDDEN", "해당 대상자를 수정할 권한이 없습니다.");
    }

    public void assertCanMarkSessionMisentered(User currentUser, AssessmentSession session) {
        if (canManageSession(currentUser, session)) {
            return;
        }
        throw new AppException(HttpStatus.FORBIDDEN, "SESSION_MARK_MISENTERED_FORBIDDEN", "해당 세션을 오입력 처리할 권한이 없습니다.");
    }

    public boolean isAdmin(User user) {
        return user.getRole() == UserRole.ADMIN;
    }

    public void assertAdmin(User user) {
        if (isAdmin(user)) {
            return;
        }
        throw new AppException(HttpStatus.FORBIDDEN, "FORBIDDEN", "관리자 권한이 필요합니다.");
    }

    private boolean canManageClient(User currentUser, Client client) {
        return isAdmin(currentUser) || client.getCreatedBy().getId().equals(currentUser.getId());
    }

    private boolean canManageSession(User currentUser, AssessmentSession session) {
        return isAdmin(currentUser) || session.getPerformedBy().getId().equals(currentUser.getId());
    }
}
