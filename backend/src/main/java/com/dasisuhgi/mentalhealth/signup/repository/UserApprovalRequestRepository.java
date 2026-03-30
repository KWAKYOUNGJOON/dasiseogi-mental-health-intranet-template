package com.dasisuhgi.mentalhealth.signup.repository;

import com.dasisuhgi.mentalhealth.signup.entity.ApprovalRequestStatus;
import com.dasisuhgi.mentalhealth.signup.entity.UserApprovalRequest;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserApprovalRequestRepository extends JpaRepository<UserApprovalRequest, Long> {
    Page<UserApprovalRequest> findByRequestStatus(ApprovalRequestStatus requestStatus, Pageable pageable);

    Optional<UserApprovalRequest> findTopByUserIdOrderByRequestedAtDesc(Long userId);
}
