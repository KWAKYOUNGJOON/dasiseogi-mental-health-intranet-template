# 다시서기 정신건강 평가관리 시스템

기관 내부망에서 정신건강팀이 대상자 정보, 척도검사 입력, 결과 저장, 조회, 출력, 통계, 관리자 운영을 한 곳에서 처리할 수 있게 돕는 웹 시스템입니다.

이 저장소 기준으로 이 프로젝트는 의학적 진단을 내리는 도구가 아니라, 팀의 반복 업무를 줄이고 기록을 일관되게 남기기 위한 업무 지원 시스템으로 다룹니다.

## 비전공자용 안내

### 프로젝트 한눈에 보기

- 대상자 정보를 등록하고 검사 이력을 계속 누적해 볼 수 있습니다.
- 여러 척도를 한 번의 검사 묶음(세션)으로 저장합니다.
- 점수 계산과 판정은 화면이 아니라 서버가 다시 계산합니다.
- 잘못 만든 대상자나 세션은 바로 지우기보다 상태값으로 처리합니다.
- 사용자 권한은 일반 사용자와 관리자로 나뉩니다.

### 이 시스템이 필요한 이유

- 종이, 수기 채점, 별도 파일 기록으로 나뉘어 있던 업무를 한 화면 흐름으로 줄이기 위해서입니다.
- 척도별 점수 계산과 판정 규칙을 사람이 직접 다시 계산하지 않도록 하기 위해서입니다.
- 대상자별 검사 이력, 출력물, 통계를 같은 기준으로 관리하기 위해서입니다.
- 잘못 저장된 데이터를 삭제보다 상태 처리로 남겨 추적 가능하게 하기 위해서입니다.

### 누가 사용하는가

- 일반 사용자: 대상자 등록, 척도 입력, 세션 저장, 기록 조회, 통계 조회를 하는 실무자
- 관리자: 위 기능에 더해 가입 승인, 사용자 관리, 활동 로그, 백업/복원을 맡는 운영 담당자
- 비로그인 사용자: 로그인과 회원가입 신청만 가능합니다.

### 현재 코드에서 확인된 주요 기능

- 로그인, 로그아웃, 내 정보 조회/수정
- 회원가입 신청과 관리자 승인/반려
- 대상자 목록 조회, 등록, 상세 조회, 수정, 오등록 처리
- 대상자 이름/생년월일 기준 중복 확인
- 9종 척도 선택, 다중 척도 입력, 서버 재계산, 세션 단위 저장
- 세션 상세 조회, 인쇄용 화면 조회, 오입력 처리
- 검사기록 목록 조회와 조건 검색
- 대상자 상세에서 척도별 점수 추이 확인
- 통계 요약, 척도 비교, 경고 목록 조회
- 관리자 전용 CSV 내보내기
- 활동 로그 조회
- 수동 백업, 복원 ZIP 업로드/검증, 복원 준비/실행
- 헬스 체크(`/api/v1/health`)

### 실제 사용 흐름

1. 로그인합니다.
2. 대상자를 찾거나 새로 등록합니다.
3. 검사할 척도를 고릅니다.
4. 척도별 문항 응답을 입력합니다.
5. 서버가 점수, 판정, 경고를 다시 계산합니다.
6. 여러 척도를 하나의 세션으로 저장합니다.
7. 저장된 세션을 상세 화면, 출력 화면, 검사기록 목록, 통계 화면에서 다시 확인합니다.

### 사용자 권한 요약

- 일반 사용자(`USER`)
  - 활성 대상자와 완료된 세션을 중심으로 조회/등록/저장 업무를 수행합니다.
  - 통계 화면은 볼 수 있지만 CSV 내보내기는 할 수 없습니다.
  - 내 정보에서는 이름, 연락처, 소속 팀만 수정할 수 있습니다.
- 관리자(`ADMIN`)
  - 일반 사용자 기능을 모두 사용할 수 있습니다.
  - 승인 대기, 사용자 관리, 로그 확인, 백업 관리 화면에 접근할 수 있습니다.
  - 통계 CSV 내보내기, 백업/복원 실행이 가능합니다.
