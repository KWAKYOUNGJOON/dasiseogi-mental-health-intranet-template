# 운영 최초 기동 전 부트스트랩 절차

## 1. 목적

이 문서는 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 기준 검증이 끝난 뒤,
실제 운영 서버에서 **최초 1회만** 수행해야 하는 아래 2가지 절차를 운영자 관점으로 정리한다.

- 실제 운영 DB 초기화
- 초기 관리자 계정 준비

이 문서의 범위:
- 운영 DB 생성 예시
- `backend/src/main/resources/schema.sql` 적용 절차
- 회원가입 신청 기반 초기 관리자 준비 절차
- DB 수동 승격 SQL 템플릿 사용 방법
- 최초 로그인 확인 절차
- 실패 시 확인 포인트

이 문서는 아래를 다시 설명하지 않는다.
- Docker Compose 상세 기동 명령
- `.env` 작성 방법
- healthcheck 일반 점검 절차
- 애플리케이션 코드 수정
- DB 스키마 구조 변경

위 항목은 계속 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 를 기준으로 본다.

---

## 2. 운영 원칙

- 운영 DB 스키마는 반드시 기존 `backend/src/main/resources/schema.sql` 을 그대로 사용한다.
- 중복 스키마 파일을 새로 만들지 않는다.
- 초기 관리자도 **회원가입 신청 -> 승인** 흐름을 기준으로 준비한다.
- 최초 관리자만 예외적으로 DB 수동 승격을 사용하되, 이후 운영에서는 관리자 화면 승인 흐름을 사용한다.
- 실제 비밀번호, 실제 운영 계정명, 실제 서버 주소는 저장소 문서와 SQL 원본에 남기지 않는다.
- 실제 값이 들어간 임시 SQL 파일은 운영자 로컬 작업본으로만 사용하고 실행 후 별도 보관 또는 삭제한다.
- 운영 DB 에 이미 테이블이나 실제 데이터가 있다면 본 문서를 그대로 진행하지 말고 먼저 현황을 확인한다.

---

## 3. 작업 순서 요약

실제 운영 최초 기동 전 부트스트랩은 아래 순서로 닫는다.

1. 운영 DB 생성
2. `schema.sql` 적용
3. 앱 1회 기동
4. 회원가입 신청 1건 생성
5. DB 수동 승격 SQL 실행
6. 초기 관리자 로그인 확인
7. 운영 반영 결과 기록

중요:
- `schema.sql` 적용은 앱 기동 전에 끝나 있어야 한다.
- 회원가입 신청 생성은 앱이 1회 올라와야 가능하다.
- 초기 관리자 로그인 확인이 끝나기 전까지는 운영 개시 완료로 보지 않는다.

---

## 4. 사전 준비물

- 운영 서버 또는 운영자 PC 에 저장소 작업본이 있어야 한다.
- 운영 DB 관리자 접속 권한이 있어야 한다.
- 운영 앱 접속 URL 과 브라우저 접속 권한이 있어야 한다.
- 아래 실제 값은 운영자만 별도 안전한 채널로 관리한다.
  - `<PRODUCTION_DB_HOST>`
  - `<PRODUCTION_DB_PORT>`
  - `<PRODUCTION_DB_NAME>`
  - `<PRODUCTION_DB_ADMIN_USER>`
  - `<PRODUCTION_APP_DB_USER>`
  - `<INITIAL_ADMIN_LOGIN_ID>`
  - `<INITIAL_ADMIN_PASSWORD>`

비밀값 기록 금지 원칙:
- 실제 비밀번호를 `README.md`, `docs/*.md`, `scripts/sql/*.sql` 원본에 적지 않는다.
- 실제 운영 서버 주소를 저장소 문서에 적지 않는다.
- 실제 운영 계정명도 저장소 문서에는 남기지 않는다.

---

## 5. 1단계: 운영 DB 생성

운영 DB 는 MariaDB/MySQL 기준 `utf8mb4` 로 생성한다.
앱 계정은 가능하면 DB 관리자 계정과 분리한다.

예시 SQL:

```sql
CREATE DATABASE <PRODUCTION_DB_NAME>
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER '<PRODUCTION_APP_DB_USER>'@'%' IDENTIFIED BY '<PRODUCTION_APP_DB_PASSWORD>';
GRANT SELECT, INSERT, UPDATE, DELETE ON <PRODUCTION_DB_NAME>.* TO '<PRODUCTION_APP_DB_USER>'@'%';
FLUSH PRIVILEGES;
```

운영자 확인 포인트:
- 이미 같은 이름의 DB 가 있으면 바로 덮어쓰지 않는다.
- 기존 운영 데이터가 있는 DB 라면 본 문서 범위를 벗어나므로 별도 확인 후 진행한다.
- `ddl-auto=validate` 운영 기준이므로 DB 생성만으로는 backend 기동이 완료되지 않는다.

