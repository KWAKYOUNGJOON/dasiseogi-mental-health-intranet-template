# 배포 전 하드코딩 점검 보고서

## 1. 점검 범위
- 실제로 읽은 1차 범위: `backend/`, `frontend/`, `scripts/`, `.github/workflows/`, `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.local-db.yml`, `.env.prod.example`, `.env.docker.example`, `.env.docker.local-db.example`
- 실제 맥락 확인을 위해 추가로 읽은 문서: `docs/10-dev-setup.md`, `docs/16-prod-config-checklist.md`, `docs/19-production-bootstrap.md`, `docs/20-production-input-sheet.md`, `docs/examples/production-runtime.env.example`
- 집중 확인 파일: `backend/docker-entrypoint.sh`, `backend/src/main/resources/application*.yml`, `backend/src/main/java/com/dasisuhgi/mentalhealth/common/config/LocalDataInitializer.java`, `backend/src/main/java/com/dasisuhgi/mentalhealth/user/support/PositionNamePolicy.java`, `backend/src/main/resources/schema.sql`, `frontend/src/app/layouts/AppLayout.tsx`, `frontend/src/pages/auth/LoginPage.tsx`, `frontend/src/features/auth/components/SignupRequestForm.tsx`, `frontend/src/features/admin/adminManagementMetadata.ts`, `frontend/src/shared/api/http.ts`, `frontend/vite.config.ts`, `frontend/nginx.conf`, `scripts/admin-smoke-check.bat`, `scripts/health-check.bat`, `scripts/deploy-backend.bat`, `scripts/deploy-frontend.bat`, `.github/workflows/deploy-production.yml`
- 제외한 범위: `frontend/node_modules/`, `frontend/dist/`, `coverage/`, `backend/build/`, `backend/bin/`, `backend/.gradle/` 및 기타 산출물
- 추가 확인 결과:
  `CORS/origin/callback/redirect` URL 하드코딩은 운영 경로 기준으로 확정하지 못했다.
  프론트 앱 소스에서 척도 cutoff/판정 기준 원본을 별도 복제한 사례는 찾지 못했다.