- 예외 규칙
  - 오등록 대상자(`MISREGISTERED`)와 오입력 세션(`MISENTERED`)은 기본 목록에서 숨깁니다.
  - 이를 포함해서 보거나 상태를 바꾸는 기능은 관리자 또는 해당 데이터를 만든 사용자 기준으로 제한됩니다.
  - 마지막 활성 관리자 1명은 일반 사용자로 바꾸거나 비활성화할 수 없게 막습니다.

### 현재 시스템에서 다루는 주요 항목

- 대상자
  - 이름, 성별, 생년월일, 연락처, 사례번호, 담당자, 상태
- 척도
  - `PHQ-9`, `GAD-7`, `mKPQ-16`, `K-MDQ`, `PSS-10`, `ISI-K`, `AUDIT-K`, `IES-R`, `정신과적 위기 분류 평정척도 (CRI)`
- 세션
  - 한 번의 검사 흐름에서 선택한 여러 척도를 하나로 묶은 저장 단위
- 검사기록
  - 세션 안의 각 척도 결과, 점수, 판정, 경고, 문항 응답
- 통계
  - 기간별 요약, 척도별 비교, 경고 목록, 관리자 CSV export
- 운영 기록
  - 가입 승인 처리, 활동 로그, 백업 이력, 복원 검증 이력
- 현재 저장소에서 확인되지 않은 범위
  - 일반 파일 첨부/업로드 관리
  - 외부 스토리지 연동

### 비전공자를 위한 쉬운 용어 설명

- 대상자
  - 검사를 기록하는 사람 1명을 뜻합니다.
- 척도
  - 문항에 응답해 점수를 계산하는 검사 종류입니다.
- 세션
  - 한 번 검사한 묶음입니다. 여러 척도를 함께 저장할 수 있습니다.
- 판정
  - 서버가 점수 규칙에 따라 계산한 결과 구간입니다.
- 경고
  - 특정 점수나 응답 규칙에 걸리면 보여주는 주의 표시입니다.
- 오등록(`MISREGISTERED`)
  - 대상자를 잘못 만들었을 때 쓰는 상태입니다. 바로 지우지 않고 기록을 남깁니다.
- 오입력(`MISENTERED`)
  - 세션을 잘못 저장했을 때 쓰는 상태입니다. 이 역시 바로 지우지 않고 상태로 남깁니다.

### 설치 전에 알아둘 점

- 최종 점수와 판정은 서버 기준입니다. 입력 중 화면에 보이는 값은 참고용일 수 있어도, 저장값은 서버 재계산 결과가 기준입니다.
- 저장 단위는 항상 세션입니다. 척도 하나씩 따로 확정 저장하는 구조가 아닙니다.
- 운영용과 로컬용 설정이 다릅니다. 로컬은 시드 계정과 H2 fallback이 있지만, 운영(`prod`)은 시드 계정이 꺼져 있고 DB 스키마 사전 준비가 필요합니다.
- 현재 프론트 개발 서버(`frontend/vite.config.ts`)의 `/api` 프록시는 `http://host.docker.internal:8080` 을 사용합니다. 이 호스트명이 동작하지 않는 환경이면 Docker 경로를 쓰거나 로컬 환경을 맞춰야 합니다.
- 기본 백업/로그/임시 경로는 각각 `local-backups/`, `logs/`, `tmp/` 아래를 사용합니다.

### 빠른 실행 방법

가장 재현하기 쉬운 확인 방법은 Docker Compose와 로컬 DB override를 함께 쓰는 경로입니다.

```bash
cp .env.docker.example .env
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.local-db.yml ps
```

- Windows PowerShell에서는 `Copy-Item .env.docker.example .env`
- 접속 주소
  - 프론트: `http://127.0.0.1:4173`
  - 백엔드 health: `http://127.0.0.1:8080/api/v1/health`
  - 프론트 프록시 health: `http://127.0.0.1:4173/api/v1/health`
