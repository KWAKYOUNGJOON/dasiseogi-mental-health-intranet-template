# 다시서기 정신건강 평가관리 시스템 DB 구조 설계

## 1. 문서 목적

본 문서는 `00-project-overview.md`와 `01-screen-structure.md`를 기준으로, 다시서기 정신건강 평가관리 시스템의 데이터베이스 구조를 실제 개발 가능한 수준으로 정의한 설계 문서이다.

이 문서는 다음 목적을 가진다.

- 화면 및 기능 요구사항을 데이터 구조로 변환한다.
- 대상자, 검사 세션, 척도 결과, 사용자, 권한, 로그, 백업 등 핵심 도메인의 저장 구조를 확정한다.
- 프론트엔드 화면 설계와 API 명세의 기준이 되는 공통 데이터 모델을 제공한다.
- 삭제 대신 오입력 처리, 작성자/관리자 수정 권한, 세션 단위 저장 등 프로젝트의 핵심 운영 정책을 데이터 구조에 반영한다.

---

## 2. DB 설계 원칙

### 2.1 기본 설계 원칙
- 대상자 기본정보와 검사기록은 분리한다.
- 검사 결과 저장의 최상위 단위는 **세션(session)** 으로 한다.
- 한 세션 안에는 여러 척도 결과가 포함될 수 있다.
- 검사기록 목록 조회는 실무 편의를 위해 **척도 결과 단위**로도 가능해야 한다.
- 척도 문항 및 채점 규칙은 초기 버전에서 DB가 아니라 별도 정의 파일(`04-scale-json.md` 기반)로 관리한다.
- DB에는 실제 수행 당시의 결과를 보존하기 위한 **결과 스냅샷**을 저장한다.

### 2.2 운영 정책 반영 원칙
- 삭제 기능은 제공하지 않고, 주요 업무 데이터는 상태값으로 관리한다.
- 오입력 처리는 **세션 전체 단위**로 수행한다.
- 저장된 검사기록은 직접 수정하지 않고, 오입력 처리 후 새 세션으로 재입력한다.
- 잘못 등록된 대상자는 삭제하지 않고 **비활성/오등록 상태**로 전환한다.
- 세션 참고 메모는 저장 후 수정하지 않는다.
- 수정 가능한 주요 엔터티는 대상자 기본정보 중심으로 제한한다.

### 2.3 권한 및 추적 원칙
- 모든 주요 업무 데이터는 생성자, 생성시각, 수정자, 수정시각을 추적 가능하게 설계한다.
- 작성자와 관리자 권한 판단에 필요한 소유 정보(created_by)를 저장한다.
- 오입력 처리 시 처리자, 처리시각, 처리사유를 남긴다.
- 로그는 조회성 데이터와 별도로 저장한다.

### 2.4 확장성 원칙
- 척도 추가를 고려해 척도 종류는 코드값 기반으로 저장한다.
- 향후 척도 정의를 DB로 이전할 수 있도록 결과 구조를 정규화하되, 초기 버전은 과도한 메타 테이블을 두지 않는다.
- 출력, 통계, 엑셀 내보내기, 경고 기록 조회에 필요한 필드를 미리 반영한다.

---

## 3. 전체 엔터티 구성

본 시스템의 핵심 엔터티와 현재 persistence unit validate 에 필요한 기술 보조 테이블은 아래와 같다.

### 3.1 사용자/권한 영역
- `users` : 시스템 사용자 계정
- `user_approval_requests` : 회원가입 신청 및 승인 이력

### 3.2 대상자 영역
- `clients` : 대상자 기본정보

### 3.3 검사 수행 영역
- `assessment_sessions` : 검사 세션 마스터
- `session_scales` : 세션 내 척도 결과 요약
- `session_answers` : 세션 내 문항별 응답
- `session_alerts` : 경고/주의 기록

### 3.4 운영 영역
- `activity_logs` : 주요 기능 사용 로그
- `backup_histories` : 백업 실행 이력

