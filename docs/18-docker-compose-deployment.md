# Docker Compose 운영 배포 마무리 체크

## 1. 목적

이 문서는 현재 저장소의 `docker-compose.yml`, `.env.docker.example`, `backend/src/main/resources/application-prod.yml` 기준으로,
처음 설치하는 운영자가 외부 MariaDB 를 준비하고 Docker Compose 로 운영 기동하는 절차를 닫기 위한 체크 문서다.

이 문서의 범위:
- 외부 MariaDB 준비
- 운영용 `.env` 준비
- `docker compose up -d`
- 상태 확인
- 재시작 / 재부팅 후 재기동 확인
- 기본 장애 대응
- 배포 결과 기록

이 문서는 아래를 직접 다루지 않는다.
- 프론트 UI 변경
- 인증 정책 변경
- 도메인 모델 변경
- DB 스키마 구조 변경

---

## 2. 현재 Docker 운영 전제

- backend 컨테이너는 `prod` profile 을 사용한다.
- 운영 기준 `spring.jpa.hibernate.ddl-auto=validate` 이다.
- 운영 기준 `app.seed.enabled=false` 이다.
- 따라서 **운영 DB 가 빈 상태이면 backend 기동이 실패한다.**
- 운영 DB 는 backend 앱이 `prod` profile 로 1회라도 기동되기 전에 반드시 `backend/src/main/resources/schema.sql` 이 적용되어 있어야 한다.
- 초기 관리자 계정도 운영 시작 전에 별도 준비되어야 한다.
- `.env` 값 변경 후 `docker compose restart` 만으로는 새 환경값이 반영되지 않는다. 값 변경 후에는 `docker compose up -d --force-recreate` 를 사용한다.

### 2.1 배포 전 선행 확인

실제 운영 반영은 아래 preflight 게이트가 모두 닫힌 뒤에만 시작한다.

