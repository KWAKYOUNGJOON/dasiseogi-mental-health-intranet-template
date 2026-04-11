# 다시서기 정신건강 평가관리 시스템

기관 내부망에서 정신건강팀이 대상자 정보, 척도검사 입력, 결과 저장, 조회, 출력, 통계, 관리자 운영을 한 곳에서 처리할 수 있게 돕는 웹 시스템입니다.

이 저장소 기준으로 이 프로젝트는 의학적 진단을 내리는 도구가 아니라, 팀의 반복 업무를 줄이고 기록을 일관되게 남기기 위한 업무 지원 시스템입니다.

## 비전공자용 안내

### 이 시스템은 무엇인가

정신건강팀이 대상자 등록부터 검사 결과 확인, 출력, 통계, 운영 관리까지를 내부망에서 처리하도록 만든 업무 지원 웹 시스템입니다.

### 누가 사용하는가

- 일반 사용자: 대상자 등록, 척도 입력, 세션 저장, 기록 조회, 통계 조회를 하는 실무자
- 관리자: 위 기능에 더해 가입 승인, 사용자 관리, 활동 로그, 백업/복원을 맡는 운영 담당자
- 비로그인 사용자: 로그인과 회원가입 신청만 할 수 있습니다.

### 무엇을 할 수 있는가

- 대상자를 등록하고 수정하며, 잘못 만든 대상자는 삭제 대신 상태값으로 관리합니다.
- 9종 척도를 선택해 문항 응답을 입력하고, 여러 척도를 한 번의 검사 묶음으로 저장합니다.
- 저장된 결과를 상세 화면, 출력 화면, 검사기록 목록, 통계 화면에서 다시 확인할 수 있습니다.
- 관리자는 가입 승인, 사용자 관리, 활동 로그 확인, 수동 백업과 복원 검증을 수행할 수 있습니다.

### 왜 필요한가

- 종이, 수기 채점, 별도 파일 기록으로 나뉘어 있던 업무를 한 흐름으로 줄이기 위해서입니다.
- 점수 계산과 판정을 사람이 다시 계산하지 않고 같은 기준으로 남기기 위해서입니다.
- 대상자별 검사 이력, 출력물, 통계를 같은 기준으로 관리하기 위해서입니다.
- 잘못 저장된 데이터를 바로 지우지 않고 상태로 남겨 추적 가능하게 하기 위해서입니다.

### 실제 운영 전에 무엇을 알아야 하는가

- 이 시스템은 의학적 진단 도구가 아니라 업무 지원 시스템입니다.
- 저장 기준은 항상 검사 세션이며, 최종 점수와 판정은 서버 재계산 결과가 기준입니다.
- 운영용 DB, 초기 관리자 계정, 비밀값 관리는 저장소 밖 운영 절차와 함께 별도로 준비해야 합니다.
- 현재 `READY` 판정은 배포 준비 상태를 뜻하며, 실제 운영 배포 완료를 뜻하지 않습니다.

### 현재 시스템에서 다루는 주요 항목

- 대상자: 이름, 성별, 생년월일, 연락처, 사례번호, 담당자, 상태를 관리합니다.
- 척도: `PHQ-9`, `GAD-7`, `mKPQ-16`, `K-MDQ`, `PSS-10`, `ISI-K`, `AUDIT-K`, `IES-R`, `정신과적 위기 분류 평정척도 (CRI)` 9종을 다룹니다.
- 검사 세션: 한 번의 검사 흐름에서 선택한 여러 척도를 함께 저장하는 단위입니다.
- 검사 결과: 문항 응답, 점수, 판정, 경고를 세션 기준으로 남깁니다.
- 운영 기록: 가입 승인 처리, 활동 로그, 백업 이력, 복원 검증 이력을 관리합니다.
- 현재 저장소에서 확인되지 않은 범위: 일반 파일 첨부/업로드 관리, 외부 스토리지 연동

### 비전공자를 위한 쉬운 용어

- 대상자: 검사를 기록하는 사람 1명을 뜻합니다.
- 척도: 문항에 응답해 점수를 계산하는 검사 종류입니다.
- 세션: 한 번 검사한 묶음입니다. 여러 척도를 함께 저장할 수 있습니다.
- 오등록(`MISREGISTERED`): 잘못 만든 대상자를 바로 지우지 않고 상태로 남기는 처리입니다.
- 오입력(`MISENTERED`): 잘못 저장한 세션을 바로 지우지 않고 상태로 남기는 처리입니다.