### 3.5 기술 보조 영역
- `identifier_sequences` : 대상자 번호(`client_no`), 세션 번호(`session_no`) 생성에 사용하는 기술 보조 테이블

`identifier_sequences` 는 핵심 업무 도메인 테이블은 아니다.  
다만 현재 식별자/번호 생성 구조와 `schema.sql` 기반 validate 검증 기준상 초기 스키마에 함께 포함한다.

### 3.6 선택적 공통 코드 영역
- `common_codes` : 상태값, 역할값 등 공통 코드 관리가 필요할 경우 사용

초기 버전은 코드 테이블을 최소화하고, 역할/상태/척도명은 애플리케이션 enum과 DB CHECK 제약 또는 VARCHAR 코드로 관리하는 방식을 우선 추천한다.

---

## 4. 엔터티 관계 요약

### 4.1 핵심 관계
- 한 명의 사용자(`users`)는 여러 명의 대상자(`clients`)를 등록할 수 있다.
- 한 명의 대상자(`clients`)는 여러 개의 검사 세션(`assessment_sessions`)을 가질 수 있다.
- 한 개의 검사 세션(`assessment_sessions`)은 여러 개의 척도 결과(`session_scales`)를 가질 수 있다.
- 한 개의 척도 결과(`session_scales`)는 여러 개의 문항 응답(`session_answers`)을 가진다.
- 한 개의 세션(`assessment_sessions`)은 여러 개의 경고 기록(`session_alerts`)을 가질 수 있다.
- 한 명의 사용자(`users`)는 여러 개의 로그(`activity_logs`)와 백업 이력(`backup_histories`)을 생성할 수 있다.

### 4.2 관계 구조 개념
- `users 1 : N clients`
- `users 1 : N assessment_sessions`
- `clients 1 : N assessment_sessions`
- `assessment_sessions 1 : N session_scales`
- `session_scales 1 : N session_answers`
- `assessment_sessions 1 : N session_alerts`

---

## 5. 테이블 상세 설계

## 5.1 users

### 목적
시스템 로그인 사용자와 권한을 관리한다.

### 주요 컬럼
- `id` BIGINT PK
- `login_id` VARCHAR(50) UNIQUE NOT NULL
- `password_hash` VARCHAR(255) NOT NULL
- `name` VARCHAR(50) NOT NULL
- `phone` VARCHAR(30) NULL
- `position_name` VARCHAR(50) NULL
- `team_name` VARCHAR(100) NULL
- `role` VARCHAR(20) NOT NULL
  - `ADMIN`
  - `USER`
- `status` VARCHAR(20) NOT NULL
  - `PENDING`
  - `ACTIVE`
  - `INACTIVE`
  - `REJECTED`
- `last_login_at` DATETIME NULL
- `approved_at` DATETIME NULL
- `approved_by` BIGINT NULL FK -> `users.id`
- `rejected_at` DATETIME NULL
- `rejected_by` BIGINT NULL FK -> `users.id`
- `rejection_reason` VARCHAR(255) NULL
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

### 제약/정책
- `login_id`는 중복 불가
- 승인 완료 전(`PENDING`) 로그인 불가
- 관리자 계정은 2명 이상 존재 가능
- 사용자 비활성화 시 기존 작성 데이터는 유지

### 인덱스
- UNIQUE INDEX `uk_users_login_id` (`login_id`)
- INDEX `idx_users_status` (`status`)
- INDEX `idx_users_role` (`role`)

---

## 5.2 user_approval_requests

### 목적
회원가입 신청 당시 입력값과 승인/반려 처리 이력을 분리 저장한다.

### 필요성
`users` 테이블만으로도 운영은 가능하지만, 신청 원문과 처리 이력을 보존하려면 별도 테이블이 유리하다.

### 주요 컬럼
- `id` BIGINT PK
- `user_id` BIGINT NULL FK -> `users.id`
- `requested_name` VARCHAR(50) NOT NULL
- `requested_login_id` VARCHAR(50) NOT NULL
- `requested_phone` VARCHAR(30) NULL
- `requested_position_name` VARCHAR(50) NULL
- `requested_team_name` VARCHAR(100) NULL
- `request_memo` TEXT NULL
- `request_status` VARCHAR(20) NOT NULL
  - `PENDING`
  - `APPROVED`
  - `REJECTED`
