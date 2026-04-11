# Production Input Sheet

이 문서는 실제 운영값을 채우기 위한 중심 입력 시트 템플릿이다.

- 저장소 원본에는 실제 비밀번호, 실제 운영 계정명, 실제 운영 서버 주소를 적지 않는다.
- 이 파일 원본은 placeholder 상태로 유지하고, 실제 값은 이 파일 복사본 또는 내부 운영 문서에서만 채운다.
- 실제 운영 반영은 이 시트를 먼저 닫은 뒤 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) -> [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) -> [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) -> [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 순서로 진행한다.

---

## 1. 사용 방법과 문서 순서

1. 이 파일을 복사해서 로컬 작업본 또는 내부 운영 문서로 만든다.
2. 아래 표의 실제 운영 입력값, 담당자, 반영 위치, 검증 수단, 중단 지점을 먼저 채운다.
3. 이 시트 복사본을 보면서 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 선행 조건을 닫는다.
4. 같은 시트를 기준으로 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장~9장 운영 설정 게이트를 닫는다.
5. `schema.sql`, `.env`, `docker compose config`, health 확인은 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 2.1, 3.4, 4장, 6장 순서로 닫는다.
6. health 정상 후 초기 관리자 준비는 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 4장~8장 순서로 닫는다.
7. 이후 다시 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 5장~8장과 [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 로 돌아가 실제 운영 직전 게이트와 결과 기록을 닫는다.

중요:
- 아래 표의 `비어 있으면 어디서 중단하는지` 는 실제 운영 반영 전 반드시 멈춰야 하는 문서 위치다.
- placeholder, 추측값, 미확인 값으로는 다음 문서로 넘어가지 않는다.
- 운영자가 가장 먼저 보는 기준은 이 시트 복사본이고, 실제 값은 항상 이 시트 복사본과 비밀 저장소 참조 위치를 함께 남긴다.

---

## 2. 이름 매핑과 적용 경로

아래 표는 `.env.docker.example`, `docs/examples/production-runtime.env.example`, `backend/src/main/resources/application-prod.yml`, `docker-compose.yml`, `backend/docker-entrypoint.sh` 사이 이름 차이를 먼저 맞추기 위한 기준이다.

| 저장소 기준 항목 | Docker Compose 경로 | 직접 실행 경로 | 실제 코드 또는 스크립트에서 읽는 위치 | 최소 검증 기준 |
|---|---|---|---|---|
| DB JDBC URL | 루트 `.env` 의 `APP_DB_URL_DOCKER` | 서비스 환경변수의 `APP_DB_URL` | Docker 에서는 `backend/docker-entrypoint.sh` 가 `APP_DB_URL_DOCKER` 를 `APP_DB_URL` 로 넘기고, 최종적으로 `application-prod.yml` 의 `spring.datasource.url` 이 읽는다 | `docker compose config` 또는 서비스 환경변수 대조 후 `/api/v1/health` 의 `dbStatus=UP` 확인 |
| DB 계정/비밀번호/드라이버 | 루트 `.env` 의 `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` | 서비스 환경변수의 같은 이름 | `application-prod.yml` 의 datasource username/password/driver-class-name | `docker compose config`, 서비스 환경변수 대조, backend 기동 로그, `/api/v1/health` 확인 |
| 로그 경로 | 루트 `.env` 의 `BACKEND_LOGS_HOST_PATH` | 서비스 환경변수의 `APP_LOG_FILE_PATH` | Docker 는 host path 를 `/data/logs` 로 바인드하고, `application-prod.yml` 은 `APP_LOG_FILE_PATH` 를 읽는다 | `docker compose config` 의 bind mount, 실제 경로 생성/writable 확인 |
| export 임시 경로 | 루트 `.env` 의 `BACKEND_TMP_HOST_PATH` | 서비스 환경변수의 `APP_EXPORT_TEMP_PATH` | Docker 는 host path 를 `/data/tmp` 로 바인드하고, 앱은 `/data/tmp/exports` 또는 direct runtime 경로를 사용한다 | `docker compose config`, 실제 경로 생성/writable 확인, export 스모크 확인 |
| 백업 루트 경로 | 루트 `.env` 의 `BACKEND_BACKUPS_HOST_PATH` | 서비스 환경변수의 `APP_BACKUP_ROOT_PATH` | Docker 는 host path 를 `/data/backups` 로 바인드하고, `application-prod.yml` 이 최종 root path 를 읽는다 | `docker compose config`, 실제 경로 생성/writable 확인, 백업 산출물 확인 |
| DB dump 명령 | 루트 `.env` 의 `APP_DB_DUMP_COMMAND` | 서비스 환경변수의 `APP_DB_DUMP_COMMAND` | `/api/v1/admin/backups/run`, `run-backup.bat`, `application-prod.yml` 의 `app.backup.db-dump-command` | dump 바이너리 실제 존재 여부 또는 운영 대체 수단 문서화 |
| proxy 신뢰 정책 | 루트 `.env` 의 `APP_FORWARD_HEADERS_STRATEGY`, `APP_TRUST_PROXY_HEADERS` | 서비스 환경변수의 같은 이름 | `application-prod.yml`, request metadata 처리 | reverse proxy 구성 대조, activity log IP 확인 계획 확정 |
| scale 리소스 경로 | Docker 기본은 `classpath:scales` 유지 | 필요 시 `APP_SCALE_RESOURCE_PATH` 지정 | `application-prod.yml` 의 `app.scale.resource-path` | health `scaleRegistryStatus=UP`, `loadedScaleCount=9` 확인 |

주의:
- Docker Compose 운영 경로에서는 `APP_DB_URL_DOCKER` 가 우선 기준이고, 직접 실행 경로에서는 `APP_DB_URL` 이 우선 기준이다.
- 운영에서 `scripts/admin-smoke-check.bat` 를 쓸 때는 base URL, 관리자 login ID, 비밀번호를 항상 명시적으로 넘기거나 `ADMIN_SMOKE_BASE_URL`, `ADMIN_SMOKE_LOGIN_ID`, `ADMIN_SMOKE_PASSWORD` 환경변수로 먼저 넣는다.
- 운영에서 `scripts/health-check.bat` 를 쓸 때는 health URL 을 항상 명시적으로 넘기거나 `HEALTH_CHECK_URL` 환경변수로 먼저 넣는다.
- `scripts/admin-smoke-check.bat` 는 `/api/v1/admin/backups/run` 을 호출하므로, 백업 경로와 dump 정책이 닫히기 전에는 실행하지 않는다.

---

## 3. 작성 메타데이터

| 항목 | 실제 입력값 또는 보관 위치 | 누가 채우는지 | 어디에 반영하는지 | 무엇으로 검증하는지 | 비어 있으면 어디서 중단하는지 | 완료 |
|---|---|---|---|---|---|---|
| 대상 환경 이름 | 미기입 | 입력 시트 작성자 | 이 시트 복사본, 내부 운영 문서, 결과 문서 초안 | 이 시트 복사본과 `docs/14` 결과 문서 초안의 환경명이 같은지 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 시작 전 | [ ] |
| 입력 시트 작성자 | 미기입 | 입력 시트 작성자 | 이 시트 복사본 | 작성자 메타데이터 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 시작 전 | [ ] |
| 실제 운영 반영 담당자 | 미기입 | 서비스 운영 책임자 | 이 시트 복사본, 내부 운영 문서, 결과 문서 | 담당자 지정 여부를 운영 회의 메모 또는 티켓으로 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 시작 전 | [ ] |
| 실제 운영 검수자 | 미기입 | 서비스 운영 책임자 | 이 시트 복사본, 내부 운영 문서, 결과 문서 | 검수자 지정 여부를 운영 회의 메모 또는 티켓으로 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 시작 전 | [ ] |
| 최종 검토 일시 | 미기입 | 입력 시트 작성자 또는 검수자 | 이 시트 복사본, 내부 운영 문서 | 마지막 갱신 시각 기록 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 시작 전 | [ ] |
| 로컬 작업본 또는 내부 문서 위치 | 미기입 | 입력 시트 작성자 | 이 시트 복사본, 내부 운영 문서 | 운영자가 실제 값 저장 위치를 바로 열 수 있는지 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 시작 전 | [ ] |
| 실제 운영 결과 기록 위치 | `docs/deploy-results/YYYY-MM-DD.md` 또는 내부 운영 결과 문서 | 실제 운영 반영 담당자 | 결과 문서 초안 | 결과 문서 파일 또는 템플릿 초안 생성 여부 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 5장 시작 전 | [ ] |

---

## 4. 실제 운영 접근 정보

| 항목 | 실제 입력값 또는 보관 위치 | 누가 채우는지 | 어디에 반영하는지 | 무엇으로 검증하는지 | 비어 있으면 어디서 중단하는지 | 완료 |
|---|---|---|---|---|---|---|
| 실제 운영 호스트 | 미기입 | 인프라 담당자 | 이 시트 복사본, 내부 운영 문서 | 인프라 전달 메모, 서버 접속 정보, 운영 티켓 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| 실제 운영 URL | 미기입 | 인프라 담당자 | 이 시트 복사본, 내부 운영 문서, 결과 문서 | 브라우저 또는 내부 DNS 기준 URL 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 | [ ] |
| backend 직접 확인 주소 또는 포트 | 미기입 | 인프라 담당자 | 이 시트 복사본, health 점검 메모, 필요 시 `scripts/health-check.bat` 실행 인자 | `http://.../api/v1/health` 또는 backend direct URL 이 실제로 열리는지 확인 | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 6장 health 확인 전 | [ ] |
| reverse proxy 사용 여부 | 미기입 | 인프라 담당자 | 이 시트 복사본, 내부 운영 문서, `.env` 또는 서비스 환경설정 판단 근거 | proxy 구성도 또는 인프라 전달 메모 확인 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장, 6장 | [ ] |
| `/api/v1/health` 허용 범위와 ACL 적용 위치 | 미기입 | 인프라 또는 보안 담당자 | 내부 운영 문서, 방화벽/프록시 설정 메모 | ACL 규칙 또는 프록시 설정 위치 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| `scripts/health-check.bat` 실행 대상 URL | 미기입 | 실제 운영 반영 담당자 | 운영 점검 메모, 배치 스크립트 실행 명령 | 스크립트 인자로 넣을 URL 이 backend direct URL 과 일치하는지 확인 | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 6장 health 확인 전 | [ ] |
| `APP_SERVER_PORT` 값 또는 direct runtime 포트 | 미기입 또는 `직접 실행 안 함` | 인프라 담당자 | direct runtime 서비스 환경설정, 운영 서버 작업본 | 서비스 포트 설정과 direct health URL 대조 | 직접 실행 경로를 선택했다면 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, 아니면 해당 없음 | [ ] |

---

## 5. 실제 운영 DB 정보

| 항목 | 실제 입력값 또는 보관 위치 | 누가 채우는지 | 어디에 반영하는지 | 무엇으로 검증하는지 | 비어 있으면 어디서 중단하는지 | 완료 |
|---|---|---|---|---|---|---|
| 운영 DB host | 미기입 | DB 관리자 | 이 시트 복사본, 루트 `.env` 작업본 또는 direct runtime 작업본 | DB 전달값과 JDBC URL host 부분 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| 운영 DB port | 미기입 | DB 관리자 | 이 시트 복사본, 루트 `.env` 작업본 또는 direct runtime 작업본 | DB 전달값과 JDBC URL port 부분 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| 운영 DB name | 미기입 | DB 관리자 | 이 시트 복사본, 루트 `.env` 작업본 또는 direct runtime 작업본 | DB 전달값과 JDBC URL dbName 부분 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| 운영 DB 관리자 계정명 | 미기입 | DB 관리자 | 비밀 저장소, 이 시트 복사본 참조란, `schema.sql` 적용 메모 | DB 관리 작업에 실제 사용할 계정인지 DBA와 대조 | [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 7장 `schema.sql` 적용 준비 전 | [ ] |
| 운영 DB 관리자 비밀번호 보관 위치 | 미기입 | DB 관리자 또는 비밀 관리 담당자 | 비밀 저장소 | 비밀 저장소 항목 ID 또는 보관 위치 확인 | [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 7장 `schema.sql` 적용 준비 전 | [ ] |
| 운영 앱 DB 계정명 | 미기입 | DB 관리자 | 비밀 저장소, 루트 `.env` 작업본 또는 direct runtime 작업본 | 앱 계정과 권한 범위가 DBA 전달값과 일치하는지 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장 | [ ] |
| 운영 앱 DB 비밀번호 보관 위치 | 미기입 | DB 관리자 또는 비밀 관리 담당자 | 비밀 저장소, `.env` 작업본 참조란 | 비밀 저장소 항목 ID 또는 주입 방식 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장 | [ ] |
| DB 계열과 JDBC 드라이버 | 미기입 | DB 관리자 | 루트 `.env` 작업본 또는 direct runtime 작업본 | MariaDB/MySQL 계열과 `APP_DB_DRIVER` 값이 일치하는지 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장 | [ ] |

---

## 6. 실제 런타임 파일과 경로

### 6.1 Docker Compose 운영 경로

| 항목 | 실제 입력값 또는 보관 위치 | 누가 채우는지 | 어디에 반영하는지 | 무엇으로 검증하는지 | 비어 있으면 어디서 중단하는지 | 완료 |
|---|---|---|---|---|---|---|
| 루트 `.env` 작성 위치 | 미기입 | 실제 운영 반영 담당자 | 대상 서버 작업 폴더 | 대상 서버에 실제 `.env` 작업본 위치가 있는지 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 | [ ] |
| 루트 `.env` 관리 방식 | 미기입 | 실제 운영 반영 담당자 | 내부 운영 문서 | 누가 언제 수정하고 어떤 방식으로 주입하는지 운영 메모 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| `.env` 작성 기준 템플릿 | `.env.docker.example` | 실제 운영 반영 담당자 | 대상 서버 작업 폴더 | 작업본이 `.env.docker.example` 기반인지 확인 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장 전 | [ ] |
| `APP_DB_URL_DOCKER` 값 | 미기입 | DB 관리자 또는 실제 운영 반영 담당자 | 루트 `.env` 작업본 | `docker compose config` 결과, JDBC URL host/port/name 대조, backend health `dbStatus=UP` | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4 | [ ] |
| `APP_DB_USERNAME` 값 | 미기입 | DB 관리자 | 루트 `.env` 작업본 | `docker compose config` 결과와 DBA 전달값 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4 | [ ] |
| `APP_DB_PASSWORD` 보관 위치 또는 주입 방식 | 미기입 | DB 관리자 또는 비밀 관리 담당자 | 비밀 저장소, 루트 `.env` 작업본 참조란 | 실제 비밀번호가 저장소 밖에 있고 `.env` 작업본에만 주입되는지 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4 | [ ] |
| `APP_DB_DRIVER` 값 | 미기입 | DB 관리자 | 루트 `.env` 작업본 | `docker compose config` 결과와 DB 계열 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4 | [ ] |
| `APP_SERVER_PORT` 값 또는 기본값 `8080` | 미기입 또는 기본값 유지 | 실제 운영 반영 담당자 | 루트 `.env` 작업본 | `docker compose config` backend 환경값, 실제 접속 포트, health URL 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.2, 6장 | [ ] |
| `APP_FRONTEND_PORT` 값 또는 기본값 `4173` | 미기입 또는 기본값 유지 | 실제 운영 반영 담당자 | 루트 `.env` 작업본 | `docker compose config` frontend 환경값, 실제 접속 포트, health URL 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.2, 6장 | [ ] |
| `APP_BACKEND_UPSTREAM_HOST` 값 또는 기본값 `backend` | 미기입 또는 기본값 유지 | 실제 운영 반영 담당자 | 루트 `.env` 작업본 | `docker compose config` frontend 환경값과 compose 네트워크 기준 대조 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장, 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.2 | [ ] |
| `APP_HEALTHCHECK_PATH` 값 또는 기본값 `/api/v1/health` | 미기입 또는 기본값 유지 | 실제 운영 반영 담당자 | 루트 `.env` 작업본 | `docker compose config` 결과, backend/frontend health 확인 URL 대조 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.2, 6장 | [ ] |
| `APP_SESSION_TIMEOUT` 값 | 미기입 또는 기본값 유지 | 서비스 운영 책임자 | 루트 `.env` 작업본 | 세션 정책 메모와 `.env` 작업본 대조 | 운영 정책이 미정이면 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장, 기본값 유지로 확정했다면 계속 진행 가능 | [ ] |
| `BACKEND_LOGS_HOST_PATH` 값 | 미기입 | 인프라 담당자 | 루트 `.env` 작업본 | `docker compose config` bind mount, 실제 폴더 생성/writable 확인 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4, 7장 | [ ] |
| `BACKEND_TMP_HOST_PATH` 값 | 미기입 | 인프라 담당자 | 루트 `.env` 작업본 | `docker compose config` bind mount, 실제 폴더 생성/writable 확인 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4, 7장 | [ ] |
| `BACKEND_BACKUPS_HOST_PATH` 값 | 미기입 | 인프라 담당자 | 루트 `.env` 작업본 | `docker compose config` bind mount, 실제 폴더 생성/writable 확인, 수동 백업 산출물 위치 대조 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4, 7장 | [ ] |
| `APP_SCALE_RESOURCE_PATH` 값 또는 배치 방식 | `classpath:scales` 유지 또는 외부 경로 | 애플리케이션 운영 담당자 | direct runtime 환경설정 또는 내부 운영 문서 | health `scaleRegistryStatus=UP`, `loadedScaleCount=9` 확인 | 외부 경로를 쓰기로 했다면 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 6장 health 확인 전, 기본 `classpath:scales` 유지면 기록만 남기고 계속 진행 가능 | [ ] |
| `APP_DB_DUMP_COMMAND` 값 또는 운영 대체 수단 | 미기입 | DB 관리자 또는 실제 운영 반영 담당자 | 루트 `.env` 작업본, 내부 운영 문서 | dump 바이너리 존재 여부 또는 운영 대체 백업 절차 문서 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 6장 수동 백업 확인 전, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 9장 admin smoke 전 | [ ] |
| `APP_FORWARD_HEADERS_STRATEGY` 값 | 미기입 | 인프라 담당자 | 루트 `.env` 작업본 | reverse proxy 사용 여부와 값 대조 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장, 6장 | [ ] |
| `APP_TRUST_PROXY_HEADERS` 값 | 미기입 | 인프라 담당자 | 루트 `.env` 작업본 | reverse proxy 구성, activity log IP 검수 계획과 대조 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장, 6장 | [ ] |

### 6.2 직접 실행 경로 참고값

아래 항목은 Windows Service/NSSM/WinSW 등으로 backend 를 직접 실행할 때만 채운다. Docker Compose 운영만 쓸 계획이면 `직접 실행 안 함` 으로 남긴다.

| 항목 | 실제 입력값 또는 보관 위치 | 누가 채우는지 | 어디에 반영하는지 | 무엇으로 검증하는지 | 비어 있으면 어디서 중단하는지 | 완료 |
|---|---|---|---|---|---|---|
| direct runtime 참고 예제 | `docs/examples/production-runtime.env.example` | 실제 운영 반영 담당자 | 서비스 환경설정 문서 | direct runtime 작업본이 예제 기준으로 작성됐는지 확인 | 직접 실행 경로를 선택했다면 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장 전 | [ ] |
| `APP_DB_URL` 값 | 미기입 또는 `직접 실행 안 함` | DB 관리자 또는 실제 운영 반영 담당자 | 서비스 환경변수, 운영 서버 작업본 | `APP_DB_URL_DOCKER` 와 host/port/name/query 기준 대조, direct health 확인 | 직접 실행 경로를 선택했다면 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, 아니면 해당 없음 | [ ] |
| `APP_LOG_FILE_PATH` 값 | 미기입 또는 `직접 실행 안 함` | 인프라 담당자 | 서비스 환경변수, 운영 서버 작업본 | 실제 폴더 생성/writable 확인 | 직접 실행 경로를 선택했다면 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, 아니면 해당 없음 | [ ] |
| `APP_EXPORT_TEMP_PATH` 값 | 미기입 또는 `직접 실행 안 함` | 인프라 담당자 | 서비스 환경변수, 운영 서버 작업본 | 실제 폴더 생성/writable 확인 | 직접 실행 경로를 선택했다면 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, 아니면 해당 없음 | [ ] |
| `APP_BACKUP_ROOT_PATH` 값 | 미기입 또는 `직접 실행 안 함` | 인프라 담당자 | 서비스 환경변수, 운영 서버 작업본 | 실제 폴더 생성/writable 확인 | 직접 실행 경로를 선택했다면 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, 아니면 해당 없음 | [ ] |

---

## 7. `schema.sql` 적용과 preflight 실행 정보

| 항목 | 실제 입력값 또는 보관 위치 | 누가 채우는지 | 어디에 반영하는지 | 무엇으로 검증하는지 | 비어 있으면 어디서 중단하는지 | 완료 |
|---|---|---|---|---|---|---|
| `mysql` CLI 사용 가능 여부 | 미기입 | DB 관리자 | 내부 운영 문서 | 대상 실행 위치에서 `mysql --version` 또는 동등 수단 확인 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장, 6장 | [ ] |
| `schema.sql` 적용 도구 또는 실행 파일 | 미기입 | DB 관리자 | 내부 운영 문서 | 실제 실행 명령 또는 콘솔 경로 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장, 6장 | [ ] |
| `schema.sql` 실제 적용 실행 위치 | 미기입 | DB 관리자 | 내부 운영 문서 | jump server, DB 콘솔, 대상 운영 호스트 중 어디서 실행할지 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 4장 전 | [ ] |
| `schema.sql` 적용 담당자 | 미기입 | DB 관리자 또는 실제 운영 반영 담당자 | 내부 운영 문서, 결과 문서 | 담당자 지정 여부 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| `schema.sql` 적용 검수자 | 미기입 | 실제 운영 검수자 | 내부 운영 문서, 결과 문서 | 검수자 지정 여부 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장, [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 5장 | [ ] |
| `docker compose config` 실행자와 기록 위치 | 미기입 | 실제 운영 반영 담당자 | 운영 점검 메모, 결과 문서 | 실행 결과 캡처, 메모, 명령 이력 확인 | [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 6장, [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 3.4 | [ ] |
| health 확인 수행자 | 미기입 | 실제 운영 반영 담당자 또는 검수자 | 운영 점검 메모, 결과 문서 | `scripts/health-check.bat` 또는 동등 명령 실행 주체 확인 | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 6장 | [ ] |
| health 기대 기준 | `status=UP`, `appStatus=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP`, `loadedScaleCount=9` | 입력 시트 작성자 또는 검수자 | 운영 점검 메모, 결과 문서 | 실제 health 응답과 기대 기준 대조 | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 6장, [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 4장 | [ ] |

`mysql` CLI 가 없으면 아래 중 하나를 실제로 확보해야 한다.

- DB 관리 콘솔에서 SQL 파일 적용
- DBA 점프 서버에서 `mysql` 또는 동등 CLI 실행
- 운영팀이 승인한 배치 스크립트 또는 자동화 작업

수단이 정해지지 않으면 실제 운영 반영 단계로 넘어가지 않는다.

---

## 8. 초기 관리자 준비와 운영 스모크 입력값

| 항목 | 실제 입력값 또는 보관 위치 | 누가 채우는지 | 어디에 반영하는지 | 무엇으로 검증하는지 | 비어 있으면 어디서 중단하는지 | 완료 |
|---|---|---|---|---|---|---|
| 초기 관리자 준비 방식 | `회원가입 신청 -> DB 수동 승격 -> 최초 로그인 확인` | 서비스 운영 책임자 | 내부 운영 문서 | 절차 합의 여부 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 4장, [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 4장 | [ ] |
| 초기 관리자 신청 수행자 | 미기입 | 서비스 운영 책임자 | 내부 운영 문서, 결과 문서 | 신청 수행자 지정 여부 확인 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 5장, 6장 | [ ] |
| 초기 관리자 로그인 ID 보관 위치 | 미기입 | 서비스 운영 책임자 | 비밀 저장소 또는 로컬 작업본 | 회원가입 신청 후 실제 `loginId` 와 보관 위치 대조 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 6장, 7장 | [ ] |
| 초기 관리자 임시 비밀번호 보관 위치 | 미기입 | 비밀 관리 담당자 | 비밀 저장소 | 로그인 검수 시 사용할 비밀번호 보관 위치 확인 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 6장, 8장 | [ ] |
| 승격 SQL 작업본 위치 | 미기입 | 실제 운영 반영 담당자 | 로컬 작업본 또는 승인된 내부 저장소 | `scripts/sql/initial-admin-promote.template.sql` 복사본 경로 확인 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 4장, [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 7장 | [ ] |
| 승격 SQL 실행자 | 미기입 | DB 관리자 또는 실제 운영 반영 담당자 | 내부 운영 문서, 결과 문서 | 실행자 지정 여부 확인 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 7장 | [ ] |
| 최초 관리자 로그인 검수자 | 미기입 | 실제 운영 검수자 | 내부 운영 문서, 결과 문서 | 검수자 지정 여부 확인 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 8장 | [ ] |
| 일반 사용자 검증 계정 확보 위치 | 미기입 | 서비스 운영 책임자 | 내부 운영 문서 또는 기존 계정 목록 참조 | 관리자 메뉴 미노출 검증에 쓸 계정 존재 여부 확인 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 8장 | [ ] |
| `scripts/admin-smoke-check.bat` 실행 base URL | 미기입 또는 `사용 안 함` | 실제 운영 반영 담당자 | 운영 점검 메모, 배치 스크립트 실행 명령 | base URL 이 실제 backend URL 과 일치하는지 확인 | 스크립트를 쓰기로 했다면 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 8장, [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 6장 전 | [ ] |
| `scripts/admin-smoke-check.bat` 에 넘길 관리자 login ID 출처 | 미기입 또는 `사용 안 함` | 실제 운영 반영 담당자 | 운영 점검 메모 | 내장 기본값이 아니라 실제 bootstrap 계정 출처를 적었는지 확인 | 스크립트를 쓰기로 했다면 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 8장 전 | [ ] |
| `scripts/admin-smoke-check.bat` 에 넘길 관리자 비밀번호 보관 위치 | 미기입 또는 `사용 안 함` | 비밀 관리 담당자 | 비밀 저장소, 운영 점검 메모 참조란 | 비밀번호가 저장소 밖 위치에 있고 검수자에게 전달 가능한지 확인 | 스크립트를 쓰기로 했다면 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 8장 전 | [ ] |

초기 관리자 승격 원본 템플릿:

- `scripts/sql/initial-admin-promote.template.sql`

실제 값은 템플릿 복사본에만 넣고 저장소 원본은 수정하지 않는다.

---

## 9. 최종 확인 체크

- [ ] 3장 메타데이터가 닫혀 있고, 실제 운영 반영 담당자와 검수자가 정해졌다.
- [ ] 4장 접근 정보가 닫혀 있어 운영 URL, backend direct URL, health ACL 위치를 바로 찾을 수 있다.
- [ ] 5장 DB 정보가 닫혀 있어 DB host/port/name, 관리자 계정, 앱 계정, 비밀번호 보관 위치를 바로 찾을 수 있다.
- [ ] 6.1 Docker Compose 운영 경로의 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER`, host path, proxy 정책, dump 정책이 닫혔다.
- [ ] direct runtime 경로를 사용할 계획이면 6.2 항목도 닫혔고, 아니면 `직접 실행 안 함` 으로 명시했다.
- [ ] 7장 `schema.sql` 적용 수단, 실행 위치, 담당자, 검수자, health 기대 기준이 닫혔다.
- [ ] 8장 초기 관리자 신청/승격/로그인 검수 담당자와 작업본 위치가 닫혔다.
- [ ] `scripts/admin-smoke-check.bat` 를 쓸 계획이면 base URL, login ID 출처, 비밀번호 보관 위치를 적었고, 명시적 인자 또는 환경변수 없이 실행하지 않는다는 점을 확인했다.
- [ ] 실제 운영값은 저장소 원본이 아니라 이 시트 복사본, 대상 서버 작업본, 비밀 저장소, 내부 운영 문서에만 남긴다.
- [ ] 이 시트 복사본만 열어도 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) -> [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) -> [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) -> [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 순서로 다음 작업을 바로 시작할 수 있다.