- [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 의 최종 확인 체크가 먼저 끝나 있어야 한다.
- `docs/20-production-input-sheet.md` 에는 실제 운영 DB 정보, `.env` 작성 위치와 관리 방식, `schema.sql` 적용 수단/실행 위치/담당자/검수자, 초기 관리자 준비 담당자가 먼저 정리되어 있어야 한다.
- `backend/src/main/resources/schema.sql` 은 backend 컨테이너가 `prod` 로 1회라도 기동되기 전에 외부 MariaDB 에 먼저 적용되어 있어야 한다.
- 루트 `.env` 의 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 는 모두 비어 있지 않아야 한다.
- `docker compose config` 결과의 backend 환경값을 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 대조해, backend 가 실제 운영 DB 를 가리키는지 먼저 확인해야 한다.
- `APP_DB_URL_DOCKER` 가 비어 있거나, placeholder, `jdbc:h2:` 류 값, 또는 실제 운영 외부 MariaDB JDBC URL 로 확정되지 않은 값이면 진행하지 않는다.

주의:
- 현재 backend Docker entrypoint 는 Docker DB 환경값이 비어 있거나 placeholder 상태면 local H2 profile 로 fallback 할 수 있다.
- 따라서 `APP_DB_URL_DOCKER` 를 포함한 DB 환경값 검증 전에 `docker compose up -d` 를 먼저 실행하지 않는다.
- 위 preflight 항목 중 하나라도 실패하면 실제 운영 반영 단계로 넘어가지 않는다.

---

## 3. 운영용 `.env` 값 목록

루트 `.env` 는 `.env.docker.example` 을 복사해 만든다.

```powershell
Copy-Item .env.docker.example .env
```

### 3.1 필수값

- `APP_DB_URL_DOCKER`
  - 컨테이너 내부에서 접근할 외부 MariaDB JDBC URL 이다.
  - 예: `jdbc:mariadb://host.docker.internal:3306/mental_health_prod?useUnicode=true&characterEncoding=utf8`
  - `docker compose config` 결과와 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본을 대조해 실제 운영 DB host/port/name 기준이 일치해야 한다.
  - 비어 있거나, placeholder 문자열이 포함되거나, `jdbc:h2:` 류 값이거나, 실제 운영 외부 MariaDB JDBC URL 로 확정되지 않았으면 진행하지 않는다.
- `APP_DB_USERNAME`
  - 운영 앱 전용 DB 계정이다.
  - `docker compose config` 결과에서 비어 있거나 placeholder 상태면 진행하지 않는다.
- `APP_DB_PASSWORD`
  - 운영 앱 전용 DB 계정 비밀번호다.
  - `docker compose config` 결과에서 비어 있거나 placeholder 상태면 진행하지 않는다.
- `APP_DB_DRIVER`
  - 운영 DB JDBC 드라이버다.
  - 운영 MariaDB 기준 기본 예시는 `org.mariadb.jdbc.Driver` 다.
  - `docker compose config` 결과에서 비어 있으면 진행하지 않는다.

### 3.2 운영 정책에 따라 조정할 값

- `APP_SESSION_TIMEOUT`
  - 세션 기반 인증 유지 시간이다.
- `APP_FORWARD_HEADERS_STRATEGY`
  - reverse proxy 뒤에서만 실제 운영값으로 조정한다.
- `APP_TRUST_PROXY_HEADERS`
  - 신뢰 가능한 내부 reverse proxy 뒤면 `true`, 아니면 `false` 다.
- `APP_DB_DUMP_COMMAND`
  - 컨테이너 내부 DB dump 바이너리 절대 경로다.
  - 현재 공식 backend Docker 이미지에는 `mariadb-dump` / `mysqldump` 가 기본 포함되지 않으므로, 운영 DB dump 는 DB 서버 또는 운영 호스트에서 별도 수행하거나 파생 이미지로 보완한다.

### 3.3 호스트 경로값

- `BACKEND_LOGS_HOST_PATH`
  - 기본값 `./logs`
  - backend 파일 로그가 남는 호스트 경로다.
- `BACKEND_TMP_HOST_PATH`
  - 기본값 `./tmp`
  - CSV export 임시 파일이 남는 호스트 경로다.
- `BACKEND_BACKUPS_HOST_PATH`
  - 기본값 `./local-backups`
  - backend 가 파일 기반 백업 산출물을 남길 호스트 경로다.

### 3.4 기동 전 실제 반영값 확인

```powershell
docker compose config
```

대조 기준:
- backend 환경값의 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 가 모두 채워져 있어야 한다.
- backend 환경값의 `APP_DB_URL_DOCKER` 가 실제 운영 외부 MariaDB JDBC URL 이어야 한다.
- `docker compose config` 결과의 backend 환경값이 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 일치해야 한다.
- 비어 있는 값, placeholder, `jdbc:h2:` 류 값, 또는 의도하지 않은 테스트/로컬 DB 주소가 보이면 실제 운영 반영으로 넘어가지 않는다.

중단 조건:
- [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크가 끝나지 않았다.
- `schema.sql` 선적용 또는 적용 확인이 끝나지 않았다.
- `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 중 하나라도 비어 있다.
- `APP_DB_URL_DOCKER` 가 placeholder 이거나 `jdbc:h2:` 류 값이거나 실제 운영 DB 로 대조되지 않았다.
- `docker compose config` 결과의 backend 환경값이 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 다르다.
- 로그 / 임시 / 백업 host path 가 의도와 다르다.

위 항목 중 하나라도 해당되면 preflight 실패로 보고 실제 운영 반영 단계로 넘어가지 않는다.

---

## 4. 외부 MariaDB 준비 절차

운영 DB 는 `utf8mb4` 기준으로 생성한다.
앱 계정은 root 대신 별도 계정을 사용한다.

예시:

```sql
CREATE DATABASE mental_health_prod
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'mental_app'@'%' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON mental_health_prod.* TO 'mental_app'@'%';
FLUSH PRIVILEGES;
```

주의:
- `ddl-auto=validate` 이므로 DB 생성만으로는 충분하지 않다.
- DB 생성 후 반드시 `backend/src/main/resources/schema.sql` 을 적용해야 한다.
- `schema.sql` 적용은 backend 앱의 `prod` 1회 기동 전에 끝나 있어야 한다.
- `schema.sql` 적용 또는 적용 검수 결과가 없으면 `docker compose up -d` 단계로 넘어가지 않는다.

예시 명령:

```powershell
mysql -h DB_HOST -P 3306 -u root -p -e "CREATE DATABASE mental_health_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h DB_HOST -P 3306 -u root -p mental_health_prod < backend/src/main/resources/schema.sql
```

적용 후 확인:
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

---

## 5. 초기 관리자 계정 준비 절차

운영 기준 `app.seed.enabled=false` 이므로 seed 관리자 계정은 생성되지 않는다.
초기 관리자 계정은 아래 순서로 준비한다.

권장 절차:
1. Docker Compose 로 앱을 먼저 기동한다.
2. 프론트 `회원가입 신청` 또는 `POST /api/v1/signup-requests` 로 초기 운영자 1건을 생성한다.
3. DB 에서 해당 사용자를 `ACTIVE + ADMIN` 으로 수동 승격한다.
4. 같은 사용자의 최신 `user_approval_requests` 행도 `APPROVED` 로 맞춘다.
5. 해당 계정으로 로그인해 관리자 메뉴 접근을 확인한다.

이 절차를 권장하는 이유:
- 회원가입 신청 경로가 비밀번호를 BCrypt 로 저장하므로, 운영자가 별도 hash 생성 도구를 준비하지 않아도 된다.
- 운영 문서의 `1인 1계정`, `가입 신청 후 관리자 승인`, `권한 분리` 원칙을 깨지 않고 최초 관리자만 최소 수동 승격으로 닫을 수 있다.

회원가입 신청 예시:

```http
POST /api/v1/signup-requests
Content-Type: application/json

{
  "loginId": "admin_bootstrap",
  "password": "CHANGE_ME_STRONG_PASSWORD",
  "name": "초기관리자",
  "phone": "010-0000-0000",
  "positionName": "사회복지사",
  "teamName": "정신건강팀",
  "requestMemo": "초기 운영 관리자 생성"
}
```

수동 승격 예시:

```sql
START TRANSACTION;

UPDATE users
SET role = 'ADMIN',
    status = 'ACTIVE',
    approved_at = NOW(),
    approved_by_id = NULL,
    rejected_at = NULL,
    rejected_by_id = NULL,
    rejection_reason = NULL,
    updated_at = NOW()
WHERE login_id = 'admin_bootstrap';

UPDATE user_approval_requests
SET request_status = 'APPROVED',
    processed_at = NOW(),
    processed_by = NULL,
    process_note = '초기 운영 관리자 수동 승인',
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE login_id = 'admin_bootstrap')
  AND request_status = 'PENDING';

COMMIT;
```

확인 기준:
- `/login` 에서 초기 관리자 로그인 성공
- 관리자 메뉴 `승인 대기`, `사용자 관리`, `로그 확인`, `백업 관리` 노출
- 일반 사용자 계정에서는 관리자 메뉴 미노출

---

## 6. Docker Compose 최초 기동 절차

실제 운영 반영은 2.1 과 3.4 의 중단 조건이 모두 해소된 뒤에만 진행한다.

1. [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크 완료
2. 외부 MariaDB 에 `backend/src/main/resources/schema.sql` 선적용 완료
3. 루트 `.env` 생성
4. `.env` 값 입력
5. `docker compose config` 로 backend 실제 반영값 대조
6. 컨테이너 기동

```powershell
docker compose up -d
docker compose ps
```

7. 기동 직후 health 확인

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8080/api/v1/health | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri http://127.0.0.1:4173/api/v1/health | ConvertTo-Json -Depth 10
```

기대값:
- `backend` 가 `healthy`
- `frontend` 가 `Up`
- 두 health 응답 모두 `status=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP`, `loadedScaleCount=8`

---

## 7. 로그 / 임시파일 / 백업 경로 설명

Docker Compose 기본 매핑 기준:

```text
호스트 ./logs           -> 컨테이너 /data/logs
호스트 ./tmp            -> 컨테이너 /data/tmp
호스트 ./local-backups  -> 컨테이너 /data/backups
```

운영자 기준 의미:
- `BACKEND_LOGS_HOST_PATH`
  - backend 파일 로그 저장 위치다.
- `BACKEND_TMP_HOST_PATH`
  - `tmp/exports` 아래 CSV export 임시 파일이 생성된다.
- `BACKEND_BACKUPS_HOST_PATH`
  - 백업 파일이 남는 위치다.

운영 전 확인:
- 세 경로를 미리 생성한다.
- Docker 데몬이 쓰기 가능한 경로인지 확인한다.
- 로그와 백업 경로는 같은 폴더로 쓰지 않는다.

---

## 8. Docker 재시작 정책과 재부팅 후 재기동 점검

현재 `docker-compose.yml` 은 backend / frontend 모두 `restart: unless-stopped` 기준이다.

판단:
- 운영 서버 또는 Docker daemon 재기동 시 자동으로 다시 올라와야 하므로, 운영 배포에서는 restart policy 를 두는 편이 맞다.
- `unless-stopped` 는 운영자가 명시적으로 멈춘 경우를 제외하고 자동 재기동을 기대할 수 있어 현재 목적에 적합하다.

주의:
- `docker compose restart` 는 기존 컨테이너를 다시 시작할 뿐, `.env` 변경을 다시 읽지 않는다.
- `.env`, image, volume 설정을 바꾼 뒤에는 아래처럼 재생성한다.

```powershell
docker compose up -d --force-recreate
```

서버 재부팅 후 점검 순서:
1. Docker daemon 이 올라왔는지 확인한다.
2. `docker compose ps` 로 backend / frontend 상태를 확인한다.
3. `http://127.0.0.1:8080/api/v1/health`
4. `http://127.0.0.1:4173/api/v1/health`
5. `/login` 접속 후 인증 전후 흐름을 다시 확인한다.

---

## 9. Healthcheck 및 smoke test 절차

운영자 최소 점검 명령:

```powershell
docker compose ps
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
Invoke-RestMethod -Uri http://127.0.0.1:8080/api/v1/health | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri http://127.0.0.1:4173/api/v1/health | ConvertTo-Json -Depth 10
```

Docker 재시작 확인:

```powershell
docker compose restart
docker compose ps
```

주의:
- `docker compose restart` 는 backend / frontend 를 동시에 다시 시작하므로, backend 가 아직 `healthy` 가 아니면 `http://127.0.0.1:4173/api/v1/health` 가 잠깐 `502 Bad Gateway` 를 반환할 수 있다.
- 이 경우 frontend 자체 장애로 바로 판단하지 말고 backend 가 `healthy` 로 바뀐 뒤 같은 URL 을 다시 확인한다.

배포 후 smoke test 최소 범위:
1. `health` endpoint 확인
   - HTTP `200`, `status=UP`, `appStatus=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP`, `loadedScaleCount` 가 기대 척도 수와 일치하는지 확인한다.
2. 관리자 로그인 확인
   - bootstrap 또는 기존 운영 관리자 계정으로 로그인 성공을 확인한다.
3. 관리자 메뉴 접근 확인 / 일반 사용자 계정 관리자 메뉴 미노출 확인
   - 관리자 메뉴 접근이 가능하고 일반 사용자 계정에서는 관리자 메뉴가 노출되지 않는지 확인한다.
4. 대상자 생성 확인
   - 신규 대상자 생성 성공, `clientNo` 생성, 상세 화면 또는 응답 정상 여부를 확인한다.
5. 최소 2종 세션 저장 확인
   - 예: `PHQ-9 + GAD-7` 조합 등 최소 2종 척도 세션 저장 성공과 `sessionNo` 생성을 확인한다.
6. 세션 상세 확인
   - 방금 저장한 세션 상세 화면이 정상 열리고 총점, 판정, 경고, 문항 응답 표시가 정상인지 확인한다.
7. `print view` 확인
   - 같은 세션의 `print view` 가 정상 표시되고 인쇄 화면까지 확인되며 세션 메모는 포함되지 않는지 확인한다.
8. `statistics` 확인
   - `statistics/summary`, `statistics/scales`, `statistics/alerts` 가 모두 정상 응답하고 최신 저장 데이터가 집계에 반영되는지 확인한다.
9. `CSV export` 확인
   - 관리자 계정 기준 다운로드 성공, 빈 파일 아님, 인코딩 또는 컬럼 깨짐 없음을 확인한다.
10. 활동 로그 확인
   - 로그인, 대상자 생성, 세션 저장, `print view`, export, 백업 등 주요 행위가 최신순으로 남는지 확인한다.
11. 수동 백업 확인
   - 운영에서 사용하기로 한 수동 백업 절차 1회 확인, 백업 이력과 실제 산출물 또는 운영 승인 대체 수단이 일치하는지 확인한다.

보조 인증 점검:
- `/login` 접속 후 로그인 전 `/api/v1/auth/me` 가 `401` 인지 확인한다.
- 로그인 후 `/api/v1/auth/me` 가 사용자 정보를 반환하는지 확인한다.

---

## 10. 장애 시 1차 확인 명령

운영자 1차 확인 순서:

```powershell
docker compose ps
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
docker compose exec backend /bin/sh -lc "printenv | sort | grep '^APP_'"
Invoke-RestMethod -Uri http://127.0.0.1:8080/api/v1/health | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri http://127.0.0.1:4173/api/v1/health | ConvertTo-Json -Depth 10
```

확인 포인트:
- backend 가 `healthy` 인가
- frontend 가 `Up` 인가
- backend 로그에 datasource / scale registry / schema validation 오류가 있는가
- 현재 컨테이너에 주입된 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_TRUST_PROXY_HEADERS` 값이 의도와 일치하는가
- `.env` 를 바꾼 뒤 단순 `restart` 만 한 상태는 아닌가

---

## 11. 배포 결과 기록 방법

Docker 운영 배포 결과는 [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 를 기준으로
`docs/deploy-results/YYYY-MM-DD.md` 파일에 남긴다.

반드시 기록할 항목:
- `docker compose config` 실행 여부와 핵심 환경값 확인 결과
- 외부 MariaDB DB 생성 / `schema.sql` 적용 여부
- 초기 관리자 계정 준비 방식과 확인 결과
- `docker compose up -d`, `docker compose ps`, `docker compose restart` 결과
- backend / frontend health endpoint 결과
- 재부팅 후 재기동 확인 여부
- 미해결 운영 준비물

비밀값 기록 원칙:
- 실제 DB 비밀번호는 문서에 쓰지 않는다.
- DB host, DB 명, 담당자, 확인 시각, 결과만 남긴다.