- `requested_at` DATETIME NOT NULL
- `processed_at` DATETIME NULL
- `processed_by` BIGINT NULL FK -> `users.id`
- `process_note` VARCHAR(255) NULL
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

### 인덱스
- INDEX `idx_user_approval_requests_status` (`request_status`)
- INDEX `idx_user_approval_requests_requested_at` (`requested_at`)

---

## 5.3 clients

### 목적
대상자 기본정보를 관리한다.

### 주요 컬럼
- `id` BIGINT PK
- `client_no` VARCHAR(30) UNIQUE NOT NULL
- `name` VARCHAR(50) NOT NULL
- `gender` VARCHAR(10) NOT NULL
  - `MALE`
  - `FEMALE`
  - `OTHER`
  - `UNKNOWN`
- `birth_date` DATE NOT NULL
- `phone` VARCHAR(30) NULL
- `primary_worker_id` BIGINT NOT NULL FK -> `users.id`
- `status` VARCHAR(20) NOT NULL
  - `ACTIVE`
  - `INACTIVE`
  - `MISREGISTERED`
- `misregistered_at` DATETIME NULL
- `misregistered_by` BIGINT NULL FK -> `users.id`
- `misregistered_reason` VARCHAR(255) NULL
- `registered_at` DATETIME NOT NULL
- `created_by` BIGINT NOT NULL FK -> `users.id`
- `updated_by` BIGINT NULL FK -> `users.id`
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

### 제약/정책
- `client_no`는 저장 시 자동 생성한다.
- 동일 `name + birth_date` 조합은 **중복 허용**한다.
- 단, 등록 시 중복 경고를 위해 검색 인덱스를 둔다.
- 대상자 삭제는 허용하지 않는다.
- 잘못 등록된 대상자는 `MISREGISTERED` 상태로 전환한다.

### 인덱스
- UNIQUE INDEX `uk_clients_client_no` (`client_no`)
- INDEX `idx_clients_name_birth_date` (`name`, `birth_date`)
- INDEX `idx_clients_primary_worker_id` (`primary_worker_id`)
- INDEX `idx_clients_status` (`status`)
- INDEX `idx_clients_recent` (`created_at`)

---

## 5.4 assessment_sessions

### 목적
한 번의 검사 수행 묶음을 세션 단위로 저장한다.

### 의미
사용자가 한 대상자에게 여러 척도를 선택하여 순차 입력한 결과의 상위 묶음이다.

### 주요 컬럼
- `id` BIGINT PK
- `session_no` VARCHAR(30) UNIQUE NOT NULL
- `client_id` BIGINT NOT NULL FK -> `clients.id`
- `session_date` DATE NOT NULL
- `session_started_at` DATETIME NOT NULL
- `session_completed_at` DATETIME NOT NULL
- `performed_by` BIGINT NOT NULL FK -> `users.id`
- `scale_count` INT NOT NULL DEFAULT 0
- `has_alert` BOOLEAN NOT NULL DEFAULT FALSE
- `memo` TEXT NULL
- `status` VARCHAR(20) NOT NULL
  - `COMPLETED`
  - `MISENTERED`
- `misentered_at` DATETIME NULL
- `misentered_by` BIGINT NULL FK -> `users.id`
- `misentered_reason` VARCHAR(255) NULL
- `created_by` BIGINT NOT NULL FK -> `users.id`
- `updated_by` BIGINT NULL FK -> `users.id`
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

### 제약/정책
- 오입력 처리는 세션 전체 단위로만 수행한다.
- 같은 대상자에게 같은 날 여러 세션 저장 가능하다.
- 세션은 생성 시각 기준으로 서로 다른 기록으로 취급한다.
- 세션 참고 메모는 저장 후 수정하지 않는 것을 기본 정책으로 한다.
- 세션 직접 수정은 허용하지 않는다.