## 2. 하드코딩 발견 목록
| ID | 심각도 | 분류 | 파일 | 줄 번호 | 하드코딩 값 | 문제 설명 | 권장 softcoding 방식 | source of truth |
|---|---|---|---|---|---|---|---|---|
| ENV-001 | Critical | 환경 의존 값 | `backend/docker-entrypoint.sh`<br>`backend/src/main/resources/application-local.yml`<br>`backend/src/main/resources/application.yml` | `4, 16-42`<br>`3-6, 18-20`<br>`9-12, 55-56` | `jdbc:h2:file:/data/tmp/h2/localdb...`, `SPRING_PROFILES_ACTIVE=local`, `APP_DB_USERNAME=sa`, `org.h2.Driver`, `app.seed.enabled=true` | DB 환경값이 비어 있거나 placeholder면 컨테이너가 실패하지 않고 local H2 + seed 활성 프로필로 떨어진다. 운영 문서도 이 fallback 가능성을 중단 조건으로 다루고 있어, 실제 운영 DB가 아니라 로컬 저장소로 기동될 수 있는 값이 스크립트와 기본 설정에 박혀 있는 하드코딩으로 판단했다. | 배포 경로에서는 필수 DB 값이 비거나 placeholder면 즉시 fail-fast 하도록 바꾸고, local fallback은 dev 전용 entrypoint 또는 명시적 dev 플래그로만 허용한다. | `.env`/`docker-compose`/secret의 실제 DB 연결값과 명시적 배포 프로필 |
| SEC-001 | Critical | 보안/운영 값 | `backend/src/main/java/com/dasisuhgi/mentalhealth/common/config/LocalDataInitializer.java` | `48-63, 67-79, 122-125` | `admina`, `usera`, `userb`, `pendinguser`, `inactiveuser`, `rejecteduser`, `Test1234!`, 샘플 전화번호/팀명/대상자명 | seed가 켜지면 고정 관리자/사용자 계정, 알려진 비밀번호, 샘플 대상자 데이터가 코드에서 자동 생성된다. 운영 원칙상 초기 관리자는 `회원가입 신청 -> DB 수동 승격`으로 만들어야 하므로, 이 값들은 local-only seed source에 있어야 하며 코드 내 bootstrap 값이라 Critical로 판단했다. | dev/test 전용 seed 리소스로 분리하고 prod 패키지/프로필에서는 bean이 로드되지 않도록 차단한다. | dev 전용 seed fixture; 운영 초기 계정은 DB 수동 승격 절차 |
| ENV-002 | High | 환경 의존 값 | `docker-compose.prod.yml` | `10-13, 49-53` | `${PROD_DB_NAME:-mental_health}`, `${PROD_DB_USERNAME:-mental_user}` | 운영 compose가 실제 DB 이름과 앱 계정을 필수 입력으로 강제하지 않고 샘플 기본값으로 기동할 수 있다. 운영마다 달라져야 하는 값인데 prod compose에 남아 있어, 입력 누락 시에도 조용히 다른 이름으로 기동될 수 있으므로 하드코딩 후보로 판단했다. | prod compose에서는 기본값을 제거하고 값이 없으면 compose 단계에서 실패하게 만든다. 예시값은 `.env.prod.example`에만 유지한다. | `.env.prod`/secret/배포 환경 변수 |
| SEC-002 | High | 보안/운영 값 | `scripts/admin-smoke-check.bat` | `12-15, 17-27, 58-60` | `http://127.0.0.1:8080`, `admina`, `Test1234!` | 운영에서도 실행 가능한 스모크 스크립트가 로컬 seed 기본 URL/계정/비밀번호를 내장하고 있다. 문서는 운영에서 명시 인자를 넘기라고 요구하지만 실행 파일 자체가 위험한 기본값을 들고 있어, 오사용 시 운영 점검 대상을 잘못 치거나 known credential을 시도하게 되는 하드코딩으로 판단했다. | base URL, loginId, password를 필수 인자 또는 secret env로만 받게 하고, 누락 시 즉시 종료한다. | 운영 입력 시트 + 비밀 저장소 + 명시적 실행 인자 |
| BIZ-001 | Medium | 비즈니스 중복 값 | `backend/src/main/java/com/dasisuhgi/mentalhealth/user/support/PositionNamePolicy.java`<br>`frontend/src/features/auth/components/SignupRequestForm.tsx`<br>`frontend/src/features/admin/adminManagementMetadata.ts` | `7-8`<br>`7, 98, 166-167`<br>`14` | `팀장`, `대리`, `실무자` | 직책 master가 backend validation, signup UI, admin UI에 중복 복사돼 있다. 특정 조직에서 달라질 수 있는 운영 메타데이터가 여러 레이어에 흩어져 있어 한쪽만 바뀌면 UI 선택지와 서버 검증이 어긋나므로, source of truth 분산 하드코딩으로 판단했다. | backend가 직책 목록을 config/resource/DB master로 관리하고, frontend는 메타데이터 API만 재사용한다. | backend 직책 master resource 또는 DB |
| BIZ-002 | Medium | 비즈니스 중복 값 | `backend/src/main/resources/schema.sql` | `168-169, 194-195, 217-218` | `PHQ9`, `GAD7`, `MKPQ16`, `KMDQ`, `PSS10`, `ISIK`, `AUDITK`, `IESR`, `CRI` | 운영 척도 목록의 원본은 `backend/src/main/resources/scales/common/scale-registry.json`인데, DB check constraint가 같은 scale code 목록을 세 군데 다시 적고 있다. 척도 추가/비활성화 때 JSON과 SQL을 함께 수정해야 하므로 source of truth가 둘 이상인 하드코딩으로 판단했다. | scale master reference table 또는 migration-generated master를 두고 세션 테이블은 FK/참조로 묶는다. | backend scale registry resource 또는 그로부터 적재된 DB scale master |
| BIZ-003 | Medium | 비즈니스 중복 값 | `backend/src/main/resources/schema.sql` | `219-220` | `HIGH_RISK`, `CAUTION`, `CRITICAL_ITEM`, `COMPOSITE_RULE` | alert type 원본은 `backend/src/main/resources/scales/common/alert-types.json`과 backend enum인데, schema.sql이 literal 목록을 다시 들고 있다. 통계 메타데이터와 DB 제약이 따로 drift할 수 있어 source of truth 분산 하드코딩으로 판단했다. | alert type master table 또는 migration-generated enum reference를 두고 DB 제약은 그 master를 참조한다. | backend alert-types resource 또는 DB alert-type master |
| FR-001 | Medium | 프론트 런타임 값 | `frontend/src/app/layouts/AppLayout.tsx`<br>`frontend/src/pages/auth/LoginPage.tsx`<br>`backend/src/main/resources/application-prod.yml` | `20-21`<br>`6-8`<br>`35-37` | `다시서기`, `정신건강 평가관리`, `다시서기 정신건강 평가관리 시스템` | backend는 `APP_ORGANIZATION_NAME`으로 운영별 시스템명을 바꿀 수 있는데, 프론트 메인/로그인 타이틀은 문자열을 직접 박아 두었다. print data는 이미 서버의 `institutionName`을 쓰고 있어, 프론트 공통 타이틀만 별도 source를 가지는 하드코딩으로 판단했다. | 공통 앱 메타데이터를 backend API 또는 초기 bootstrap 응답으로 내려주고 프론트 레이아웃/로그인에서 재사용한다. | backend `app.organization.name` |
| ENV-003 | Medium | 환경 의존 값 | `backend/src/main/resources/application-prod.yml`<br>`docker-compose.prod.yml`<br>`frontend/nginx.conf`<br>`frontend/vite.config.ts`<br>`backend/Dockerfile`<br>`frontend/Dockerfile` | `1-2`<br>`24-31, 41-42`<br>`2, 8-9`<br>`7-12`<br>`28`<br>`17` | `8080`, `4173`, `http://127.0.0.1:8080/api/v1/health`, `http://backend:8080`, `http://host.docker.internal:8080` | backend는 `APP_SERVER_PORT`를 받도록 되어 있지만 compose healthcheck/port mapping, nginx proxy, dev proxy, Docker expose는 모두 고정 포트를 중복 보유한다. 환경별로 달라질 수 있는 네트워크 좌표가 여러 파일에 흩어져 있어 변경 시 드리프트가 생기므로 하드코딩으로 판단했다. | 배포 경로에서 포트를 진짜 고정할지, 아니면 compose/env 템플릿 변수로 단일화할지 결정하고 healthcheck/proxy/expose를 같은 변수로 렌더링한다. | 배포 profile(`docker-compose`/runtime env) |
| INF-001 | Medium | 인프라/스크립트 값 | `scripts/deploy-backend.bat`<br>`scripts/deploy-frontend.bat` | `86-93`<br>`112-119` | `%~dp0..` | 배포 루트 `APP_HOME`가 없으면 두 스크립트가 실패하지 않고 저장소 부모 디렉터리를 배포 대상으로 추론한다. 배포 경로는 환경마다 달라져야 하는 값인데 script-relative fallback으로 대체하고 있어, 잘못된 경로에 산출물을 쓰게 만드는 하드코딩으로 판단했다. | `APP_HOME`를 필수 입력으로 강제하고, 누락 시 즉시 중단한다. | 배포 환경 변수 또는 배포 profile |
| INF-002 | Low | 인프라/스크립트 값 | `scripts/health-check.bat` | `12-14` | `http://127.0.0.1:8080/api/v1/health` | 운영 문서는 환경별 direct health URL을 입력 시트에 기록하도록 요구하지만, 스크립트는 인자가 없을 때 로컬 URL로 조용히 떨어진다. 운영 점검 대상 URL이 환경마다 달라질 수 있는 값이어서 하드코딩 후보로 판단했다. | `APP_HEALTHCHECK_URL` 또는 명시 인자를 필수화하고, 누락 시 종료한다. | 운영 입력 시트/배포 env var |

