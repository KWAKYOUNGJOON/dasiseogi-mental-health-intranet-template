# 다시서기 정신건강 평가관리 시스템

기관 내부망에서 운영하는 정신건강 척도 자동 채점 및 기록 관리 시스템입니다.

현재 저장소는 설계 문서 기반에서 **1단계 최소 구현 scaffold**까지 진행된 상태입니다.
이번 단계에서 실제로 닫은 흐름은 아래입니다.

`로그인 → 대상자 목록 → 대상자 등록 → 대상자 상세 → 검사 시작 → 척도 선택 → 다중 척도 입력 → 세션 저장 → 세션 상세`

## 현재 구현 범위
- `backend/`: Spring Boot 3.5, Java 21, Gradle 기반 최소 API 서버
- `frontend/`: React + TypeScript + Vite 기반 최소 업무 UI
- 세션 기반 로그인
- 대상자 목록 / 등록 / 상세
- 척도 레지스트리 + 9종 척도 JSON 리소스 로딩
- 다중 척도 서버 재계산 기반 세션 저장
- 세션 상세 조회
- 세션 출력용 `print-data` API + 인쇄 화면
- 대상자 오등록 처리 / 세션 오입력 처리
- 검사기록 목록 최소 화면
- statistics CSV export
- `/api/v1/health` 헬스 엔드포인트 + `scripts/health-check.bat`
- 관리자 승인 대기 / 사용자 관리 / 활동 로그 / 백업 관리 최소 화면
- `user_approval_requests` 기반 가입 신청 원문/처리 이력 분리 저장
- 활동 로그 적재 + IP 주소 저장
- 수동 백업 이력 저장 + 환경별 `DB_DUMP` / `SNAPSHOT` 실행
- local profile 실행
- seed 계정 / seed 대상자 자동 생성

## 구조 원칙
- 척도 정의 원본은 `backend/src/main/resources/scales` 기준입니다.
- 프론트에는 척도 정의 복사본을 두지 않습니다.
- 현재 실제 저장 가능한 척도는 `PHQ-9`, `GAD-7`, `mKPQ-16`, `K-MDQ`, `PSS-10`, `ISI-K`, `AUDIT-K`, `IES-R`, `정신과적 위기 분류 평정척도 (CRI)` 9종입니다.
- 세션 저장은 단일 트랜잭션으로 처리합니다.
- 삭제 API는 만들지 않고 상태값 방식으로 확장하도록 설계했습니다.
- `clientNo`, `sessionNo` 는 `count()+1` 이 아니라 별도 식별번호 시퀀스 테이블 기반으로 생성합니다.

## 디렉터리
```text
.
├── backend/
├── frontend/
├── docs/
├── scripts/
└── local-backups/
```

## Docker Quick Start

외부 MariaDB를 기준으로 Docker를 빠르게 실행하는 절차입니다.
운영 투입 전 상세 절차는 `docs/18-docker-compose-deployment.md` 를 기준으로 본다.

운영 Docker 첫 설치 전제:
1. 외부 MariaDB 에 `backend/src/main/resources/schema.sql` 을 먼저 적용한다.
2. 초기 관리자 bootstrap 담당자, 승격 SQL 작업본 위치, 검수 방법을 [docs/20-production-input-sheet.md](./docs/20-production-input-sheet.md) 복사본에 먼저 정리한다.
3. 루트 `.env` 를 만든 뒤 `docker compose config` 로 값이 실제로 풀렸는지 확인한다.
4. 실제 초기 관리자 계정 준비는 앱 health 정상 후 [docs/19-production-bootstrap.md](./docs/19-production-bootstrap.md) 절차로 진행한다.

```powershell
Copy-Item .env.docker.example .env
```

루트 `.env` 에 아래 값을 직접 입력한다. `.env` 는 커밋하지 않는다.