### 파생 컬럼 설명
- `session_date` : 통계/필터 조회용
- `scale_count` : 목록 및 통계 최적화용
- `has_alert` : 경고 기록 존재 여부 캐시

### 인덱스
- UNIQUE INDEX `uk_assessment_sessions_session_no` (`session_no`)
- INDEX `idx_assessment_sessions_client_id` (`client_id`)
- INDEX `idx_assessment_sessions_performed_by` (`performed_by`)
- INDEX `idx_assessment_sessions_session_date` (`session_date`)
- INDEX `idx_assessment_sessions_status` (`status`)
- INDEX `idx_assessment_sessions_client_date` (`client_id`, `session_completed_at` DESC)

---

## 5.5 session_scales

### 목적
세션에 포함된 척도별 결과 요약을 저장한다.

### 주요 컬럼
- `id` BIGINT PK
- `session_id` BIGINT NOT NULL FK -> `assessment_sessions.id`
- `scale_code` VARCHAR(30) NOT NULL
  - `PHQ9`
  - `GAD7`
  - `MKPQ16`
  - `KMDQ`
  - `PSS10`
  - `ISIK`
  - `AUDITK`
  - `IESR`
- `scale_name` VARCHAR(100) NOT NULL
- `display_order` INT NOT NULL
- `total_score` DECIMAL(10,2) NOT NULL
- `result_level` VARCHAR(100) NOT NULL
- `has_alert` BOOLEAN NOT NULL DEFAULT FALSE
- `is_completed` BOOLEAN NOT NULL DEFAULT TRUE
- `raw_result_snapshot` JSON NOT NULL
- `created_at` DATETIME NOT NULL
- `updated_at` DATETIME NOT NULL

### `raw_result_snapshot` 예시 내용
- 척도 버전
- 판정 구간명
- 총점 계산 근거
- 역채점 적용 여부
- 복합 판정 결과
- 화면 표시용 보조 정보

### 제약/정책
- 한 세션 안에서 같은 척도는 한 번만 저장한다.
- 척도 정의 원본은 코드/파일에서 관리하고, DB에는 실행 결과 스냅샷을 저장한다.
- 통계 및 검사기록 목록은 이 테이블을 중심으로 조회한다.

### 인덱스
- UNIQUE INDEX `uk_session_scales_session_id_scale_code` (`session_id`, `scale_code`)
- INDEX `idx_session_scales_scale_code` (`scale_code`)
- INDEX `idx_session_scales_has_alert` (`has_alert`)
- INDEX `idx_session_scales_total_score` (`total_score`)

---

## 5.6 session_answers

### 목적
척도의 문항별 응답값을 저장한다.

### 주요 컬럼
- `id` BIGINT PK
- `session_scale_id` BIGINT NOT NULL FK -> `session_scales.id`
- `session_id` BIGINT NOT NULL FK -> `assessment_sessions.id`
- `scale_code` VARCHAR(30) NOT NULL
- `question_no` INT NOT NULL
- `question_key` VARCHAR(50) NOT NULL
- `question_text_snapshot` TEXT NOT NULL
- `answer_value` VARCHAR(50) NOT NULL
- `answer_label_snapshot` VARCHAR(100) NOT NULL
- `score_value` DECIMAL(10,2) NOT NULL
- `is_reverse_scored` BOOLEAN NOT NULL DEFAULT FALSE
- `created_at` DATETIME NOT NULL

### 제약/정책
- 문항 텍스트와 응답 라벨은 시행 당시 기준으로 스냅샷 저장한다.
- 추후 척도 문구가 바뀌더라도 기존 결과 재현이 가능해야 한다.
- 한 척도 결과 안에서 `question_no`는 중복될 수 없다.

### 인덱스
- UNIQUE INDEX `uk_session_answers_scale_question` (`session_scale_id`, `question_no`)
- INDEX `idx_session_answers_session_id` (`session_id`)
- INDEX `idx_session_answers_scale_code` (`scale_code`)

