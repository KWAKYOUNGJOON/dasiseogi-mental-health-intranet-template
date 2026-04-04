-- 다시서기 정신건강 평가관리 시스템 초기 스키마 SQL 초안
-- 범위: identifier_sequences, users, user_approval_requests, clients,
--       assessment_sessions, session_scales, session_answers, session_alerts,
--       activity_logs, backup_histories, restore_histories
-- 기준 문서: docs/02-db-design.md, docs/03-api-spec.md, docs/07-validation-rules.md
-- 대상 DB: MariaDB/MySQL

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS identifier_sequences (
    id BIGINT NOT NULL AUTO_INCREMENT,
    sequence_type VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    login_id VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NULL,
    position_name VARCHAR(50) NULL,
    team_name VARCHAR(100) NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_login_at DATETIME NULL,
    approved_at DATETIME NULL,
    approved_by_id BIGINT NULL,
    rejected_at DATETIME NULL,
    rejected_by_id BIGINT NULL,
    rejection_reason VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_login_id UNIQUE (login_id),
    CONSTRAINT chk_users_role
        CHECK (role IN ('ADMIN', 'USER')),
    CONSTRAINT chk_users_status
        CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED')),
    CONSTRAINT fk_users_approved_by
        FOREIGN KEY (approved_by_id) REFERENCES users (id),
    CONSTRAINT fk_users_rejected_by
        FOREIGN KEY (rejected_by_id) REFERENCES users (id),
    INDEX idx_users_status (status),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_approval_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    requested_name VARCHAR(50) NOT NULL,
    requested_login_id VARCHAR(50) NOT NULL,
    requested_phone VARCHAR(30) NULL,
    requested_position_name VARCHAR(50) NULL,
    requested_team_name VARCHAR(100) NULL,
    request_memo TEXT NULL,
    request_status VARCHAR(20) NOT NULL,
    requested_at DATETIME NOT NULL,
    processed_at DATETIME NULL,
    processed_by BIGINT NULL,
    process_note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_user_approval_requests_status
        CHECK (request_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT fk_user_approval_requests_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_approval_requests_processed_by
        FOREIGN KEY (processed_by) REFERENCES users (id),
    INDEX idx_user_approval_requests_status (request_status),
    INDEX idx_user_approval_requests_requested_at (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
    id BIGINT NOT NULL AUTO_INCREMENT,
    client_no VARCHAR(30) NOT NULL,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    birth_date DATE NOT NULL,
    phone VARCHAR(30) NULL,
    primary_worker_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    misregistered_at DATETIME NULL,
    misregistered_by BIGINT NULL,
    misregistered_reason VARCHAR(255) NULL,
    registered_at DATETIME NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_clients_client_no UNIQUE (client_no),
    CONSTRAINT chk_clients_gender
        CHECK (gender IN ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN')),
    CONSTRAINT chk_clients_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'MISREGISTERED')),
    CONSTRAINT fk_clients_primary_worker
        FOREIGN KEY (primary_worker_id) REFERENCES users (id),
    CONSTRAINT fk_clients_misregistered_by
        FOREIGN KEY (misregistered_by) REFERENCES users (id),
    CONSTRAINT fk_clients_created_by
        FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_clients_updated_by
        FOREIGN KEY (updated_by) REFERENCES users (id),
    INDEX idx_clients_name_birth_date (name, birth_date),
    INDEX idx_clients_primary_worker_id (primary_worker_id),
    INDEX idx_clients_status (status),
    INDEX idx_clients_recent (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_sessions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_no VARCHAR(30) NOT NULL,
    client_id BIGINT NOT NULL,
    session_date DATE NOT NULL,
    session_started_at DATETIME NOT NULL,
    session_completed_at DATETIME NOT NULL,
    performed_by BIGINT NOT NULL,
    scale_count INT NOT NULL DEFAULT 0,
    has_alert BOOLEAN NOT NULL DEFAULT FALSE,
    memo LONGTEXT NULL,
    status VARCHAR(20) NOT NULL,
    misentered_at DATETIME NULL,
    misentered_by BIGINT NULL,
    misentered_reason VARCHAR(255) NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_assessment_sessions_session_no UNIQUE (session_no),
    CONSTRAINT chk_assessment_sessions_status
        CHECK (status IN ('COMPLETED', 'MISENTERED')),
    CONSTRAINT fk_assessment_sessions_client
        FOREIGN KEY (client_id) REFERENCES clients (id),
    CONSTRAINT fk_assessment_sessions_performed_by
        FOREIGN KEY (performed_by) REFERENCES users (id),
    CONSTRAINT fk_assessment_sessions_misentered_by
        FOREIGN KEY (misentered_by) REFERENCES users (id),
    CONSTRAINT fk_assessment_sessions_created_by
        FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_assessment_sessions_updated_by
        FOREIGN KEY (updated_by) REFERENCES users (id),
    INDEX idx_assessment_sessions_client_id (client_id),
    INDEX idx_assessment_sessions_performed_by (performed_by),
    INDEX idx_assessment_sessions_session_date (session_date),
    INDEX idx_assessment_sessions_status (status),
    INDEX idx_assessment_sessions_client_date (client_id, session_completed_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_scales (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    scale_code VARCHAR(30) NOT NULL,
    scale_name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL,
    total_score DECIMAL(10, 2) NOT NULL,
    result_level VARCHAR(100) NOT NULL,
    has_alert BOOLEAN NOT NULL DEFAULT FALSE,
    is_completed BOOLEAN NOT NULL DEFAULT TRUE,
    raw_result_snapshot JSON NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_session_scales_session_id_scale_code UNIQUE (session_id, scale_code),
    CONSTRAINT chk_session_scales_scale_code
        CHECK (scale_code IN ('PHQ9', 'GAD7', 'MKPQ16', 'KMDQ', 'PSS10', 'ISIK', 'AUDITK', 'IESR')),
    CONSTRAINT chk_session_scales_raw_result_snapshot
        CHECK (JSON_VALID(raw_result_snapshot)),
    CONSTRAINT fk_session_scales_session
        FOREIGN KEY (session_id) REFERENCES assessment_sessions (id),
    INDEX idx_session_scales_scale_code (scale_code),
    INDEX idx_session_scales_has_alert (has_alert),
    INDEX idx_session_scales_total_score (total_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_answers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_scale_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    scale_code VARCHAR(30) NOT NULL,
    question_no INT NOT NULL,
    question_key VARCHAR(50) NOT NULL,
    question_text_snapshot TEXT NOT NULL,
    answer_value VARCHAR(50) NOT NULL,
    answer_label_snapshot VARCHAR(100) NOT NULL,
    score_value DECIMAL(10, 2) NOT NULL,
    is_reverse_scored BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_session_answers_scale_question UNIQUE (session_scale_id, question_no),
    CONSTRAINT chk_session_answers_scale_code
        CHECK (scale_code IN ('PHQ9', 'GAD7', 'MKPQ16', 'KMDQ', 'PSS10', 'ISIK', 'AUDITK', 'IESR')),
    CONSTRAINT fk_session_answers_session_scale
        FOREIGN KEY (session_scale_id) REFERENCES session_scales (id),
    CONSTRAINT fk_session_answers_session
        FOREIGN KEY (session_id) REFERENCES assessment_sessions (id),
    INDEX idx_session_answers_session_id (session_id),
    INDEX idx_session_answers_scale_code (scale_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_alerts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    session_scale_id BIGINT NULL,
    client_id BIGINT NOT NULL,
    scale_code VARCHAR(30) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    alert_code VARCHAR(100) NOT NULL,
    alert_message VARCHAR(255) NOT NULL,
    question_no INT NULL,
    trigger_value VARCHAR(100) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_session_alerts_scale_code
        CHECK (scale_code IN ('PHQ9', 'GAD7', 'MKPQ16', 'KMDQ', 'PSS10', 'ISIK', 'AUDITK', 'IESR')),
    CONSTRAINT chk_session_alerts_alert_type
        CHECK (alert_type IN ('HIGH_RISK', 'CAUTION', 'CRITICAL_ITEM', 'COMPOSITE_RULE')),
    CONSTRAINT fk_session_alerts_session
        FOREIGN KEY (session_id) REFERENCES assessment_sessions (id),
    CONSTRAINT fk_session_alerts_session_scale
        FOREIGN KEY (session_scale_id) REFERENCES session_scales (id),
    CONSTRAINT fk_session_alerts_client
        FOREIGN KEY (client_id) REFERENCES clients (id),
    INDEX idx_session_alerts_session_id (session_id),
    INDEX idx_session_alerts_client_id (client_id),
    INDEX idx_session_alerts_scale_code (scale_code),
    INDEX idx_session_alerts_alert_type (alert_type),
    INDEX idx_session_alerts_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    user_name_snapshot VARCHAR(50) NULL,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NULL,
    target_id BIGINT NULL,
    target_label VARCHAR(255) NULL,
    description VARCHAR(500) NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_activity_logs_action_type
        CHECK (
            action_type IN (
                'LOGIN',
                'SIGNUP_REQUEST',
                'SIGNUP_APPROVE',
                'SIGNUP_REJECT',
                'USER_ROLE_CHANGE',
                'USER_STATUS_CHANGE',
                'CLIENT_CREATE',
                'CLIENT_UPDATE',
                'CLIENT_MARK_MISREGISTERED',
                'SESSION_CREATE',
                'SESSION_MARK_MISENTERED',
                'PRINT_SESSION',
                'STATISTICS_EXPORT',
                'BACKUP_RUN',
                'RESTORE_UPLOAD'
            )
        ),
    CONSTRAINT chk_activity_logs_target_type
        CHECK (
            target_type IS NULL OR target_type IN (
                'USER',
                'SIGNUP_REQUEST',
                'CLIENT',
                'SESSION',
                'STATISTICS',
                'BACKUP',
                'RESTORE'
            )
        ),
    CONSTRAINT fk_activity_logs_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    INDEX idx_activity_logs_user_id (user_id),
    INDEX idx_activity_logs_action_type (action_type),
    INDEX idx_activity_logs_target_type_target_id (target_type, target_id),
    INDEX idx_activity_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS backup_histories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    backup_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    backup_method VARCHAR(20) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NULL,
    started_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    executed_by_id BIGINT NULL,
    executed_by_name_snapshot VARCHAR(50) NULL,
    failure_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_backup_histories_backup_type
        CHECK (backup_type IN ('AUTO', 'MANUAL')),
    CONSTRAINT chk_backup_histories_status
        CHECK (status IN ('SUCCESS', 'FAILED')),
    CONSTRAINT chk_backup_histories_backup_method
        CHECK (backup_method IN ('DB_DUMP', 'SNAPSHOT')),
    CONSTRAINT fk_backup_histories_executed_by
        FOREIGN KEY (executed_by_id) REFERENCES users (id),
    INDEX idx_backup_histories_backup_type (backup_type),
    INDEX idx_backup_histories_status (status),
    INDEX idx_backup_histories_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restore_histories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    status VARCHAR(20) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NULL,
    uploaded_at DATETIME NOT NULL,
    validated_at DATETIME NULL,
    uploaded_by_id BIGINT NULL,
    uploaded_by_name_snapshot VARCHAR(50) NULL,
    format_version VARCHAR(50) NULL,
    datasource_type VARCHAR(30) NULL,
    backup_id BIGINT NULL,
    failure_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_restore_histories_status
        CHECK (status IN ('UPLOADED', 'VALIDATED', 'FAILED')),
    CONSTRAINT fk_restore_histories_uploaded_by
        FOREIGN KEY (uploaded_by_id) REFERENCES users (id),
    INDEX idx_restore_histories_status (status),
    INDEX idx_restore_histories_uploaded_at (uploaded_at),
    INDEX idx_restore_histories_validated_at (validated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