## 3. 즉시 리팩토링 우선순위 Top 10
1. `ENV-001` backend Docker entrypoint의 local H2 fallback 차단. 현재는 운영 DB 값이 비거나 placeholder여도 실패하지 않고 다른 저장소로 기동할 수 있어, 실제 운영 데이터 경로를 가장 먼저 보호해야 한다.
2. `SEC-001` seed 계정/암호가 운영 경로에 절대 닿지 않도록 차단. 권한 분리와 초기 관리자 bootstrap 원칙을 직접 깨는 known credential 문제라서 두 번째로 막아야 한다.
3. `ENV-002` `docker-compose.prod.yml`의 `PROD_DB_NAME`/`PROD_DB_USERNAME` 기본값 제거. 운영값 누락이 조용히 샘플값으로 대체되면 검수 없이 잘못된 DB identity로 기동할 수 있다.
4. `SEC-002` `admin-smoke-check.bat`의 기본 URL/로그인ID/비밀번호 제거. 운영 점검 도구가 local seed 기본값을 품고 있으면 사람 실수 한 번으로 오작동하기 쉽다.
5. `BIZ-001` 직책 master 단일화. backend와 frontend가 동시에 같은 목록을 들고 있어 운영 조직 정책이 바뀌면 즉시 drift가 난다.
6. `BIZ-002` `schema.sql`의 scale code literal 목록 제거 또는 master table화. 척도 registry가 이미 있는데 SQL이 별도 목록을 들고 있어 새 척도 반영 시 누락 위험이 크다.
7. `BIZ-003` `schema.sql`의 alert type literal 목록 제거 또는 master table화. 통계/경고 메타데이터와 DB 제약을 동시에 맞춰야 하는 구조라 drift 비용이 높다.
8. `FR-001` 프론트 공통 타이틀을 backend `app.organization.name`와 연동. 이미 print 경로는 서버 값을 쓰므로, 로그인/레이아웃만 따로 박혀 있는 상태를 먼저 정리하는 편이 일관성에 좋다.
9. `ENV-003` 포트/health/proxy 값의 단일 source 지정. `APP_SERVER_PORT`를 바꿀 수 있는 척하면서 주변 파일이 모두 고정값을 들고 있어, 향후 환경 전환 때 장애로 이어질 수 있다.
10. `INF-001` 배포 스크립트의 `APP_HOME` 필수화. 수동 실행 시 저장소 부모 경로로 떨어지는 동작은 복구 비용이 큰 배포 실수로 이어질 수 있다.