```dotenv
APP_DB_URL_DOCKER=jdbc:mariadb://host.docker.internal:3306/DB_NAME_PLACEHOLDER?useUnicode=true&characterEncoding=utf8
APP_DB_USERNAME=DB_USERNAME_PLACEHOLDER
APP_DB_PASSWORD=DB_PASSWORD_PLACEHOLDER
APP_DB_DRIVER=org.mariadb.jdbc.Driver
APP_SESSION_TIMEOUT=120m
APP_FORWARD_HEADERS_STRATEGY=none
APP_TRUST_PROXY_HEADERS=false
BACKEND_LOGS_HOST_PATH=./logs
BACKEND_TMP_HOST_PATH=./tmp
BACKEND_BACKUPS_HOST_PATH=./local-backups
```

- `APP_DB_URL_DOCKER` 는 컨테이너에서 호스트 DB에 접속할 때 참고하는 예시다.
- `host.docker.internal` 은 컨테이너에서 호스트 머신의 DB 주소를 참조하기 위한 이름이다.
- `BACKEND_LOGS_HOST_PATH`, `BACKEND_TMP_HOST_PATH`, `BACKEND_BACKUPS_HOST_PATH` 는 호스트에서 로그/임시 export/백업 파일이 남는 위치다.
- 현재 공식 backend Docker 이미지에는 `mariadb-dump` 가 기본 포함되지 않으므로, DB dump 는 DB 서버 또는 운영 호스트에서 별도 수행하거나 파생 이미지로 보완한다.

```powershell
docker compose config
docker compose up -d
docker compose ps
```

확인 URL:
- `http://127.0.0.1:8080/api/v1/health`
- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/api/v1/health`

주의:
- `.env` 값을 바꾼 뒤에는 `docker compose restart` 가 아니라 `docker compose up -d --force-recreate` 로 다시 반영한다.
- 현재 `docker-compose.yml` 은 `restart: unless-stopped` 기준이므로, Docker daemon 또는 서버 재부팅 뒤 자동 재기동을 기대할 수 있다.

### 선택형 local DB Compose 경로

외부 MariaDB 경로는 그대로 두고, local MariaDB 를 같은 Compose 프로젝트에 함께 붙여 검증하려면 override 파일을 추가한다.

필요하면 `.env.docker.local-db.example` 값을 루트 `.env` 에 추가한다. 값을 따로 추가하지 않으면 local DB 기본값이 사용된다.

```powershell
docker compose -f docker-compose.yml -f docker-compose.local-db.yml config
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d
docker compose -f docker-compose.yml -f docker-compose.local-db.yml ps
```

- 이 경로에서는 backend 가 `db` 서비스명으로 local MariaDB 에 연결된다.
- local DB 데이터는 Compose volume `local_db_data` 에 유지된다.
- local DB override 는 backend 를 `local` profile 로 기동한다.
- empty volume 기준 최초 기동 시에는 `backend/src/main/resources/schema.sql` 이 `db` 컨테이너의 init 스크립트로 적용된다.
- `local_db_data` volume 이 이미 존재하면 init 스크립트는 다시 실행되지 않는다.
- empty volume 기준 최초 기동 시에는 `app.seed.enabled=true` 도 함께 적용되어 seed 계정과 기본 대상자가 자동 생성된다.
- 기존 `local_db_data` volume 에 이미 데이터가 있으면 seed 는 다시 넣지 않는다. 계정이 비어 있는 오래된 volume 을 다시 쓰는 경우에는 `docker compose -f docker-compose.yml -f docker-compose.local-db.yml down -v` 후 재기동하거나, 별도로 사용자 데이터를 복구해야 한다.
- 기존 standalone `mental-health-local-db` 컨테이너의 데이터나 설정을 자동 이전하지 않는다.
- local DB 서비스는 기본적으로 host port 를 publish 하지 않으므로, 기존 standalone DB 와의 host port 충돌을 자동으로 맞추거나 해소하지 않는다.

기본 경로 종료:

```powershell
docker compose down
```

local DB override 경로 종료:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down
```