- 첫 실행(빈 volume)에서는 local DB 기본값이 적용되고 시드 계정/대상자가 들어갑니다.
- local DB 계정명/비밀번호를 바꾸고 싶으면 `.env.docker.local-db.example` 의 `LOCAL_DB_*` 값을 `.env` 에 추가하면 됩니다.
- 바로 확인할 수 있는 관리자 계정: `admina / Test1234!`
- 종료

```bash
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down
```

- DB까지 완전히 초기화할 때만 아래 명령을 씁니다.

```bash
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down -v
```

더 자세한 실행 방법과 환경별 차이는 아래 `전공자/개발자용 상세`를 보면 됩니다.

### 운영/백업/복원 시 주의사항

- 운영 배포 전에는 실제 DB 주소, 계정, 비밀번호를 저장소에 쓰지 말고 별도 운영 문서나 비밀 저장소에서 관리해야 합니다.
- 운영 `prod` 경로는 `spring.jpa.hibernate.ddl-auto=validate` 이므로, 앱을 처음 띄우기 전에 `backend/src/main/resources/schema.sql` 을 먼저 적용해야 합니다.
- Docker 경로에서 DB 관련 환경값이 비어 있거나 placeholder 상태면 `backend/docker-entrypoint.sh` 가 local H2로 fallback 할 수 있으므로, 운영 반영 전 `docker compose config` 확인이 필요합니다.
- `/api/v1/health` 는 로그인 없이 열립니다. 내부망 또는 프록시 ACL로 접근 범위를 제한하는 것이 안전합니다.
- `APP_TRUST_PROXY_HEADERS=true` 는 신뢰 가능한 reverse proxy 뒤에서만 켜야 합니다. 그렇지 않으면 활동 로그 IP가 왜곡될 수 있습니다.
- 백업 이력의 `backupMethod` 는 꼭 구분해서 봐야 합니다.
  - `DB_DUMP`: ZIP 안에 DB SQL(`db/database.sql`)이 포함된 백업
  - `SNAPSHOT`: 설정/척도/메타데이터 중심 백업
- 현재 복원 실행은 `DATABASE` 그룹만 실제 실행 대상입니다. `CONFIG`, `SCALES`, `METADATA` 는 검증 참고용으로만 표시됩니다.
- `.env` 값을 바꾼 뒤에는 `docker compose restart` 만으로는 부족할 수 있습니다. 값 반영이 목적이면 `docker compose up -d --force-recreate` 를 사용해야 합니다.

### 현재 상태 요약

#### 운영 가능

- 저장소에는 백엔드, 프론트엔드, Docker Compose, 척도 JSON, 테스트, 운영 문서가 모두 들어 있습니다.
- 핵심 흐름인 `로그인 -> 대상자 등록/조회 -> 척도 선택 -> 다중 척도 입력 -> 세션 저장 -> 세션 상세/출력` 이 코드와 테스트 범위에서 확인됩니다.
- 관리자 기능(가입 승인, 사용자 관리, 활동 로그, 백업/복원)도 API와 화면이 연결되어 있습니다.
- [`docs/12-release-readiness.md`](./docs/12-release-readiness.md) 기준 현재 판정은 `READY` 입니다.

#### 확인 필요

- [`docs/deploy-results/2026-03-30.md`](./docs/deploy-results/2026-03-30.md), [`docs/deploy-results/2026-03-31.md`](./docs/deploy-results/2026-03-31.md), [`docs/deploy-results/2026-04-01.md`](./docs/deploy-results/2026-04-01.md) 기준 실제 운영 배포 결과는 모두 `미실행` 으로 기록돼 있습니다.
- 운영용 `.env`, 실제 DB/서버 주소, 초기 관리자 실계정 값은 저장소에 없습니다.
- 실제 운영 투입 전에는 `schema.sql` 사전 적용, health 확인, 초기 관리자 bootstrap, backup/restore 경로 점검이 별도로 필요합니다.
- 로컬 검증 기록이 있어도 실제 기관 운영 서버에서 같은 결과가 보장된다고 README에서 단정하지 않습니다.

