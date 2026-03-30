package com.dasisuhgi.mentalhealth.user.repository;

import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByLoginId(String loginId);

    long countByRoleAndStatus(UserRole role, UserStatus status);

    Page<User> findByStatus(UserStatus status, Pageable pageable);

    List<User> findAllByStatus(UserStatus status);

    @Query("""
            select u
            from User u
            where (:keyword is null or lower(u.name) like concat('%', :keyword, '%') or lower(u.loginId) like concat('%', :keyword, '%'))
              and (:role is null or u.role = :role)
              and (:status is null or u.status = :status)
            order by u.createdAt desc, u.id desc
            """)
    Page<User> searchUsers(
            @Param("keyword") String keyword,
            @Param("role") UserRole role,
            @Param("status") UserStatus status,
            Pageable pageable
    );
}