## 전공자/개발자용 상세

### 1. 기술 스택

- 백엔드: Java 21, Spring Boot 3.5.13, Spring Data JPA, Spring Validation, `spring-security-crypto`(BCrypt), H2, MariaDB JDBC, Gradle Wrapper
- 프론트엔드: React 19, TypeScript 5, Vite 8, React Router 7, Zustand, Axios
- 테스트: JUnit 5, Spring Boot Test, Testcontainers(MariaDB), Vitest, Testing Library, Playwright
- 실행 환경: Docker Compose, Nginx(프론트엔드 이미지), 척도 JSON 레지스트리

### 2. 디렉터리 구조

```text
.
├── backend/
│   ├── build.gradle
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   └── src/
│       ├── main/java/com/dasisuhgi/mentalhealth/...
│       └── main/resources/
│           ├── application.yml
│           ├── application-local.yml
│           ├── application-prod.yml
│           ├── schema.sql
│           └── scales/
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .env.development
│   ├── src/
│   ├── tests/
│   └── e2e/
├── docker/
│   └── single-container/
│       ├── Dockerfile
│       ├── entrypoint.sh
│       ├── init-db.sh
│       ├── nginx.conf
│       └── supervisord.conf
├── docs/
│   └── local-single-container.md
├── scripts/
├── local-backups/
├── docker-compose.yml
├── docker-compose.local-db.yml
├── docker-compose.single-container.yml
├── docker-compose.prod.yml
├── .env.docker.example
├── .env.docker.local-db.example
└── .env.prod.example
```

### 3. 실행 방법

기본 로컬 실행 경로는 저장소 루트의 `docker-compose.yml` 을 사용하는 멀티 컨테이너 스택입니다. Windows + Docker Desktop 기준으로는 이 경로만 따라가면 `db / backend / frontend` 가 한 프로젝트 아래에서 함께 올라옵니다.

#### 기본 로컬 실행 경로: Docker Compose 멀티 컨테이너

```bash
cp .env.docker.example .env
docker compose config
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:8080/api/v1/health
curl -fsS http://127.0.0.1:4173/api/v1/health
```

- Windows PowerShell에서는 `Copy-Item .env.docker.example .env`
- 기준 파일은 저장소 루트 [`docker-compose.yml`](./docker-compose.yml) 입니다.
- Docker Desktop 에서는 프로젝트 이름이 `dasiseogi-mental-health-intranet-template` 으로 보이고, 그 아래에 `db`, `backend`, `frontend` 컨테이너가 보여야 정상입니다.
- backend 는 compose 네트워크 내부 호스트명 `db` 로 MariaDB 에 접속합니다.
- 첫 기동에서 DB volume 이 비어 있으면 [`backend/src/main/resources/schema.sql`](./backend/src/main/resources/schema.sql) 이 자동 적용되고, `local` profile 기준 시드 데이터가 들어갑니다.
- 바로 확인할 수 있는 관리자 계정은 `admina / Test1234!` 입니다.
- `.env.docker.example` 만 준비하면 되고, `APP_DB_URL_DOCKER` 를 수동으로 채우지 않아도 기본 로컬 경로에서는 compose 내부 DB 주소가 자동으로 사용됩니다.

#### 접속 주소

- 프론트엔드 기본 주소: `http://127.0.0.1:4173`
- 프론트엔드 경유 health: `http://127.0.0.1:4173/api/v1/health`
- 백엔드 직접 health: `http://127.0.0.1:8080/api/v1/health`
- health 경로 기본값은 `APP_HEALTHCHECK_PATH=/api/v1/health` 이고, 포트를 바꿨다면 `http://127.0.0.1:<APP_SERVER_PORT><APP_HEALTHCHECK_PATH>` 와 `http://127.0.0.1:<APP_FRONTEND_PORT><APP_HEALTHCHECK_PATH>` 로 확인하면 됩니다.

#### 재빌드, 중지, 초기화

```bash
docker compose up -d --build
docker compose down
docker compose down -v
```

- `.env` 값을 바꿨다면 `docker compose up -d --build` 또는 `docker compose up -d --force-recreate` 로 다시 반영합니다.
- `down -v` 는 로컬 DB volume `local_db_data` 까지 제거하므로, 로컬 데이터를 완전히 초기화할 때만 사용합니다.