---

## 5.7 session_alerts

### 목적
고위험/주의 응답 및 경고 판정 결과를 별도로 저장한다.

### 주요 컬럼
- `id` BIGINT PK
- `session_id` BIGINT NOT NULL FK -> `assessment_sessions.id`
- `session_scale_id` BIGINT NULL FK -> `session_scales.id`
- `client_id` BIGINT NOT NULL FK -> `clients.id`
- `scale_code` VARCHAR(30) NOT NULL
- `alert_type` VARCHAR(50) NOT NULL
  - `HIGH_RISK`
  - `CAUTION`
  - `CRITICAL_ITEM`
  - `COMPOSITE_RULE`
- `alert_code` VARCHAR(100) NOT NULL
- `alert_message` VARCHAR(255) NOT NULL
- `question_no` INT NULL
- `trigger_value` VARCHAR(100) NULL
- `created_at` DATETIME NOT NULL

### 활용 목적
- 경고 기록 모아보기 화면
- 통계 화면의 경고 발생 건수 집계
- 세션 상세 경고 영역 표시

### 인덱스
- INDEX `idx_session_alerts_session_id` (`session_id`)
- INDEX `idx_session_alerts_client_id` (`client_id`)
- INDEX `idx_session_alerts_scale_code` (`scale_code`)
- INDEX `idx_session_alerts_alert_type` (`alert_type`)
- INDEX `idx_session_alerts_created_at` (`created_at`)

---

## 5.8 activity_logs

### 목적
주요 기능 사용 이력을 관리한다.

### 주요 컬럼
- `id` BIGINT PK
- `user_id` BIGINT NULL FK -> `users.id`
- `user_name_snapshot` VARCHAR(50) NULL
- `action_type` VARCHAR(50) NOT NULL
  - `LOGIN`
  - `SIGNUP_REQUEST`
  - `SIGNUP_APPROVE`
  - `SIGNUP_REJECT`
  - `USER_ROLE_CHANGE`
  - `USER_STATUS_CHANGE`
  - `CLIENT_CREATE`
  - `CLIENT_UPDATE`
  - `CLIENT_MARK_MISREGISTERED`
  - `SESSION_CREATE`
  - `SESSION_MARK_MISENTERED`
  - `PRINT_SESSION`
  - `STATISTICS_EXPORT`
  - `BACKUP_RUN`
- `target_type` VARCHAR(50) NULL
  - `USER`
  - `SIGNUP_REQUEST`
  - `CLIENT`
  - `SESSION`
  - `STATISTICS`
  - `BACKUP`
- `target_id` BIGINT NULL
- `target_label` VARCHAR(255) NULL
- `description` VARCHAR(500) NULL
- `ip_address` VARCHAR(45) NULL
- `created_at` DATETIME NOT NULL

### 제약/정책
- 로그는 수정/삭제하지 않는다.
- 화면 조회 성능을 위해 요약 텍스트를 함께 저장할 수 있다.
- 통계 내보내기, 사용자 역할/상태 변경 같은 관리자 행위도 운영 추적 대상에 포함하는 것을 권장한다.

### 인덱스
- INDEX `idx_activity_logs_user_id` (`user_id`)
- INDEX `idx_activity_logs_action_type` (`action_type`)
- INDEX `idx_activity_logs_target_type_target_id` (`target_type`, `target_id`)
- INDEX `idx_activity_logs_created_at` (`created_at`)

---

## 5.9 backup_histories

### 목적
자동/수동 백업 실행 이력과 결과를 저장한다.

### 주요 컬럼
- `id` BIGINT PK
- `backup_type` VARCHAR(20) NOT NULL
  - `AUTO`
  - `MANUAL`
- `status` VARCHAR(20) NOT NULL
  - `SUCCESS`
  - `FAILED`
- `backup_method` VARCHAR(20) NOT NULL
  - `DB_DUMP`
  - `SNAPSHOT`