DB 초기화가 필요할 때만:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down -v
```

## 로컬 실행

### 1. 백엔드
기본 실행:

```powershell
cd backend
.\gradlew.bat bootRun
```

`local` 프로필 실행:

```powershell
cd backend
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

현재 `application-local.yml` 은 아래 우선순위로 동작합니다.

1. `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 환경변수가 있으면 해당 DB 사용
2. 없으면 H2 파일 DB로 fallback

즉, MariaDB/MySQL 기준으로 바로 바꿀 수 있으면서도, 설정이 없으면 로컬에서 바로 켜집니다.

주의:
- H2 fallback은 로컬 편의용입니다.
- 설계 기준 DB는 MariaDB/MySQL 이므로, 문자열 정렬/시간 처리/DDL 차이 때문에 H2 통과만으로 운영 정합성을 보장하지 않습니다.
- 핵심 저장/조회 흐름은 가능하면 MariaDB 환경에서도 한 번 더 검증해야 합니다.

예시:

```powershell
$env:APP_DB_URL='jdbc:mariadb://localhost:3306/mental_health_local'
$env:APP_DB_USERNAME='mental_user'
$env:APP_DB_PASSWORD='mental_pass'
$env:APP_DB_DRIVER='org.mariadb.jdbc.Driver'
cd backend
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

### 2. 프론트

```powershell
cd frontend
npm install
npm run dev
```

Vite dev server는 `http://127.0.0.1:5173` 에서 실행되고, `/api` 요청은 `http://localhost:8080` 으로 프록시됩니다.

## seed 데이터

앱 기동 시 `app.seed.enabled=true` 이면 아래 데이터가 자동 생성됩니다.

### 계정
- `admina / Test1234!`
- `usera / Test1234!`
- `userb / Test1234!`
- `pendinguser / Test1234!`
- `inactiveuser / Test1234!`
- `rejecteduser / Test1234!`

### 대상자
- 정상 대상자 2명
- `MISREGISTERED` 대상자 1명

## 빌드 확인

백엔드 테스트:

```powershell
cd backend
.\gradlew.bat test
```

MariaDB/MySQL 호환성 검증은 기본 `test` 에서 분리되어 있습니다.
Testcontainers 기반 선택 실행:

```powershell
cd backend
.\gradlew.bat mariaDbTest
```

현재 `mariaDbTest` 에서는 아래 조회 경로를 실제 MariaDB 컨테이너 기준으로 검증합니다.
- `assessment-records` projection / filter / pageable
- `statistics/summary`
- `statistics/scales`
- `statistics/alerts`

주의:
- Docker가 실행 중이어야 실제 컨테이너 검증이 수행됩니다.
- Docker가 없는 환경에서는 `MariaDbCompatibilityTest` 가 자동 skip 됩니다.
- 기본 `test` 는 H2 기반 빠른 회귀만 수행하므로 일상 개발 속도를 유지합니다.
- `mariaDbTest` 는 SQL dialect, 집계, pageable, enum/날짜 처리 차이를 실제 운영 DB 계열에서 다시 확인하는 용도입니다.
- H2와 MariaDB 테스트를 분리 유지하는 이유는, 빠른 로컬 회귀와 실제 운영 DB 호환성 검증을 동시에 만족시키기 위해서입니다.

프론트 프로덕션 빌드:

```powershell
cd frontend
npm run build
```

## 수동 백업 범위

현재 관리자 수동/자동 백업은 환경별 내부 확보 방식은 유지하되, 산출물은 모두 표준 전체 백업 ZIP v1 하나로 통일됩니다.

- MariaDB/MySQL
  - 실행 전 datasource 종류, 백업 경로 writable 여부, dump command 사용 가능 여부를 preflight로 확인합니다.
  - `mariadb-dump` 또는 `mysqldump` 사용 가능하면 ZIP 내부에 `db/database.sql` 을 포함합니다.
  - dump 명령을 찾지 못하면 DB 파일 없는 snapshot 기반 ZIP으로 fallback 합니다.