#### 진행 중/추가 예정

- [`docs/12-release-readiness.md`](./docs/12-release-readiness.md) 에 후속 고도화 항목으로 아래가 남아 있습니다.
  - health endpoint 세부 지표 확장
  - backup 실행 로그/성공률 대시보드
  - 활동 로그 다운로드/고급 검색
  - backup restore 자동화
  - 배포 스크립트의 서비스 등록 자동화

## 전공자/개발자용 상세

### 기술 스택

- Backend
  - Java 21
  - Spring Boot 3.5.13
  - Spring Data JPA
  - Spring Validation
  - `spring-security-crypto`(BCrypt)
  - H2, MariaDB JDBC
  - Gradle Wrapper
- Frontend
  - React 19
  - TypeScript 5
  - Vite 8
  - React Router 7
  - Zustand
  - Axios
- Test
  - JUnit 5, Spring Boot Test
  - Testcontainers(MariaDB)
  - Vitest, Testing Library
  - Playwright
- Runtime / deploy
  - Docker Compose
  - Nginx(frontend runtime image)
  - JSON scale registry

### 코드와 데이터 원칙

- 척도 정의 원본은 `backend/src/main/resources/scales/` 아래 JSON입니다.
- 프론트는 척도 정의 복사본을 따로 두지 않고 API를 사용합니다.
- 세션 저장은 `AssessmentService` 의 단일 트랜잭션으로 처리됩니다.
- 점수, 판정, 경고는 서버가 계산합니다.
- 대상자/세션 정정은 삭제 API 대신 상태값(`MISREGISTERED`, `MISENTERED`) 처리로 우선합니다.
- `clientNo`, `sessionNo` 는 `identifier_sequences` 테이블 기반으로 생성됩니다.

### 디렉터리 구조

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
├── docs/
├── scripts/
├── local-backups/
├── docker-compose.yml
├── docker-compose.local-db.yml
├── docker-compose.prod.yml
├── .env.docker.example
├── .env.docker.local-db.example
└── .env.prod.example
```

### 환경 변수와 설정 파일

- `backend/src/main/resources/application.yml`
  - 공통 기본값
  - 기본 H2 파일 DB: `jdbc:h2:file:./backend/data/defaultdb...`
  - `app.seed.enabled=true`
  - 자동 백업 기본값: `enabled=true`, cron `0 0 2 * * *`, zone `Asia/Seoul`
  - 기본 백업 경로: `./local-backups`
  - 기본 복원 임시 경로: `./tmp/restores`
- `backend/src/main/resources/application-local.yml`
  - `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 환경변수 우선
  - 없으면 H2 파일 DB `./backend/data/localdb` fallback
  - `app.seed.enabled=true`
- `backend/src/main/resources/application-prod.yml`
  - `ddl-auto=validate`
  - `app.seed.enabled=false`
  - `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 기반
  - 로그/백업/임시 export 경로를 환경변수로 받음
- `backend/docker-entrypoint.sh`
  - Docker DB 환경값이 비어 있거나 placeholder 상태면 local H2 profile로 fallback
  - 운영 반영 전 `docker compose config` 검증이 필요한 이유가 여기에 있습니다.
- `.env.docker.example`
  - 현재 운영 문서가 기준으로 삼는 Docker 템플릿
  - 주 경로는 외부 MariaDB + `docker-compose.yml`
- `.env.docker.local-db.example`
  - `docker-compose.local-db.yml` 에서 사용할 local DB override 예시
- `.env.prod.example`
  - `docker-compose.prod.yml` 과 짝을 이루는 별도 템플릿
  - 다만 현재 배포 문서의 주 경로는 `.env.docker.example` + `docker-compose.yml` 입니다.
- `frontend/.env.development`
  - `VITE_API_BASE_URL=/api/v1`
  - `VITE_APP_TITLE=다시서기 정신건강 평가관리 시스템`

### 로컬 실행

#### 1. 백엔드만 직접 실행

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

- Windows PowerShell에서는 `.\gradlew.bat bootRun --args='--spring.profiles.active=local'`
- `APP_DB_URL` 등이 없으면 H2 파일 DB로 올라갑니다.
- 운영 계열 호환성까지 보려면 MariaDB/MySQL 환경에서 한 번 더 확인하는 것이 안전합니다.

#### 2. 프론트만 직접 실행

```bash
cd frontend
npm install
npm run dev
```

- 기본 개발 주소: `http://127.0.0.1:5173`
- 현재 Vite 프록시 대상: `http://host.docker.internal:8080`
- 즉, README를 `localhost:8080` 기준으로 설명하면 현재 코드와 다릅니다.
- 이 호스트명이 동작하지 않는 환경이면 Docker 경로를 쓰거나 로컬 네트워크 구성을 맞춰야 합니다.