#### 호환용 파일

- [`docker-compose.local-db.yml`](./docker-compose.local-db.yml) 은 예전 명령과의 호환을 위한 deprecated no-op 파일입니다.
- 기존 `docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d --build` 명령을 써도 결과는 현재 기본 멀티 컨테이너 스택과 같습니다.
- [`.env.docker.local-db.example`](./.env.docker.local-db.example) 도 같은 이유로 남겨 두었으며, 기본 경로에서는 필수가 아닙니다.

#### 선택형 경로: single-container bundle

```bash
docker compose -f docker-compose.single-container.yml config
docker compose -f docker-compose.single-container.yml up -d --build
docker compose -f docker-compose.single-container.yml ps
curl -fsS http://127.0.0.1:4173/api/v1/health
```

- [`docker-compose.single-container.yml`](./docker-compose.single-container.yml) 은 optional 경로이며, 더 이상 기본 사용 경로가 아닙니다.
- 서비스는 `bundle` 1개만 올라가며, 컨테이너 내부에서 `MariaDB + Spring Boot backend + Nginx frontend` 가 함께 실행됩니다.
- 상세 동작은 [`docs/local-single-container.md`](./docs/local-single-container.md) 를 참고합니다.

#### 백엔드만 직접 실행

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

- Windows PowerShell에서는 `.\gradlew.bat bootRun --args='--spring.profiles.active=local'`
- `APP_DB_URL` 등이 없으면 H2 파일 DB로 실행됩니다.

#### 프론트엔드만 직접 실행

```bash
cd frontend
npm install
npm run dev
```

- 기본 개발 주소는 `http://127.0.0.1:5173` 입니다.
- 현재 Vite 프록시 대상은 `http://host.docker.internal:8080` 입니다.
- 이 호스트명이 동작하지 않는 환경이면 Docker 경로를 쓰거나 네트워크 구성을 맞춰야 합니다.

#### 운영/배포용 경로

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod config
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

- 로컬 Windows 기본 확인 경로는 위 명령이 아니라 루트 `docker compose up -d --build` 입니다.
- 운영용 값은 [`.env.prod.example`](./.env.prod.example) 를 참고해 별도 `.env.prod` 로 준비합니다.

#### 시드 데이터

`app.seed.enabled=true` 이고 사용자/DB가 비어 있는 경우 아래 데이터가 자동 생성됩니다.

- 계정: `admina`, `usera`, `userb`, `pendinguser`, `inactiveuser`, `rejecteduser`
- 기본 비밀번호: 모두 `Test1234!`
- 대상자: 활성 대상자 2명, `MISREGISTERED` 대상자 1명

### 4. 테스트 방법

#### 백엔드

```bash
cd backend
./gradlew test
./gradlew mariaDbTest
./gradlew bootJar
```

- `test` 는 `mariadb` 태그를 제외한 기본 회귀 테스트입니다.
- `mariaDbTest` 는 Testcontainers 기반 MariaDB 호환 테스트입니다.
- Docker가 없으면 MariaDB 계열 검증은 기대대로 동작하지 않을 수 있습니다.

#### 프론트엔드

```bash
cd frontend
npm test
npm run test:verify
npm run test:node:full
npm run test:dom
npm run build
npm run test:e2e
npm run test:e2e:full-stack
```

- `npm test` 와 `npm run test:verify` 는 빠른 확인용 명령입니다.
- `npm run test:node:full` 은 Node 기반 전체 테스트입니다.
- `npm run test:dom` 은 DOM/jsdom 테스트입니다.
- `npm run test:e2e:full-stack` 는 이미 실행 중인 backend/db와 연결하는 Playwright 경로이며 전용 프론트엔드 포트 `4174` 를 사용합니다.

주의:

- [`frontend/README.md`](./frontend/README.md) 기준 WSL의 `/mnt/...` 경로에서는 DOM 테스트 시작이 막힐 수 있습니다.
- 이 경우 애플리케이션 실패라기보다 실행 환경 제약일 수 있으므로, WSL 홈 디렉터리나 Windows 경로에서 다시 확인하는 편이 낫습니다.

### 5. 운영/배포 참고

#### 운영 가능

