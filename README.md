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
- 척도 레지스트리 + 8종 척도 JSON 리소스 로딩
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
- 현재 실제 저장 가능한 척도는 `PHQ-9`, `GAD-7`, `mKPQ-16`, `K-MDQ`, `PSS-10`, `ISI-K`, `AUDIT-K`, `IES-R` 8종입니다.
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

```powershell
Copy-Item .env.docker.example .env
```

루트 `.env` 에 아래 값을 직접 입력합니다. `.env` 는 커밋하지 않습니다.

```dotenv
APP_DB_URL=jdbc:mariadb://DB_HOST_PLACEHOLDER:3306/DB_NAME_PLACEHOLDER?useUnicode=true&characterEncoding=utf8
APP_DB_URL_DOCKER=jdbc:mariadb://host.docker.internal:3306/DB_NAME_PLACEHOLDER?useUnicode=true&characterEncoding=utf8
APP_DB_USERNAME=DB_USERNAME_PLACEHOLDER
APP_DB_PASSWORD=DB_PASSWORD_PLACEHOLDER
```

- `APP_DB_URL` 은 호스트에서 앱을 직접 실행할 때 참고하는 예시다.
- `APP_DB_URL_DOCKER` 는 컨테이너에서 호스트 DB에 접속할 때 참고하는 예시다.
- `host.docker.internal` 은 컨테이너에서 호스트 머신의 DB 주소를 참조하기 위한 이름이다.

```powershell
docker compose build
docker compose up -d
```

확인 URL:
- `http://127.0.0.1:8080/api/v1/health`
- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/api/v1/health`

종료:

```powershell
docker compose down
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

현재 수동 백업은 환경별로 아래처럼 동작합니다.

- MariaDB/MySQL
  - 실행 전 datasource 종류, 백업 경로 writable 여부, dump command 사용 가능 여부를 preflight로 확인합니다.
  - `mariadb-dump` 또는 `mysqldump` 사용 가능하면 실제 DB dump를 우선 시도합니다.
  - dump 명령을 찾지 못하면 snapshot ZIP으로 fallback 합니다.
- H2 / 기타 로컬 환경
  - 실행 전 backup root writable 여부를 확인합니다.
  - snapshot ZIP 방식으로 백업합니다.

snapshot ZIP 포함 항목:
- `application.yml`
- `application-prod.yml`
- `backend/src/main/resources/scales/**/*.json`
- 사용자/대상자/세션 개수와 실행자 정보를 담은 `metadata/summary.json`

현재 미포함 항목:
- restore 자동화
- 업로드 파일/첨부파일
- 외부 스토리지 데이터

백업 파일은 기본적으로 `local-backups/` 아래에 생성됩니다.

복구 개요:
- `DB_DUMP`: 생성된 `.sql` 파일을 MariaDB/MySQL에 직접 import 합니다.
- `SNAPSHOT`: 설정/척도 JSON/메타데이터 확인용 스냅샷이며 DB 복구 파일은 아닙니다.

## 운영 템플릿

- 운영 설정 템플릿: `backend/src/main/resources/application-prod.yml`
- 백엔드 배포 초안: `scripts/deploy-backend.bat`
- 프론트 배포 초안: `scripts/deploy-frontend.bat`
- 수동 백업 실행 초안: `scripts/run-backup.bat`
- 기본 헬스체크 초안: `scripts/health-check.bat`

권장 순서:
1. `application-prod.yml` 또는 동등한 외부 설정 파일에 운영 값을 채웁니다.
   - `APP_TRUST_PROXY_HEADERS=true` 는 신뢰 가능한 리버스 프록시 뒤에서만 켭니다.
2. `scripts/deploy-backend.bat` 로 배포 대상 backend jar 를 운영 경로에 배치합니다.
3. `scripts/deploy-frontend.bat` 로 빌드된 frontend `dist` 를 운영 경로에 배치합니다.
4. 배포 직전 `scripts/run-backup.bat` 로 수동 백업을 실행합니다.
5. 배포 직후 `scripts/health-check.bat` 또는 `GET /api/v1/health` 로 앱/DB/scale registry 상태를 확인합니다.

## 운영 하드닝 메모

- 관리자 승인/반려 API 경로 변수는 항상 `requestId` 기준입니다.
- `userId` 를 `/api/v1/admin/signup-requests/{requestId}/approve|reject` 에 보내면 `SIGNUP_REQUEST_ID_REQUIRED` 로 실패합니다.
- 활동 로그 IP는 기본적으로 `remoteAddr` 를 사용합니다.
- `X-Forwarded-For`, `X-Real-IP` 신뢰는 `app.security.trust-proxy-headers=true` 일 때만 활성화합니다.

## 배포 전 수동 스모크 체크리스트

- 로그인 가능 확인
- 대상자 등록 가능 확인
- 8종 중 최소 2종 선택으로 멀티 척도 세션 저장 확인
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