## 4. 오탐 또는 유지 가능한 상수
- `backend/src/main/resources/scales/**`: 사용자 지시대로 척도 정의 원본 데이터로 간주했고, 이 경로 내부 값 자체는 하드코딩 문제로 보지 않았다.
- `frontend/src/features/assessment/utils/assessmentScaleUiRules.ts`, `frontend/src/features/assessment/utils/kmdq.ts`, `frontend/src/pages/assessment/AssessmentSummaryPage.tsx`: 프론트는 `ScaleDetail` API 응답의 `interpretationRules`, `alertRules`, `conditionalRequired`를 읽어 저장 전 미리보기만 계산하며, 저장 시 서버 재계산 안내가 있어 척도 원본 복제로 보지 않았다.
- `.env.prod.example`, `.env.docker.example`의 `PLACEHOLDER`, `change_me...` 값 자체: 문서용 예시값으로 판단했다. 다만 실행 스크립트의 기본 credential/base URL은 실제 실행 경로이므로 별도 발견 항목으로 보고했다.
- `.env.docker.local-db.example`, `scripts/init-db.sql`, `scripts/seed-local.sql`, `scripts/verify-db-dump-local.ps1`, `frontend/playwright*.ts`, `frontend/package.json`의 e2e 포트 값: local/test 전용 맥락으로 확인해 본 목록에서 제외했다.
- `backend/src/main/java/com/dasisuhgi/mentalhealth/user/entity/UserRole.java`, `UserStatus.java`, `ClientStatus.java`, `AssessmentSessionStatus.java` 및 대응 프론트 label map: enum/상태명 자체는 유지 가능한 컴파일 타임 상수로 보았다.
- `docker-compose*.yml`의 컨테이너 내부 경로 `/data/logs`, `/data/tmp`, `/data/backups`: host-side 경로는 이미 외부화돼 있고 내부 mount target은 컨테이너 계약 상수로 해석해 단독 문제로 보지 않았다.
- `.github/workflows/deploy-production.yml`: DB URL/계정/비밀번호는 GitHub `vars`/`secrets`로 주입하고 있어 secret 값 자체의 하드코딩은 확인하지 못했다.
- `CORS/origin/callback/redirect` URL: 검색은 수행했지만, 이번 점검 범위에서 운영 하드코딩으로 확정할 만한 사례는 찾지 못했다.