- 백엔드, 프론트엔드, Docker Compose, 척도 JSON, 테스트, 운영 문서가 현재 저장소에 함께 정리돼 있습니다.
- 로그인, 대상자 등록/조회, 다중 척도 입력, 세션 저장, 세션 상세/출력까지 핵심 흐름이 코드와 테스트 범위에서 확인됩니다.
- 관리자 기능도 API와 화면이 연결돼 있으며, [`docs/12-release-readiness.md`](./docs/12-release-readiness.md) 기준 현재 판정은 `READY` 입니다.

#### 확인 필요

- [`docs/deploy-results/2026-03-30.md`](./docs/deploy-results/2026-03-30.md), [`docs/deploy-results/2026-03-31.md`](./docs/deploy-results/2026-03-31.md), [`docs/deploy-results/2026-04-01.md`](./docs/deploy-results/2026-04-01.md) 기준 실제 운영 배포 결과는 모두 `미실행` 으로 기록돼 있습니다.
- 운영용 `.env`, 실제 DB/서버 주소, 초기 관리자 실계정 값은 저장소에 없습니다.
- 실제 운영 전에는 스키마 사전 적용, health 확인, 초기 관리자 준비, 백업/복원 경로 점검이 별도로 필요합니다.

#### 진행 중

- [`docs/12-release-readiness.md`](./docs/12-release-readiness.md) 기준 후속 고도화 항목으로 health 세부 지표 확장, 백업 실행 로그/성공률 대시보드, 활동 로그 다운로드/고급 검색, 복원 자동화, 배포 스크립트의 서비스 등록 자동화가 남아 있습니다.

#### 운영 문서 확인 순서

1. [`docs/20-production-input-sheet.md`](./docs/20-production-input-sheet.md)
2. [`docs/16-prod-config-checklist.md`](./docs/16-prod-config-checklist.md)
3. [`docs/18-docker-compose-deployment.md`](./docs/18-docker-compose-deployment.md)
4. [`docs/19-production-bootstrap.md`](./docs/19-production-bootstrap.md)
5. [`docs/15-go-live-checklist.md`](./docs/15-go-live-checklist.md)

#### 설정 파일과 환경 파일

- [`backend/src/main/resources/application.yml`](./backend/src/main/resources/application.yml): 공통 기본값, H2 파일 DB, 기본 백업/임시 경로, 자동 백업 기본값을 가집니다.
- [`backend/src/main/resources/application-local.yml`](./backend/src/main/resources/application-local.yml): `APP_DB_*` 환경변수를 우선 사용하고, 없으면 H2 파일 DB로 대체하며 시드 데이터가 켜져 있습니다.
- [`backend/src/main/resources/application-prod.yml`](./backend/src/main/resources/application-prod.yml): `ddl-auto=validate`, `app.seed.enabled=false` 기준으로 동작하며 DB와 로그/백업 경로를 환경변수로 받습니다.
- [`backend/docker-entrypoint.sh`](./backend/docker-entrypoint.sh): Docker 에서는 `APP_DB_URL_DOCKER` 를 `APP_DB_URL` 로 넘기고, `prod` 경로에서 필수 DB 값이 비어 있거나 placeholder 이거나 H2 URL 이면 즉시 실패합니다.
- [`.env.docker.example`](./.env.docker.example): 저장소 루트 기본 멀티 컨테이너 경로인 `docker compose up -d --build` 와 함께 쓰는 기본 Docker 템플릿입니다.
- [`.env.docker.local-db.example`](./.env.docker.local-db.example): 예전 `docker-compose.local-db.yml` 명령과의 호환을 위해 남겨 둔 참고 예시이며, 현재 기본 경로에서는 필수가 아닙니다.
- [`.env.prod.example`](./.env.prod.example): [`docker-compose.prod.yml`](./docker-compose.prod.yml) 용 운영 템플릿입니다.
- 기본 호스트 경로는 `logs/`, `tmp/`, `local-backups/` 아래를 사용합니다.

#### 운영 시 주의사항