---

## 6. 2단계: `schema.sql` 적용

스키마 적용 파일은 반드시 아래 원본을 사용한다.

- `backend/src/main/resources/schema.sql`

운영자 실행 위치:
- 저장소 루트에서 실행하는 것을 기준으로 한다.

예시 명령:

```powershell
mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p <PRODUCTION_DB_NAME> < backend/src/main/resources/schema.sql
```

적용 후 최소 확인 명령 예시:

```powershell
mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p -D <PRODUCTION_DB_NAME> -e "SHOW TABLES;"
```

적용 후 보여야 하는 핵심 테이블:
- `identifier_sequences`
- `users`
- `user_approval_requests`
- `clients`
- `assessment_sessions`
- `session_scales`
- `session_answers`
- `session_alerts`
- `activity_logs`
- `backup_histories`

운영자 확인 포인트:
- `schema.sql` 은 앱 기동 전에 1회 적용되어 있어야 한다.
- 테이블이 없거나 일부만 생성되면 backend 는 `validate` 단계에서 실패할 수 있다.
- 원본 `schema.sql` 을 복사해 별도 이름의 스키마 파일로 관리하지 않는다.

---

## 7. 3단계: 앱 1회 기동

앱 기동 명령 자체는 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 를 그대로 따른다.
이 단계의 목적은 **회원가입 신청 1건 생성** 이 가능하도록 운영 앱을 1회 올리는 것이다.

운영자 확인 포인트:
- backend health 가 `UP` 이어야 한다.
- frontend 접속이 가능해야 한다.
- 로그인 전 `GET /api/v1/auth/me` 는 `401` 이어야 한다.

---

## 8. 4단계: 회원가입 신청 기반 초기 관리자 생성

초기 관리자도 직접 `INSERT` 하지 않고, 먼저 회원가입 신청을 1건 만든다.

이 방식을 쓰는 이유:
- 비밀번호가 애플리케이션 기준 BCrypt 로 저장된다.
- `users` 와 `user_approval_requests` 가 함께 생성된다.
- 이후 운영에서도 같은 승인 흐름을 유지할 수 있다.

실행 방법은 둘 중 하나를 사용한다.

### 8.1 UI 기준

1. 로그인 화면으로 이동한다.
2. `회원가입 신청` 버튼으로 `/signup` 화면에 진입한다.
3. 초기 관리자 1건을 신청한다.
4. 성공 메시지 또는 로그인 화면 복귀를 확인한다.

### 8.2 API 기준

```http
POST /api/v1/signup-requests
Content-Type: application/json

{
  "name": "INITIAL_ADMIN_NAME_PLACEHOLDER",
  "loginId": "INITIAL_ADMIN_LOGIN_ID_PLACEHOLDER",
  "password": "INITIAL_ADMIN_PASSWORD_PLACEHOLDER",
  "phone": "INITIAL_ADMIN_PHONE_PLACEHOLDER",
  "positionName": "INITIAL_ADMIN_POSITION_PLACEHOLDER",
  "teamName": "INITIAL_ADMIN_TEAM_PLACEHOLDER",
  "requestMemo": "초기 운영 관리자 생성"
}
```

성공 기준:
- 응답 `requestStatus` 가 `PENDING`
- `users.status = PENDING`
- `users.role = USER`
- `user_approval_requests.request_status = PENDING`

주의:
- `requestId` 와 `userId` 는 서로 다른 값이다.
- 이 단계에서는 아직 로그인되지 않아야 정상이다.

---

## 9. 5단계: DB 수동 승격 SQL 실행

초기 관리자 수동 승격 템플릿은 아래 파일을 사용한다.

- `scripts/sql/initial-admin-promote.template.sql`

이 템플릿은 아래를 한 번에 맞춘다.
- `users.role = ADMIN`
- `users.status = ACTIVE`
- `approved_at`, `approved_by_id` 정리
- 최신 `PENDING` 상태 `user_approval_requests` 를 `APPROVED` 로 변경

### 9.1 사용 방법

1. 템플릿을 가능하면 저장소 밖의 로컬 작업본으로 복사한다.
2. `LOGIN_ID_PLACEHOLDER`, `PROMOTION_NOTE_PLACEHOLDER` 를 실제 값으로 바꾼다.
3. 실제 값이 들어간 파일은 저장소에 커밋하지 않는다.
4. 운영 DB 에 실행한다.

예시 명령:

```powershell
Copy-Item scripts\sql\initial-admin-promote.template.sql .\initial-admin-promote.sql
mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p <PRODUCTION_DB_NAME> < .\initial-admin-promote.sql
```