- `file_name` VARCHAR(255) NOT NULL
- `file_path` VARCHAR(500) NOT NULL
- `file_size_bytes` BIGINT NULL
- `started_at` DATETIME NOT NULL
- `completed_at` DATETIME NULL
- `executed_by_id` BIGINT NULL
- `executed_by_name_snapshot` VARCHAR(50) NULL
- `failure_reason` VARCHAR(500) NULL
- `created_at` DATETIME NOT NULL

### 설계 메모
- 현재 `backup_histories` 는 `BackupHistory` persistence 모델 기준으로 `backup_type`, `status`, `backup_method` 와 파일 메타데이터, 실행 시각, 실행자 스냅샷, 실패 사유를 저장한다.
- 백업 목록 응답의 `executedByName` 은 `executed_by_name_snapshot` 값을 사용한다.
- 수동 백업 실행 응답의 `datasourceType`, `preflightSummary` 는 `ManualBackupRunResponse` 전용 값이며, 현재 이 테이블 컬럼으로 저장하지 않는다.

### 인덱스
- 현재 `schema.sql` 기준으로 PK 외 별도 보조 인덱스는 두지 않는다.
- 현재 백업 목록 조회는 `backup_type`, `status`, `started_at` 조건과 `started_at DESC`, `id DESC` 정렬을 사용한다.

---

## 5.10 identifier_sequences

### 목적
업무 도메인 테이블이 사용하는 외부 노출 번호 생성 흐름을 지원하는 기술 보조 테이블이다.

### 사용 위치
- 대상자 번호 자동 생성
- 세션 번호 자동 생성

### 주요 컬럼
- `id` BIGINT PK
- `sequence_type` VARCHAR(30) NOT NULL
- `created_at` DATETIME NOT NULL

### 설계 메모
- 이 테이블은 대상자, 세션, 척도 결과처럼 직접 조회하는 핵심 업무 엔터티는 아니다.
- 하지만 현재 식별자 생성 컴포넌트가 persistence unit 에 포함되어 있으므로, `schema.sql` 과 MariaDB validate 기준에서는 함께 관리한다.

---

## 6. 권장 컬럼 공통 규칙

### 6.1 PK 타입
- 초기 버전은 모든 주요 테이블 PK를 `BIGINT` auto increment로 통일하는 것을 추천한다.
- 외부 노출용 식별자는 별도 번호 컬럼(`client_no`, `session_no`)로 관리한다.

### 6.2 시간 컬럼
- DB 저장은 `DATETIME` 기준으로 통일한다.
- 서버와 DB의 시간대는 기관 운영 환경 기준으로 일관되게 설정한다.
- `created_at`, `updated_at`는 대부분의 테이블에 기본 포함한다.

### 6.3 작성자/수정자 컬럼
- 주요 업무 테이블에는 `created_by`, `updated_by`를 둔다.
- 권한 판단에서 “작성자” 기준이 필요한 테이블은 반드시 `created_by`가 있어야 한다.

### 6.4 상태값 관리
- 삭제 플래그보다 명시적 상태값(`ACTIVE`, `MISENTERED` 등)을 우선 사용한다.
- 조회 기본값은 정상 상태만 노출하고, 작성자/관리자에게만 예외 상태 포함 조회를 허용한다.

---

## 7. 테이블 간 정책 매핑

## 7.1 대상자 관련 정책 반영
- 이름 + 생년월일 검색: `clients.name`, `clients.birth_date`
- 사례번호 자동 생성: `clients.client_no`
- 팀 전체 열람: 별도 제한 컬럼 없이 조회 권한으로 통제
- 작성자/관리자만 수정: `clients.created_by`와 사용자 역할 기준으로 처리
- 잘못 등록된 대상자 숨김: `clients.status = MISREGISTERED`

## 7.2 검사 세션 관련 정책 반영
- 세션 단위 저장: `assessment_sessions`
- 세션 내 여러 척도 저장: `session_scales`
- 문항별 응답 저장: `session_answers`
- 경고 별도 저장: `session_alerts`
- 세션 오입력 처리: `assessment_sessions.status = MISENTERED`
- 세션 메모 저장 후 수정 불가: `assessment_sessions.memo`

