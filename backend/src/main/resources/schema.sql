-- 다시서기 정신건강 평가관리 시스템 초기 스키마 고정본
-- 범위: identifier_sequences, users, user_approval_requests, clients, assessment_sessions,
--       session_scales, session_answers, session_alerts, activity_logs, backup_histories
-- 기준: 현재 JPA 엔티티/매핑과 일치하는 보수적 MariaDB/MySQL 문법

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
    role VARCHAR(20) NOT NULL COMMENT 'ADMIN, USER',
    status VARCHAR(20) NOT NULL COMMENT 'PENDING, ACTIVE, INACTIVE, REJECTED',
    approved_at DATETIME NULL,
    approved_by_id BIGINT NULL,
    rejected_at DATETIME NULL,
    rejected_by_id BIGINT NULL,
    rejection_reason VARCHAR(255) NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_login_id (login_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_approval_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    requested_name VARCHAR(50) NOT NULL,
    requested_login_id VARCHAR(50) NOT NULL,
    requested_phone VARCHAR(30) NULL,
    requested_position_name VARCHAR(50) NULL,
    requested_team_name VARCHAR(100) NULL,
    request_memo VARCHAR(4000) NULL,
    request_status VARCHAR(20) NOT NULL COMMENT 'PENDING, APPROVED, REJECTED',
    requested_at DATETIME NOT NULL,
    processed_at DATETIME NULL,
    processed_by BIGINT NULL,
    process_note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_user_approval_requests_status (request_status),
    KEY idx_user_approval_requests_requested_at (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
    id BIGINT NOT NULL AUTO_INCREMENT,
    client_no VARCHAR(30) NOT NULL,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL COMMENT 'MALE, FEMALE, OTHER, UNKNOWN',
    birth_date DATE NOT NULL,
    phone VARCHAR(30) NULL,
    primary_worker_id BIGINT NOT NULL,
    created_by BIGINT NOT NULL,
    misregistered_by BIGINT NULL,
    status VARCHAR(20) NOT NULL COMMENT 'ACTIVE, INACTIVE, MISREGISTERED',
    misregistered_at DATETIME NULL,
    misregistered_reason VARCHAR(255) NULL,
    registered_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_clients_client_no (client_no),
    CONSTRAINT fk_clients_primary_worker
        FOREIGN KEY (primary_worker_id) REFERENCES users (id),
    CONSTRAINT fk_clients_created_by
        FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_clients_misregistered_by
        FOREIGN KEY (misregistered_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_sessions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_no VARCHAR(30) NOT NULL,
    client_id BIGINT NOT NULL,
    session_date DATE NOT NULL,
    session_started_at DATETIME NOT NULL,
    session_completed_at DATETIME NOT NULL,
    performed_by BIGINT NOT NULL,
    misentered_by BIGINT NULL,
    scale_count INT NOT NULL,
    has_alert TINYINT(1) NOT NULL,
    memo LONGTEXT NULL,
    status VARCHAR(20) NOT NULL COMMENT 'COMPLETED, MISENTERED',
    misentered_at DATETIME NULL,
    misentered_reason VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_assessment_sessions_session_no (session_no),
    CONSTRAINT fk_assessment_sessions_client
        FOREIGN KEY (client_id) REFERENCES clients (id),
    CONSTRAINT fk_assessment_sessions_performed_by
        FOREIGN KEY (performed_by) REFERENCES users (id),
    CONSTRAINT fk_assessment_sessions_misentered_by
        FOREIGN KEY (misentered_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_scales (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    scale_code VARCHAR(30) NOT NULL COMMENT 'PHQ9, GAD7, MKPQ16, KMDQ, PSS10, ISIK, AUDITK, IESR',
    scale_name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL,
    total_score DECIMAL(10, 2) NOT NULL,
    result_level VARCHAR(100) NOT NULL,
    has_alert TINYINT(1) NOT NULL,
    raw_result_snapshot LONGTEXT NOT NULL COMMENT 'JSON snapshot stored as text',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_session_scales_session
        FOREIGN KEY (session_id) REFERENCES assessment_sessions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_answers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_scale_id BIGINT NOT NULL,
    question_no INT NOT NULL,
    question_key VARCHAR(50) NOT NULL,
    question_text_snapshot VARCHAR(255) NOT NULL,
    answer_value VARCHAR(50) NOT NULL,
    answer_label_snapshot VARCHAR(100) NOT NULL,
    score_value DECIMAL(10, 2) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_session_answers_session_scale
        FOREIGN KEY (session_scale_id) REFERENCES session_scales (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_alerts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    session_scale_id BIGINT NOT NULL,
    scale_code VARCHAR(30) NOT NULL COMMENT 'PHQ9, GAD7, MKPQ16, KMDQ, PSS10, ISIK, AUDITK, IESR',
    alert_type VARCHAR(30) NOT NULL COMMENT 'HIGH_RISK, CAUTION, CRITICAL_ITEM, COMPOSITE_RULE',
    alert_code VARCHAR(100) NOT NULL,
    alert_message VARCHAR(255) NOT NULL,
    question_no INT NULL,
    trigger_value VARCHAR(100) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_session_alerts_session
        FOREIGN KEY (session_id) REFERENCES assessment_sessions (id),
    CONSTRAINT fk_session_alerts_session_scale
        FOREIGN KEY (session_scale_id) REFERENCES session_scales (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    user_name_snapshot VARCHAR(50) NULL,
    action_type VARCHAR(50) NOT NULL COMMENT 'LOGIN, SIGNUP_REQUEST, SIGNUP_APPROVE, SIGNUP_REJECT, USER_ROLE_CHANGE, USER_STATUS_CHANGE, CLIENT_CREATE, CLIENT_UPDATE, CLIENT_MARK_MISREGISTERED, SESSION_CREATE, SESSION_MARK_MISENTERED, PRINT_SESSION, STATISTICS_EXPORT, BACKUP_RUN',
    target_type VARCHAR(50) NULL COMMENT 'USER, SIGNUP_REQUEST, CLIENT, SESSION, STATISTICS, BACKUP',
    target_id BIGINT NULL,
    target_label VARCHAR(255) NULL,
    description VARCHAR(500) NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS backup_histories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    backup_type VARCHAR(20) NOT NULL COMMENT 'AUTO, MANUAL',
    status VARCHAR(20) NOT NULL COMMENT 'SUCCESS, FAILED',
    backup_method VARCHAR(20) NOT NULL COMMENT 'DB_DUMP, SNAPSHOT',
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NULL,
    started_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    executed_by_id BIGINT NULL,
    executed_by_name_snapshot VARCHAR(50) NULL,
    failure_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
