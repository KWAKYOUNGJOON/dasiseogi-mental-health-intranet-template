# 운영 초기 관리자 부트스트랩 절차

## 1. 목적

이 문서는 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 와
[docs/20-production-input-sheet.md](./20-production-input-sheet.md) 기준 선행 확인이 모두 끝난 뒤,
실제 운영 환경에서 **초기 관리자 1건을 준비하는 부트스트랩 절차**를 정리한다.

이 문서의 범위:
- 부트스트랩 시작 가능 시점과 시작 금지 시점
- 회원가입 신청 기반 초기 관리자 준비 절차
- DB 수동 승격 SQL 템플릿 작업본 사용 방법
- 최초 로그인 / 권한 / 승인 상태 확인 절차
- 중단 조건과 비밀값 / 작업본 관리 원칙

중요:
- 이 문서는 실제 운영 성공 또는 실제 운영 반영 완료를 선언하는 문서가 아니다.
- 실제 값은 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서에서만 확인하며, 저장소 문서에 추측해서 적지 않는다.

이 문서는 아래를 다시 설명하지 않는다.
- 외부 MariaDB 생성 절차
- `backend/src/main/resources/schema.sql` 적용 상세
- 운영용 `.env` 작성 상세
- Docker Compose 기동 / health 일반 점검 절차
- 애플리케이션 코드 수정
- DB 스키마 구조 변경

위 항목은 계속 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 와
[docs/20-production-input-sheet.md](./20-production-input-sheet.md) 를 기준으로 본다.

### 1.1 문서 진행 순서

이 문서는 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 6장 health 확인이 정상으로 닫힌 뒤에 본다.