#### 3. Docker Compose - 외부 DB 경로

```bash
cp .env.docker.example .env
# .env 에 APP_DB_URL_DOCKER, APP_DB_USERNAME, APP_DB_PASSWORD, APP_DB_DRIVER 등을 실제 값으로 입력
docker compose config
docker compose up -d --build
docker compose ps
```

- 기준 파일: `docker-compose.yml`
- 이 경로는 backend/frontend만 띄우고 DB는 외부 MariaDB를 사용합니다.
- 운영 문서상 주 경로는 이 조합입니다.

#### 4. Docker Compose - 로컬 DB override 경로

```bash
cp .env.docker.example .env
# 필요하면 .env.docker.local-db.example 의 LOCAL_DB_* 값을 .env 에 추가
docker compose -f docker-compose.yml -f docker-compose.local-db.yml config
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.local-db.yml ps
```

- backend는 `local` profile로 올라갑니다.
- `db` 서비스 MariaDB가 같은 Compose 프로젝트 안에서 같이 올라갑니다.
- 빈 volume 기준 첫 기동 시 `backend/src/main/resources/schema.sql` 이 적용되고, 시드 데이터도 함께 들어갑니다.
- 기존 `local_db_data` volume 이 있으면 init/seed 는 다시 실행되지 않습니다.

#### 5. 접근 주소

- 백엔드 health: `http://127.0.0.1:8080/api/v1/health`
- 프론트 runtime(Docker): `http://127.0.0.1:4173`
- 프론트 프록시 health(Docker): `http://127.0.0.1:4173/api/v1/health`
- 프론트 dev(Vite): `http://127.0.0.1:5173`

#### 6. 중지와 초기화

```bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down -v
```

### 시드 데이터

`app.seed.enabled=true` 이고 사용자/DB가 비어 있는 경우 아래 데이터가 자동 생성됩니다.

- 계정
  - `admina / Test1234!`
  - `usera / Test1234!`
  - `userb / Test1234!`
  - `pendinguser / Test1234!`
  - `inactiveuser / Test1234!`
  - `rejecteduser / Test1234!`
- 대상자
  - 활성 대상자 2명
  - `MISREGISTERED` 대상자 1명

### 테스트 방법

#### Backend

```bash
cd backend
./gradlew test
./gradlew mariaDbTest
./gradlew bootJar
```

- `test` 는 빠른 기본 회귀 테스트이며 `mariadb` 태그 테스트를 제외합니다.
- `mariaDbTest` 는 Testcontainers 기반 MariaDB 호환 테스트입니다.
- Docker가 없으면 MariaDB 계열 검증은 실행되지 않거나 기대대로 동작하지 않을 수 있습니다.

#### Frontend

```bash
cd frontend
npm test
npm run test:node:full
npm run test:dom
npm run build
npm run test:e2e
npm run test:e2e:full-stack
```

- `npm test` / `npm run test:verify`
  - 빠른 검증용
- `npm run test:node:full`
  - Node 기반 전체 테스트
- `npm run test:dom`
  - DOM/jsdom 테스트
- `npm run test:e2e`
  - 기본 Playwright