- 운영 DB 주소, 계정, 비밀번호 같은 실제 비밀값은 저장소에 두지 말고 별도 운영 문서나 비밀 저장소에서 관리해야 합니다.
- 운영 `prod` 경로는 `spring.jpa.hibernate.ddl-auto=validate` 이므로 앱 기동 전에 [`backend/src/main/resources/schema.sql`](./backend/src/main/resources/schema.sql) 을 먼저 적용해야 합니다.
- 운영 기준으로는 시드 관리자 자동 생성이 없으므로 초기 관리자 계정은 [`docs/19-production-bootstrap.md`](./docs/19-production-bootstrap.md) 절차로 준비해야 합니다.
- [`docker-compose.prod.yml`](./docker-compose.prod.yml) 같은 운영 경로에서는 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 중 하나라도 비어 있거나 placeholder 이면 `docker compose config` 또는 backend 시작 단계에서 즉시 실패하므로, 운영 반영 전 `docker compose config` 확인이 필요합니다.
- `/api/v1/health` 는 로그인 없이 열리므로 내부망 또는 프록시 ACL로 접근 범위를 제한하는 편이 안전합니다.
- `APP_TRUST_PROXY_HEADERS=true` 는 신뢰 가능한 reverse proxy 뒤에서만 켜야 합니다. 그렇지 않으면 활동 로그 IP가 왜곡될 수 있습니다.
- 백업 이력의 `backupMethod` 는 구분해서 봐야 합니다. `DB_DUMP` 는 DB SQL이 포함된 백업이고, `SNAPSHOT` 은 설정/척도/메타데이터 중심 백업입니다.
- 현재 복원 실행은 MariaDB/MySQL 기준 `DATABASE` 그룹만 실제 실행 대상입니다. `CONFIG`, `SCALES`, `METADATA` 는 검증 참고용으로만 표시됩니다.
- `.env` 값을 바꾼 뒤 값 반영이 목적이라면 `docker compose restart` 대신 `docker compose up -d --force-recreate` 를 사용해야 합니다.

### 6. 관련 문서 링크

#### 개요와 설계

- [`docs/00-project-overview.md`](./docs/00-project-overview.md)
- [`docs/01-screen-structure.md`](./docs/01-screen-structure.md)
- [`docs/02-db-design.md`](./docs/02-db-design.md)
- [`docs/03-api-spec.md`](./docs/03-api-spec.md)
- [`docs/04-scale-json.md`](./docs/04-scale-json.md)

#### 구현과 검증

- [`docs/05-backend-architecture.md`](./docs/05-backend-architecture.md)
- [`docs/06-frontend-architecture.md`](./docs/06-frontend-architecture.md)
- [`docs/07-validation-rules.md`](./docs/07-validation-rules.md)
- [`docs/08-error-handling.md`](./docs/08-error-handling.md)
- [`docs/09-test-scenarios.md`](./docs/09-test-scenarios.md)
- [`docs/10-dev-setup.md`](./docs/10-dev-setup.md)

#### 운영과 배포

- [`docs/11-deployment.md`](./docs/11-deployment.md)
- [`docs/12-release-readiness.md`](./docs/12-release-readiness.md)
- [`docs/13-pre-deploy-runbook.md`](./docs/13-pre-deploy-runbook.md)
- [`docs/14-deploy-result-template.md`](./docs/14-deploy-result-template.md)
- [`docs/15-go-live-checklist.md`](./docs/15-go-live-checklist.md)
- [`docs/16-prod-config-checklist.md`](./docs/16-prod-config-checklist.md)
- [`docs/16-github-actions-deployment.md`](./docs/16-github-actions-deployment.md)
- [`docs/17-pre-docker-summary.md`](./docs/17-pre-docker-summary.md)
- [`docs/18-docker-compose-deployment.md`](./docs/18-docker-compose-deployment.md)
- [`docs/19-production-bootstrap.md`](./docs/19-production-bootstrap.md)
- [`docs/20-production-input-sheet.md`](./docs/20-production-input-sheet.md)
- [`docs/backup-restore-manual-test-scenario.md`](./docs/backup-restore-manual-test-scenario.md)

#### 배포 결과 기록

- [`docs/deploy-results/`](./docs/deploy-results/)
- [`docs/deploy-results/2026-03-30.md`](./docs/deploy-results/2026-03-30.md)
- [`docs/deploy-results/2026-03-31.md`](./docs/deploy-results/2026-03-31.md)
- [`docs/deploy-results/2026-04-01.md`](./docs/deploy-results/2026-04-01.md)

이 README는 현재 저장소의 코드, 설정 파일, Docker 설정, 테스트 스크립트, `docs/` 문서를 직접 확인해 다시 정리한 문서입니다. 실제 운영값과 실제 운영 반영 결과는 저장소 밖 운영 문서와 운영 절차에서 별도로 확인해야 합니다.