### 9.2 실행 후 확인 예시

```powershell
mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p -D <PRODUCTION_DB_NAME> -e "SELECT login_id, role, status, approved_at FROM users WHERE login_id = '<INITIAL_ADMIN_LOGIN_ID>';"

mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p -D <PRODUCTION_DB_NAME> -e "SELECT id, requested_login_id, request_status, processed_at FROM user_approval_requests WHERE requested_login_id = '<INITIAL_ADMIN_LOGIN_ID>' ORDER BY requested_at DESC, id DESC;"
```

성공 기준:
- `users.role = ADMIN`
- `users.status = ACTIVE`
- 최신 가입 신청 1건의 `request_status = APPROVED`
- `processed_by`, `approved_by_id` 는 최초 관리자 준비 단계에서는 `NULL` 이어도 정상이다.

주의:
- SQL 실행 결과에서 `updated_user_rows = 0` 또는 `updated_request_rows = 0` 이면 바로 다시 실행하지 말고 원인을 먼저 확인한다.
- 이미 `ACTIVE` 또는 `APPROVED` 상태인 계정에 반복 실행하지 않는다.

---

## 10. 6단계: 최초 로그인 확인

초기 관리자 승격 후 아래 순서로 로그인 확인을 수행한다.

1. 브라우저에서 기존 세션이 있으면 로그아웃하거나 새 시크릿 창을 사용한다.
2. `/login` 에서 초기 관리자 계정으로 로그인한다.
3. 로그인 성공 후 첫 화면이 정상 표시되는지 확인한다.
4. 관리자 전용 메뉴가 노출되는지 확인한다.
   - `승인 대기`
   - `사용자 관리`
   - `로그 확인`
   - `백업 관리`
5. 필요하면 브라우저 개발자도구 또는 API 클라이언트로 `GET /api/v1/auth/me` 를 확인한다.

기대 결과:
- 로그인 성공
- `GET /api/v1/auth/me` 응답이 `200`
- 응답의 `role = ADMIN`
- 응답의 `status = ACTIVE`

이 단계가 끝나야 초기 관리자 준비가 완료된 것이다.

---

## 11. 실패 시 되돌아볼 확인 포인트

### 11.1 `schema.sql` 적용 실패 또는 backend 기동 실패

- DB 이름이 실제 운영 DB 와 일치하는가
- `backend/src/main/resources/schema.sql` 원본을 사용했는가
- DB 계정에 테이블 생성/적용 권한이 있는가
- `SHOW TABLES;` 결과에 핵심 테이블이 모두 생성되었는가
- backend 로그에 schema validation 오류가 남아 있는가

### 11.2 회원가입 신청 생성 실패

- `/signup` 또는 `POST /api/v1/signup-requests` 로 요청했는가
- `loginId` 중복이 아닌가
- backend health 가 `UP` 인가
- 요청 직후 `users`, `user_approval_requests` 두 테이블에 행이 생성되었는가

### 11.3 DB 수동 승격 SQL 실행 후 0건 반영

- `LOGIN_ID_PLACEHOLDER` 를 실제 신청한 `loginId` 로 바꿨는가
- 해당 사용자의 현재 `users.status` 가 `PENDING` 인가
- 해당 사용자의 최신 `user_approval_requests.request_status` 가 `PENDING` 인가
- 이미 한 번 승인 처리한 계정에 다시 실행한 것은 아닌가

### 11.4 로그인 실패 또는 관리자 메뉴 미노출

- `users.role = ADMIN`, `users.status = ACTIVE` 로 반영되었는가
- 최신 `user_approval_requests.request_status = APPROVED` 로 반영되었는가
- 회원가입 신청 때 입력한 비밀번호로 로그인했는가
- 이전 비로그인 세션 또는 일반 사용자 세션이 남아 있지 않은가

중요:
- 원인 확인 없이 기존 테이블이나 사용자 행을 삭제하지 않는다.
- 실제 운영 DB 에서 수동 수정이 있었다면 결과를 배포 기록 문서에 남긴다.

---

## 12. 운영 반영 기록

부트스트랩 완료 후 결과는 기존 결과 문서에 이어서 기록한다.

- 기준 문서: [docs/14-deploy-result-template.md](./14-deploy-result-template.md)
- 기록 위치: `docs/deploy-results/YYYY-MM-DD.md`

최소 기록 항목:
- 운영 DB 생성 여부
- `schema.sql` 적용 시각과 수행자
- 초기 관리자 1건 준비 완료 여부
- 최초 로그인 확인 결과
- 실제 비밀값 미기록 여부

기록할 때도 아래 값은 남기지 않는다.
- 실제 비밀번호
- 실제 운영 계정명
- 실제 운영 서버 주소