- `npm run test:e2e:full-stack`
  - 이미 떠 있는 backend/db 와 연결하는 full-stack Playwright
  - 전용 프론트 포트 `4174` 사용

주의:

- `frontend/README.md` 기준 WSL의 `/mnt/...` 경로에서는 DOM 테스트 시작이 막힐 수 있습니다.
- 이 경우 실패라기보다 실행 환경 제약일 수 있으므로, WSL 홈 디렉터리나 Windows 경로에서 다시 확인하는 편이 낫습니다.

### 배포/운영 참고

- 운영 문서의 주 배포 경로는 `docker-compose.yml` + `.env.docker.example` + 외부 MariaDB 입니다.
- 실제 운영 시작 전에 봐야 할 문서 순서는 대체로 아래와 같습니다.
  1. `docs/20-production-input-sheet.md`
  2. `docs/16-prod-config-checklist.md`
  3. `docs/18-docker-compose-deployment.md`
  4. `docs/19-production-bootstrap.md`
  5. `docs/15-go-live-checklist.md`
- `application-prod.yml` 기준으로는 seed 관리자 자동 생성이 없습니다. 초기 관리자 계정은 회원가입 신청 후 DB 수동 승격 절차를 거칩니다.
- [`docs/12-release-readiness.md`](./docs/12-release-readiness.md) 의 현재 판정은 `READY` 이지만, [`docs/deploy-results/2026-03-30.md`](./docs/deploy-results/2026-03-30.md), [`docs/deploy-results/2026-03-31.md`](./docs/deploy-results/2026-03-31.md), [`docs/deploy-results/2026-04-01.md`](./docs/deploy-results/2026-04-01.md) 는 실제 운영 배포를 `미실행` 으로 분리 기록하고 있습니다.
- `/api/v1/health` 는 인증이 없으므로 네트워크/프록시 레벨 제어를 같이 고려해야 합니다.
- 백업/복원 운영에서는 `backupMethod`, `datasourceType`, pre-backup 성공 여부를 함께 확인해야 합니다.
- 현재 복원 실행 범위는 MariaDB/MySQL `DATABASE` 기준입니다.

### 관련 문서 위치

- 개요/설계
  - [`docs/00-project-overview.md`](./docs/00-project-overview.md)
  - [`docs/01-screen-structure.md`](./docs/01-screen-structure.md)
  - [`docs/02-db-design.md`](./docs/02-db-design.md)
  - [`docs/03-api-spec.md`](./docs/03-api-spec.md)
  - [`docs/04-scale-json.md`](./docs/04-scale-json.md)
- 구현/검증
  - [`docs/05-backend-architecture.md`](./docs/05-backend-architecture.md)
  - [`docs/06-frontend-architecture.md`](./docs/06-frontend-architecture.md)
  - [`docs/07-validation-rules.md`](./docs/07-validation-rules.md)
  - [`docs/08-error-handling.md`](./docs/08-error-handling.md)
  - [`docs/09-test-scenarios.md`](./docs/09-test-scenarios.md)
  - [`docs/10-dev-setup.md`](./docs/10-dev-setup.md)
- 배포/운영
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
- 백업/복원 수동 검증
  - [`docs/backup-restore-manual-test-scenario.md`](./docs/backup-restore-manual-test-scenario.md)
- 배포 결과 기록
  - [`docs/deploy-results/`](./docs/deploy-results/)

### 운영 보조 스크립트

- `scripts/health-check.bat`
- `scripts/admin-smoke-check.bat`
- `scripts/run-backup.bat`
- `scripts/deploy-backend.bat`
- `scripts/deploy-frontend.bat`
- `scripts/verify-db-dump-local.ps1`

이 README는 현재 저장소의 코드, 설정 파일, Docker 설정, 테스트 스크립트, `docs/` 문서를 직접 확인해 다시 정리한 문서입니다. 실제 운영값과 실제 운영 반영 결과는 저장소 밖 문서와 운영 절차에서 별도로 확인해야 합니다.