1. [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본에서 초기 관리자 login ID 보관 위치, 비밀번호 보관 위치, 승격 SQL 작업본 위치, 검수자를 다시 확인한다.
2. 4장 선행 조건과 5장 작업 순서를 확인한다.
3. 6장 회원가입 신청 -> 7장 수동 승격 -> 8장 로그인/권한 확인 순서로만 진행한다.
4. bootstrap 확인이 닫히면 다시 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 5장~8장과 [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 로 돌아가 최종 게이트와 결과 기록을 닫는다.

---

## 2. 운영 원칙

- 운영 기준 `app.seed.enabled=false` 이므로 seed 관리자 계정은 생성되지 않는다.
- 초기 관리자는 `회원가입 신청 -> DB 수동 승격 -> 최초 로그인 확인` 순서로만 준비한다.
- 초기 관리자도 직접 `INSERT` 하지 않고, 먼저 회원가입 신청으로 `users` 와 `user_approval_requests` 를 생성한다.
- 수동 승격은 최초 관리자 1건 준비를 위한 예외 절차이며, 이후 일반 운영에서는 관리자 승인 흐름을 사용한다.
- `scripts/sql/initial-admin-promote.template.sql` 원본은 직접 수정하지 않고, 복사본 작업본으로만 사용한다.
- 선행 조건 중 하나라도 비어 있거나 미확인이면 부트스트랩 단계로 넘어가지 않는다.

---

## 3. 부트스트랩 시작 시점

부트스트랩은 아래 상태가 모두 갖춰진 뒤에만 시작한다.

- 외부 MariaDB 준비, `schema.sql` 선적용, 운영용 `.env` 점검, `docker compose config` 대조가 이미 끝나 있어야 한다.
- 앱은 실제 운영 DB 를 바라보는 상태로 이미 기동되어 있어야 한다.
- backend health 가 정상 확인된 뒤에만 회원가입 신청 1건을 생성한다.

아래 상태면 아직 부트스트랩 시작 전이다.

- [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크가 남아 있다.
- `backend/src/main/resources/schema.sql` 선적용 여부가 비어 있거나 미확인이다.
- 운영용 `.env` 값 점검 또는 `docker compose config` 대조가 끝나지 않았다.
- 앱이 실제 운영 DB 가 아닌 placeholder / local / H2 가능성이 남아 있다.
- health 확인이 끝나지 않았다.

중요:
- 운영 기준 `app.seed.enabled=false` 이므로 앱이 정상 기동되어도 seed 관리자 계정은 자동 생성되지 않는다.
- 따라서 앱 기동 직후 관리자 계정이 없더라도 이상으로 보지 않고, 본 문서의 부트스트랩 절차를 따른다.

---

## 4. 부트스트랩 시작 전 선행 조건

아래 항목이 모두 완료로 확인될 때만 5단계로 넘어간다.

- [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크 완료
- 외부 MariaDB 에 `backend/src/main/resources/schema.sql` 선적용 완료
- 운영용 `.env` 값 점검 완료
- `docker compose config` 대조 완료
- 앱이 실제 운영 DB 를 바라보는 상태로 기동되어 health 가 정상 확인된 상태

확인 기준:
- `.env` 의 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 가 비어 있지 않다.
- `docker compose config` 결과의 backend 환경값이 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 일치한다.
- backend 는 `prod` 기준으로 외부 MariaDB 스키마를 `validate` 통과한 상태다.
- `/api/v1/health` 또는 동등 health 확인 결과가 정상이다.

중요:
- 위 항목 중 하나라도 비어 있거나 미확인이면 회원가입 신청, DB 수동 승격, 로그인 확인으로 넘어가지 않는다.
- `docker compose up -d` 만 된 상태이거나, backend 가 실제 운영 DB 를 본다는 근거가 없으면 부트스트랩을 시작하지 않는다.

---

## 5. 작업 순서 요약

실제 운영 초기 관리자 부트스트랩은 아래 순서로 닫는다.

1. 프론트 UI 기준으로 초기 관리자 1건의 회원가입 신청을 생성한다.
2. DB 에서 해당 사용자와 최신 가입 신청이 모두 `PENDING` 으로 생성되었는지 확인한다.
3. `scripts/sql/initial-admin-promote.template.sql` 을 복사한 작업본에만 실제 값을 넣어 수동 승격을 수행한다.
4. `/login` 로그인 성공, 관리자 메뉴 4종 노출, 일반 사용자 계정의 관리자 메뉴 미노출을 확인한다.
5. 관련 승인 상태가 DB 상에서 정합하게 맞는지 확인한 뒤에만 결과를 기록한다.

중요:
- 선행 조건이 모두 닫히기 전에는 1단계로 들어가지 않는다.
- 로그인 / 권한 / DB 정합성 확인이 끝나기 전까지는 초기 관리자 준비 완료로 보지 않는다.

---

## 6. 회원가입 신청 절차

초기 관리자도 먼저 회원가입 신청 1건을 만든다.
프론트 UI 기준을 우선으로 사용하고, UI 사용이 어렵거나 검증상 필요할 때만 API 대안을 사용한다.

이 방식을 쓰는 이유:
- 비밀번호가 애플리케이션 기준으로 저장된다.
- `users` 와 `user_approval_requests` 가 함께 생성된다.
- 수동 승격 전에도 승인 흐름 기준 데이터를 남길 수 있다.

### 6.1 UI 기준

1. 브라우저에서 `/login` 으로 이동한다.
2. `회원가입 신청` 버튼으로 `/signup` 화면에 진입한다.
3. 초기 관리자 1건에 대한 실제 신청값을 입력한다.
4. 제출 후 성공 메시지 또는 로그인 화면 복귀를 확인한다.
5. 이후 수동 승격에 사용할 `loginId` 를 정확히 메모한다.

주의:
- 실제 이름, 로그인 ID, 비밀번호, 전화번호 등은 저장소 문서에 쓰지 않는다.
- 아직 관리자 승격 전이므로 이 단계에서 로그인 성공을 기대하지 않는다.

### 6.2 API 대안

필요 시 아래 대안을 사용한다.

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

### 6.3 신청 직후 최소 확인

회원가입 신청 후 아래 상태가 모두 맞아야 다음 단계로 넘어간다.

- 응답 또는 DB 기준 `requestStatus = PENDING`
- `users.role = USER`
- `users.status = PENDING`
- 최신 `user_approval_requests.request_status = PENDING`

예시 확인 명령:

```powershell
mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p -D <PRODUCTION_DB_NAME> -e "SELECT id, login_id, role, status FROM users WHERE login_id = '<INITIAL_ADMIN_LOGIN_ID>';"

mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p -D <PRODUCTION_DB_NAME> -e "SELECT id, user_id, requested_login_id, request_status, requested_at FROM user_approval_requests WHERE requested_login_id = '<INITIAL_ADMIN_LOGIN_ID>' ORDER BY requested_at DESC, id DESC;"
```

중요:
- `users` 또는 `user_approval_requests` 상태가 위 기준과 다르면 수동 승격 단계로 넘어가지 않는다.
- `requestId` 와 `userId` 는 서로 다른 값일 수 있으므로 혼동하지 않는다.

---

## 7. 수동 승격 절차

수동 승격은 아래 원본 템플릿을 기준으로 한다.

- `scripts/sql/initial-admin-promote.template.sql`

이 템플릿은 아래 상태를 한 번에 맞춘다.

- `users.role = ADMIN`
- `users.status = ACTIVE`
- `approved_at` 갱신
- 최신 `PENDING` 상태 `user_approval_requests` 의 `request_status = APPROVED`

### 7.1 작업본 준비 원칙

1. 원본 `scripts/sql/initial-admin-promote.template.sql` 은 직접 수정하지 않는다.
2. 저장소 밖 또는 운영자 로컬 안전 작업 경로에 복사본 작업본을 만든다.
3. 복사본에서만 `LOGIN_ID_PLACEHOLDER`, `PROMOTION_NOTE_PLACEHOLDER` 를 실제 값으로 바꾼다.
4. 실제 값이 들어간 작업본은 저장소에 커밋하지 않는다.

예시:

```powershell
Copy-Item scripts\sql\initial-admin-promote.template.sql .\initial-admin-promote.sql
```

### 7.2 실행 전 확인

아래 조건이 모두 맞을 때만 SQL 을 실행한다.

- 대상 `loginId` 의 `users.status = PENDING`
- 대상 `loginId` 의 `users.role = USER`
- 최신 `user_approval_requests.request_status = PENDING`
- 실제 운영 DB 접속 정보와 대상 DB 명이 확인되었다

하나라도 다르면 바로 실행하지 말고 먼저 원인을 확인한다.

### 7.3 실행 예시

```powershell
mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p <PRODUCTION_DB_NAME> < .\initial-admin-promote.sql
```

### 7.4 실행 후 확인

```powershell
mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p -D <PRODUCTION_DB_NAME> -e "SELECT login_id, role, status, approved_at, approved_by_id FROM users WHERE login_id = '<INITIAL_ADMIN_LOGIN_ID>';"

mysql -h <PRODUCTION_DB_HOST> -P <PRODUCTION_DB_PORT> -u <PRODUCTION_DB_ADMIN_USER> -p -D <PRODUCTION_DB_NAME> -e "SELECT id, user_id, requested_login_id, request_status, processed_at, processed_by, process_note FROM user_approval_requests WHERE requested_login_id = '<INITIAL_ADMIN_LOGIN_ID>' ORDER BY requested_at DESC, id DESC;"
```

성공 기준:
- `updated_user_rows = 1`
- `updated_request_rows = 1`
- `users.role = ADMIN`
- `users.status = ACTIVE`
- 최신 `user_approval_requests.request_status = APPROVED`

정합성 확인:
- 최신 `user_approval_requests.user_id` 가 대상 `users.id` 와 맞아야 한다.
- `approved_at`, `processed_at` 는 채워져 있어야 한다.
- 최초 관리자 부트스트랩 단계에서는 템플릿 기준 `approved_by_id`, `processed_by` 가 `NULL` 일 수 있으며, 이 경우에도 위 상태가 일관되면 정상으로 본다.

주의:
- `updated_user_rows = 0` 또는 `updated_request_rows = 0` 이면 다시 눌러서 진행하지 말고 즉시 중단한다.
- 이미 `ACTIVE` 또는 `APPROVED` 상태인 계정에 반복 실행하지 않는다.

---

## 8. 로그인 / 권한 확인 절차

수동 승격 후 아래 순서로 최초 로그인과 권한 노출 여부를 확인한다.

1. 기존 세션을 정리하거나 새 시크릿 창을 사용한다.
2. `/login` 에서 초기 관리자 계정으로 로그인한다.
3. 로그인 성공 후 첫 화면이 정상 렌더되는지 확인한다.
4. 관리자 메뉴 4종이 모두 노출되는지 확인한다.
   - `승인 대기`
   - `사용자 관리`
   - `로그 확인`
   - `백업 관리`
5. 필요 시 `GET /api/v1/auth/me` 로 `role = ADMIN`, `status = ACTIVE` 를 확인한다.

추가 확인:
- 별도로 준비된 일반 사용자 계정 또는 기존 승인된 일반 사용자 계정으로 로그인해, 위 관리자 메뉴 4종이 노출되지 않는지 확인한다.
- 일반 사용자 계정 검증이 불가능하면 부트스트랩 확인을 닫지 말고 보류 상태로 남긴다.

선택형 보조 스크립트:

```powershell
scripts\admin-smoke-check.bat "http://127.0.0.1:8080" "<INITIAL_ADMIN_LOGIN_ID>" "<INITIAL_ADMIN_PASSWORD>"
```

주의:
- 이 스크립트는 운영에서 base URL, 관리자 login ID, 비밀번호를 명시적으로 넘기거나 같은 값을 `ADMIN_SMOKE_BASE_URL`, `ADMIN_SMOKE_LOGIN_ID`, `ADMIN_SMOKE_PASSWORD` 환경변수로 먼저 넣어야 한다.
- 이 스크립트는 `/api/v1/admin/backups/run` 을 호출하므로, 백업 경로와 dump 정책 또는 운영 대체 수단이 이미 정리된 뒤에만 실행한다.

DB 정합성 최종 확인:
- 대상 `users.role = ADMIN`
- 대상 `users.status = ACTIVE`
- 최신 `user_approval_requests.request_status = APPROVED`
- 대상 `requested_login_id` 와 실제 로그인 ID 가 일치한다
- 승인 관련 시각과 상태가 서로 모순되지 않는다

이 단계가 끝나야 초기 관리자 준비가 완료된 것으로 본다.

---

## 9. 중단 조건

아래 중 하나라도 해당되면 부트스트랩 단계를 즉시 중단하고,
[docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 또는
[docs/20-production-input-sheet.md](./20-production-input-sheet.md) 기준으로 되돌아가 원인을 먼저 정리한다.

- [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크가 끝나지 않았다.
- 외부 MariaDB 의 `schema.sql` 선적용이 확인되지 않았다.
- 운영용 `.env` 값이 비어 있거나 미확인 상태다.
- `docker compose config` 결과와 실제 운영 입력값 대조가 끝나지 않았다.
- 앱이 실제 운영 DB 를 바라보는지 확정되지 않았거나 health 가 비정상이다.
- 회원가입 신청 후 `users` 또는 `user_approval_requests` 상태가 `PENDING` 기준과 다르다.
- `scripts/sql/initial-admin-promote.template.sql` 원본을 직접 수정하려고 했다.
- SQL 실행 결과 `updated_user_rows` 또는 `updated_request_rows` 가 1이 아니다.
- `/login` 로그인 실패, 관리자 메뉴 4종 미노출, 일반 사용자 계정에서 관리자 메뉴 노출, DB 승인 상태 불일치 중 하나라도 발생했다.

중요:
- 선행 조건이 하나라도 비어 있거나 미확인이면 bootstrap 단계로 넘어가지 않는다.
- 원인 확인 없이 사용자 행, 승인 요청 행, 테이블을 삭제하거나 덮어쓰지 않는다.

---

## 10. 비밀값 / 작업본 관리 원칙

- 실제 운영 비밀번호, 실제 운영 계정명, 실제 운영 서버 주소는 저장소 문서와 SQL 원본에 남기지 않는다.
- 실제 값은 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본, 비밀 저장소, 내부 운영 문서에서만 관리한다.
- 루트 `.env` 작업본과 승격 SQL 복사본은 운영자 로컬 또는 승인된 내부 저장소에서만 관리한다.
- 실제 값이 들어간 `.env`, SQL 작업본, 메모 파일은 Git 추적 대상에 포함하지 않는다.
- `scripts/sql/initial-admin-promote.template.sql` 원본은 읽기 기준으로만 사용한다.
- 문서 작성자나 운영자는 실제 값을 추측해서 채우지 않고, 확보된 공식 값만 사용한다.
- 작업 후에는 실제 값이 남은 임시 파일을 별도 보관하거나 안전하게 삭제한다.

---

## 11. 실패 시 되돌아볼 확인 포인트

### 11.1 부트스트랩 시작 전

- [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크가 모두 닫혔는가
- `backend/src/main/resources/schema.sql` 선적용 검수 결과가 있는가
- `.env` 와 `docker compose config` 대조 결과가 남아 있는가
- backend 가 실제 운영 DB 기준으로 `validate` 를 통과했는가
- `app.seed.enabled=false` 인 상태에서 seed 관리자 생성을 기대하고 있지 않은가

### 11.2 회원가입 신청 생성 실패

- `/signup` 또는 `POST /api/v1/signup-requests` 로 요청했는가
- `loginId` 중복이 아닌가
- backend health 가 정상인가
- 요청 직후 `users`, `user_approval_requests` 두 테이블에 행이 생성되었는가

### 11.3 DB 수동 승격 SQL 실행 후 반영 없음

- 복사본 작업본에서만 placeholder 를 치환했는가
- 대상 `loginId` 가 실제 신청한 값과 일치하는가
- 해당 사용자의 `users.status = PENDING` 인가
- 최신 `user_approval_requests.request_status = PENDING` 인가
- 이미 한 번 승인 처리한 계정에 반복 실행한 것은 아닌가

### 11.4 로그인 또는 권한 확인 실패

- `/login` 로그인 자체가 성공하는가
- 관리자 메뉴 4종이 모두 노출되는가
- 일반 사용자 계정에서 관리자 메뉴가 숨겨지는가
- `users.role = ADMIN`, `users.status = ACTIVE` 로 반영되었는가
- 최신 `user_approval_requests.request_status = APPROVED` 와 승인 관련 시각이 정합하게 맞는가

---

## 12. 운영 반영 기록

부트스트랩을 실제로 실행했다면 결과는 기존 결과 문서에 이어서 기록한다.

- 기준 문서: [docs/14-deploy-result-template.md](./14-deploy-result-template.md)
- 기록 위치: `docs/deploy-results/YYYY-MM-DD.md`

최소 기록 항목:
- 부트스트랩 시작 전 선행 조건 확인 여부
- 회원가입 신청 생성 시각과 수행자
- 승격 SQL 작업본 사용 여부와 실행자
- `/login` 로그인 결과
- 관리자 메뉴 4종 노출 결과
- 일반 사용자 계정 관리자 메뉴 미노출 결과
- DB 승인 상태 정합성 확인 결과
- 실제 비밀값 미기록 여부

기록할 때도 아래 값은 남기지 않는다.
- 실제 비밀번호
- 실제 운영 계정명
- 실제 운영 서버 주소