- H2 / 기타 로컬 환경
  - 실행 전 backup root writable 여부를 확인합니다.
  - DB 파일 없는 snapshot 기반 ZIP을 생성합니다.

표준 ZIP 기본 구조:
- `manifest.json`
- `db/database.sql` (MariaDB/MySQL + dump 가능 시에만)
- `config/application.yml`
- `config/application-prod.yml`
- `scales/**/*.json`
- `metadata/summary.json`

현재 미포함 항목:
- restore 자동화
- 업로드 파일/첨부파일
- 외부 스토리지 데이터

백업 파일은 기본적으로 `local-backups/` 아래에 생성됩니다.

복구 개요:
- `DB_DUMP`: ZIP 내부 `db/database.sql` 이 포함된 표준 전체 백업 ZIP입니다.
- `SNAPSHOT`: DB 파일 없이 설정/척도 JSON/메타데이터를 담은 표준 전체 백업 ZIP입니다.

## 운영 템플릿

- 운영 설정 템플릿: `backend/src/main/resources/application-prod.yml`
- 백엔드 배포 초안: `scripts/deploy-backend.bat`
- 프론트 배포 초안: `scripts/deploy-frontend.bat`
- 수동 백업 실행 초안: `scripts/run-backup.bat`
- 기본 헬스체크 초안: `scripts/health-check.bat`
- 관리자 스모크 체크 초안: `scripts/admin-smoke-check.bat`

권장 순서:
1. [docs/20-production-input-sheet.md](./docs/20-production-input-sheet.md) 복사본에 운영 입력값, 담당자, 반영 위치, 검증 수단, 중단 지점을 먼저 채웁니다.
2. `application-prod.yml` 또는 동등한 외부 설정 파일에 운영 값을 채웁니다.
   - `APP_TRUST_PROXY_HEADERS=true` 는 신뢰 가능한 리버스 프록시 뒤에서만 켭니다.
3. `scripts/deploy-backend.bat` 로 배포 대상 backend jar 를 운영 경로에 배치합니다.
4. `scripts/deploy-frontend.bat` 로 빌드된 frontend `dist` 를 운영 경로에 배치합니다.
5. 배포 직전 `scripts/run-backup.bat` 로 수동 백업을 실행합니다.
6. 배포 직후 `scripts/health-check.bat` 또는 `GET /api/v1/health` 로 앱/DB/scale registry 상태를 확인합니다.
7. `scripts/admin-smoke-check.bat` 를 운영에서 쓸 때는 base URL, 관리자 login ID, 비밀번호를 명시적으로 넘기고, 이 스크립트가 `/api/v1/admin/backups/run` 을 호출한다는 점을 먼저 확인합니다.

## 운영 하드닝 메모

- 관리자 승인/반려 API 경로 변수는 항상 `requestId` 기준입니다.
- `userId` 를 `/api/v1/admin/signup-requests/{requestId}/approve|reject` 에 보내면 `SIGNUP_REQUEST_ID_REQUIRED` 로 실패합니다.
- 활동 로그 IP는 기본적으로 `remoteAddr` 를 사용합니다.
- `X-Forwarded-For`, `X-Real-IP` 신뢰는 `app.security.trust-proxy-headers=true` 일 때만 활성화합니다.

## 배포 전 수동 스모크 체크리스트

- 로그인 가능 확인
- 대상자 등록 가능 확인
- 9종 중 최소 2종 선택으로 멀티 척도 세션 저장 확인
- 세션 상세 조회 확인
- print view 열기와 브라우저 인쇄 확인
- `statistics/summary`, `statistics/scales`, `statistics/alerts` 조회 확인
- statistics CSV export 확인
- 관리자 승인/반려 확인
- 관리자 사용자 역할/상태 변경 확인
- 관리자 활동 로그 조회 확인
- 수동 백업 실행 확인
- `GET /api/v1/health` 응답이 `UP` 인지 확인