## 7.3 검사기록 목록 정책 반영
- 목록 단위는 척도별 기록: `session_scales`
- 그러나 상세 진입은 세션 전체: `session_scales.session_id -> assessment_sessions.id`
- 클릭한 척도 강조는 프론트엔드에서 `session_scale_id` 기반 처리

## 7.4 통계 정책 반영
- 이번 주 전체 검사 건수: `assessment_sessions`
- 척도별 시행 건수: `session_scales`
- 담당자별 검사 건수: `assessment_sessions.performed_by`
- 경고 발생 건수: `session_alerts`
- 경고 기록 목록: `session_alerts` + `clients` + `assessment_sessions`

---

## 8. 조회 성능을 고려한 권장 인덱스 전략

### 8.1 대상자 검색
- `clients(name, birth_date)` 복합 인덱스
- 이름 단독 검색 빈도가 높으면 `name` 단일 인덱스 추가 검토 가능

### 8.2 대상자 상세 최근 세션 조회
- `assessment_sessions(client_id, session_completed_at DESC)`

### 8.3 검사기록 목록 조회
- `assessment_sessions(session_date, performed_by, status)`
- `session_scales(scale_code, has_alert)`
- 필요 시 조인 최적화를 위한 `session_scales(session_id)` 기본 인덱스 포함

### 8.4 통계 화면 조회
- `assessment_sessions(session_date)`
- `session_scales(scale_code)`
- `session_alerts(created_at, alert_type)`

### 8.5 관리자 로그 조회
- `activity_logs(created_at)`
- `activity_logs(user_id, created_at)`
- `activity_logs(action_type, created_at)`

---

## 9. 권장 정규화 수준

### 9.1 초기 버전 권장안
초기 버전은 **과도한 메타 정규화보다 실사용 안정성**을 우선한다.

따라서 아래 방향을 추천한다.

- 사용자, 대상자, 세션, 척도결과, 문항응답은 정규화한다.
- 척도 정의 원본은 DB가 아니라 파일/코드에서 관리한다.
- 문항 문구, 응답 라벨, 판정 결과는 결과 스냅샷으로 저장한다.
- 통계/목록 성능을 위해 일부 요약 컬럼(`has_alert`, `scale_count`)은 중복 저장한다.

### 9.2 추후 확장 시 분리 가능한 테이블
향후 운영 요구가 커지면 아래 테이블 분리를 검토할 수 있다.

- `scale_definitions`
- `scale_questions`
- `scale_answer_options`
- `scale_scoring_rules`
- `code_groups` / `code_details`

초기 버전에서는 아직 필요하지 않다.

---

## 10. 추천 ENUM / 코드값 정의

### 10.1 사용자 역할
- `ADMIN`
- `USER`

### 10.2 사용자 상태
- `PENDING`
- `ACTIVE`
- `INACTIVE`
- `REJECTED`

### 10.3 대상자 상태
- `ACTIVE`
- `INACTIVE`
- `MISREGISTERED`

### 10.4 세션 상태
- `COMPLETED`
- `MISENTERED`

### 10.5 백업 유형
- `AUTO`
- `MANUAL`

### 10.6 백업 상태
- `SUCCESS`
- `FAILED`

### 10.7 백업 방식
- `DB_DUMP`
- `SNAPSHOT`

### 10.8 경고 유형
- `HIGH_RISK`
- `CAUTION`
- `CRITICAL_ITEM`
- `COMPOSITE_RULE`

---

## 11. 권장 DDL 작성 순서

실제 DB 생성 시에는 아래 순서를 권장한다.

1. `identifier_sequences`
2. `users`
3. `user_approval_requests`
4. `clients`
5. `assessment_sessions`
6. `session_scales`
7. `session_answers`
8. `session_alerts`
9. `activity_logs`
10. `backup_histories`

이 순서를 따르면 FK 의존성 충돌을 줄일 수 있다.

---

## 12. API / 화면과의 연결 기준

