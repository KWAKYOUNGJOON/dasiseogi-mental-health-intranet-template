package com.dasisuhgi.mentalhealth.signup.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "user_approval_requests",
        indexes = {
                @Index(name = "idx_user_approval_requests_status", columnList = "request_status"),
                @Index(name = "idx_user_approval_requests_requested_at", columnList = "requested_at")
        }
)
public class UserApprovalRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "requested_name", nullable = false, length = 50)
    private String requestedName;

    @Column(name = "requested_login_id", nullable = false, length = 50)
    private String requestedLoginId;

    @Column(name = "requested_phone", length = 30)
    private String requestedPhone;

    @Column(name = "requested_position_name", length = 50)
    private String requestedPositionName;

    @Column(name = "requested_team_name", length = 100)
    private String requestedTeamName;

    @Column(name = "request_memo", length = 4000)
    private String requestMemo;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_status", nullable = false, length = 20)
    private ApprovalRequestStatus requestStatus;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "processed_by")
    private Long processedBy;

    @Column(name = "process_note", length = 255)
    private String processNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (requestedAt == null) {
            requestedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