## 이번 단계에서 만든 핵심 파일

### 백엔드
- `backend/src/main/resources/application-local.yml`
- `backend/src/main/resources/scales/common/scale-registry.json`
- `backend/src/main/resources/scales/phq9.json`
- `backend/src/main/java/com/dasisuhgi/mentalhealth/auth/...`
- `backend/src/main/java/com/dasisuhgi/mentalhealth/client/...`
- `backend/src/main/java/com/dasisuhgi/mentalhealth/assessment/...`
- `backend/src/main/java/com/dasisuhgi/mentalhealth/scale/...`
- `backend/src/main/java/com/dasisuhgi/mentalhealth/common/config/LocalDataInitializer.java`

### 프론트
- `frontend/src/app/router/AppRouter.tsx`
- `frontend/src/app/providers/AuthProvider.tsx`
- `frontend/src/pages/auth/LoginPage.tsx`
- `frontend/src/pages/clients/ClientListPage.tsx`
- `frontend/src/pages/clients/ClientCreatePage.tsx`
- `frontend/src/pages/clients/ClientDetailPage.tsx`
- `frontend/src/pages/assessment/AssessmentScaleSelectPage.tsx`
- `frontend/src/pages/assessment/AssessmentInputPage.tsx`
- `frontend/src/pages/assessment/AssessmentSummaryPage.tsx`
- `frontend/src/pages/assessment/AssessmentSessionDetailPage.tsx`

## 다음 단계 권장
- 활동 로그 상세 필터와 다운로드 보강
- 통계 차트/시각화 고도화
- 운영 알림과 배치 자동화 보강

## 문서 세트
- 프로젝트 개요: [`docs/00-project-overview.md`](./docs/00-project-overview.md)
- 화면 구조: [`docs/01-screen-structure.md`](./docs/01-screen-structure.md)
- DB 설계: [`docs/02-db-design.md`](./docs/02-db-design.md)
- API 명세: [`docs/03-api-spec.md`](./docs/03-api-spec.md)
- 척도 규칙: [`docs/04-scale-json.md`](./docs/04-scale-json.md)
- 백엔드 아키텍처: [`docs/05-backend-architecture.md`](./docs/05-backend-architecture.md)
- 프론트엔드 아키텍처: [`docs/06-frontend-architecture.md`](./docs/06-frontend-architecture.md)
- 검증 규칙: [`docs/07-validation-rules.md`](./docs/07-validation-rules.md)
- 오류 처리: [`docs/08-error-handling.md`](./docs/08-error-handling.md)
- 테스트 시나리오: [`docs/09-test-scenarios.md`](./docs/09-test-scenarios.md)
- 개발 환경: [`docs/10-dev-setup.md`](./docs/10-dev-setup.md)
- 배포 절차: [`docs/11-deployment.md`](./docs/11-deployment.md)
- 배포 판정 문서: [`docs/12-release-readiness.md`](./docs/12-release-readiness.md)
- 배포 직전 실행 문서: [`docs/13-pre-deploy-runbook.md`](./docs/13-pre-deploy-runbook.md)
- 배포 결과 기록 양식: [`docs/14-deploy-result-template.md`](./docs/14-deploy-result-template.md)
- Go-live 체크리스트: [`docs/15-go-live-checklist.md`](./docs/15-go-live-checklist.md)
- Prod Config 체크리스트: [`docs/16-prod-config-checklist.md`](./docs/16-prod-config-checklist.md)
- Docker Compose 운영 배포 마무리 체크: [`docs/18-docker-compose-deployment.md`](./docs/18-docker-compose-deployment.md)
- 운영 초기 관리자 부트스트랩 절차: [`docs/19-production-bootstrap.md`](./docs/19-production-bootstrap.md)
- 운영 입력 시트: [`docs/20-production-input-sheet.md`](./docs/20-production-input-sheet.md)