### 12.1 대상자 목록 화면
주 조회 테이블
- `clients`

표시 컬럼
- 이름
- 생년월일
- 성별
- 사례번호
- 담당자
- 최근 검사일

추가 설명
- 최근 검사일은 `assessment_sessions`의 MAX 값으로 계산하거나, 성능상 필요 시 집계 캐시를 추후 도입할 수 있다.

### 12.2 대상자 상세 화면
주 조회 테이블
- `clients`
- `assessment_sessions`
- `session_scales`

추가 설명
- 최근 10건 세션 목록은 `assessment_sessions` 기준 조회
- 세션 요약 표시를 위해 `scale_count`, `has_alert` 사용

### 12.3 검사기록 목록 화면
주 조회 테이블
- `session_scales`
- `assessment_sessions`
- `clients`
- `users`

추가 설명
- 목록 1행은 척도 결과 1건
- 상세 이동은 `session_id` 기준

### 12.4 세션 상세 화면
주 조회 테이블
- `assessment_sessions`
- `session_scales`
- `session_answers`
- `session_alerts`
- `clients`

### 12.5 통계 화면
주 조회 테이블
- `assessment_sessions`
- `session_scales`
- `session_alerts`
- `users`

### 12.6 관리자 화면
- 회원가입 승인: `user_approval_requests`, `users`
- 사용자 관리: `users`
- 로그 확인: `activity_logs`
- 백업 관리: `backup_histories`

---

## 13. 초안 기준 최종 권장 사항

### 13.1 현재 버전에서 확정하는 구조
- 오입력은 세션 전체 단위로 처리한다.
- 대상자는 삭제하지 않고 상태값으로 숨긴다.
- 척도 정의 및 채점 규칙은 DB가 아니라 파일/코드로 관리한다.
- DB에는 결과 재현을 위한 스냅샷만 저장한다.
- 세션 메모는 저장 후 수정하지 않는다.

### 13.2 구현 시 주의사항
- 세션 저장은 마스터(`assessment_sessions`)와 하위 결과(`session_scales`, `session_answers`, `session_alerts`)를 하나의 트랜잭션으로 저장해야 한다.
- 오입력 처리 시 하위 결과를 삭제하지 말고, 상위 세션 상태 변경을 기준으로 일반 조회에서 제외한다.
- 통계 쿼리에서는 반드시 오입력 세션 제외 조건을 기본값으로 둔다.
- 대상자 검색과 검사기록 목록 조회는 실제 사용 빈도가 높으므로 인덱스를 우선 적용한다.

---

## 14. 다음 단계 연계

본 문서 다음 단계에서는 아래 내용을 이어서 작성한다.

1. `03-api-spec.md`
   - 대상자 등록/조회/수정 API
   - 세션 저장 API
   - 검사기록 목록 조회 API
   - 통계 조회 API
   - 관리자 기능 API

2. `04-scale-json.md`
   - 척도 코드
   - 문항 정의
   - 응답 옵션
   - 점수 계산 규칙
   - 역채점 규칙
   - 판정 규칙
   - 경고 조건

---

## 15. 결정사항 요약

- 대상자와 검사기록은 분리 저장한다.
- 검사 저장의 최상위 단위는 세션이다.
- 한 세션은 여러 척도 결과를 가진다.
- 오입력 처리는 세션 전체 단위로 한다.
- 대상자는 삭제하지 않고 상태값으로 숨긴다.
- 척도 정의는 DB가 아니라 파일/코드로 관리한다.
- DB에는 실행 당시 결과 스냅샷을 저장한다.
- 세션 참고 메모는 저장 후 수정하지 않는다.
- 검사기록 목록은 척도 결과 단위로 조회한다.
- 세션 상세는 세션 전체 단위로 조회한다.
- 경고 기록은 별도 테이블로 관리한다.
- 로그와 백업 이력은 운영 테이블로 분리한다.
- `identifier_sequences` 는 현재 번호 생성 구조를 위한 기술 보조 테이블로 함께 관리한다.
