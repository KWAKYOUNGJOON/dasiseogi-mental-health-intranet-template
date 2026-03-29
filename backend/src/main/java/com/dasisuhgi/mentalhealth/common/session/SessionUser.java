package com.dasisuhgi.mentalhealth.common.session;

import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;

public record SessionUser(
        Long userId,
        String loginId,
        String name,
        UserRole role,
        UserStatus status
) {
    public static SessionUser from(User user) {
        return new SessionUser(user.getId(), user.getLoginId(), user.getName(), user.getRole(), user.getStatus());
    }
}