## 5. 중복군 정리
- `DG-01 로컬 fallback + seed 연쇄`
  `backend/docker-entrypoint.sh`, `application.yml`, `application-local.yml`, `LocalDataInitializer.java`, `scripts/admin-smoke-check.bat`
  운영 DB 미주입 또는 placeholder 상태가 local profile/H2/seed known credential로 이어질 수 있는 연쇄다. `ENV-001`, `SEC-001`, `SEC-002`가 같은 리스크 묶음이다.
- `DG-02 직책 master`
  `PositionNamePolicy.java`, `SignupRequestForm.tsx`, `adminManagementMetadata.ts`
  `팀장/대리/실무자`가 backend validation과 두 개의 프론트 진입점에 중복돼 있다. backend master 또는 metadata API로 단일화해야 한다.
- `DG-03 척도/alert master`
  `backend/src/main/resources/scales/common/scale-registry.json`, `backend/src/main/resources/scales/common/alert-types.json`, `backend/src/main/resources/schema.sql`
  운영 master는 scales 리소스인데, schema.sql이 같은 값을 literal로 다시 들고 있다. migration 또는 DB master table이 더 일관된 source다.
- `DG-04 조직명/브랜딩`
  `application-prod.yml`, `AppLayout.tsx`, `LoginPage.tsx`
  backend는 환경값을 받을 수 있지만 프론트 공통 타이틀은 문자열이 박혀 있다. 서버 source를 프론트 공통 레이아웃이 재사용해야 한다.
- `DG-05 포트/health/proxy`
  `application-prod.yml`, `docker-compose.prod.yml`, `frontend/nginx.conf`, `frontend/vite.config.ts`, `backend/Dockerfile`, `frontend/Dockerfile`, `scripts/health-check.bat`
  `8080`, `4173`, health URL, backend proxy target이 여러 층에 흩어져 있다. 변경할 수 있다면 전부 같은 deploy source를 보게 해야 하고, 고정할 거면 불필요한 가변 포인트를 제거해야 한다.
- `DG-06 배포 루트 경로`
  `scripts/deploy-backend.bat`, `scripts/deploy-frontend.bat`
  `APP_HOME` 부재 시 script-relative fallback을 사용한다. 배포 루트는 환경값 하나로만 결정되도록 정리하는 편이 안전하다.

## 6. 다음 Codex 작업 제안
- backend Docker entrypoint의 local H2 fallback 차단
