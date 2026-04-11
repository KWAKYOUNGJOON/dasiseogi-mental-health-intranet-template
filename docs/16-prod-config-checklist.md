# Prod Config Checklist

## 1. 목적

- 이 문서는 실제 운영 반영 전에 반드시 닫아야 하는 운영 설정 선행 조건과 점검 범위를 정리하는 저장소 기준 체크리스트다.
- 이 문서는 실제 운영 성공, 실제 운영 반영 완료, 실제 로그인 성공을 선언하는 결과 문서가 아니다.
- 실제 운영 반영 절차는 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md), 최초 관리자 bootstrap 절차는 [docs/19-production-bootstrap.md](./19-production-bootstrap.md), 실제 운영 입력값 작업본은 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 를 기준으로 본다.
- 실제 값 입력은 저장소 원본이 아니라 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서에서만 진행한다.
- 실제 값이 아직 확보되지 않았으면 추측해서 채우지 않고 `미정` 으로 남긴다.

### 1.1 문서 진행 순서

이 문서는 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 2장 선행 조건이 닫힌 뒤에 본다.

1. [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본에서 실제 입력값과 담당자, 검증 수단, 중단 지점을 먼저 닫는다.
2. 이 문서 5장 공통 메타데이터와 운영 설정 사전 확인 체크를 닫는다.
3. 6장 `schema.sql` / `.env` / `docker compose config` / health 선행 조건을 닫는다.
4. 7장 초기 관리자 bootstrap 관련 체크로 bootstrap 시작 금지 조건을 다시 닫는다.
5. 이후 실제 반영은 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 로 넘어가고, health 정상 후 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 를 본다.

---

## 2. 비밀값 기록 금지 원칙

- 저장소 원본에는 실제 비밀번호, 실제 운영 계정명, 실제 운영 서버 주소, 실제 JDBC URL 을 적지 않는다.
- 실제 비밀값은 운영 비밀 저장소, 사내 암호 금고, 보안 티켓 등 저장소 밖 위치에만 기록한다.
- 실제 운영 `.env` 는 대상 서버 작업본으로만 만들고 커밋하지 않는다.
- `scripts/sql/initial-admin-promote.template.sql` 원본은 수정하지 않고, 실제 값은 복사한 로컬 작업본에만 넣는다.
- 실제 반영 결과와 성공/실패 판정은 이 문서가 아니라 `docs/deploy-results/YYYY-MM-DD.md` 에만 기록한다.

---

## 3. 기록 위치 기준

| 구분 | 기록 원칙 | 예시 |
|---|---|---|
| 실제 비밀값 | 저장소 밖 보안 저장소에만 기록 | DB 비밀번호, 초기 관리자 임시 비밀번호 |
| 실제 운영 주소/계정/담당자 | 저장소 밖 로컬 작업본 또는 내부 운영 문서에 기록 | [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본, 내부 위키, 운영 티켓 |
| 실제 런타임 환경값 | 대상 서버 작업본에만 기록 | 루트 `.env`, Windows Service/NSSM/WinSW 환경변수 |
| 실제 승격 SQL 작업본 | 템플릿 복사본에만 기록 | `initial-admin-promote.sql` 로컬 사본 |
| 실제 반영 결과 | 실제 운영 반영 후 결과 문서에만 기록 | `docs/deploy-results/YYYY-MM-DD.md` |

---

## 4. 공통 메타데이터

| 항목 | 현재 값 |
|---|---|
| 대상 환경 이름 | 미정 |
| 운영 입력값 수집 담당자 | 미정 |
| 실제 운영 반영 담당자 | 미정 |
| 실제 운영 검수자 | 미정 |
| 입력값 최종 검토 일시 | 미정 |
| 입력값 작업본 위치 | 미정 |

---

## 5. 운영 설정 사전 확인 체크

| 항목 | 확인 기준 | 기록 위치 | 완료 |
|---|---|---|---|
| [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크 | 복사본 또는 내부 운영 문서 기준으로 실제 운영 입력값, 담당자, 기록 위치, 최종 확인 체크가 모두 정리되었다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| 실제 운영값 기록 위치 확정 | 저장소 원본이 아니라 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서에만 실제 값을 기록하기로 확정했다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| 실제 운영 접근 정보 확보 | 실제 운영 호스트, 실제 운영 URL, backend 직접 확인 주소 또는 포트, `/api/v1/health` 허용 범위가 정리되었다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| 실제 운영 DB 정보 확보 | 실제 운영 DB host/port/name, DB 관리자 계정, 앱 계정, 비밀번호 보관 위치가 정리되었다 | 로컬 작업본, 비밀 저장소 참조 문서 | [ ] |
| 운영용 `.env` 작성 방식 확보 | 루트 `.env` 작성 위치, 관리 방식, `APP_SERVER_PORT`, `APP_FRONTEND_PORT`, `APP_HEALTHCHECK_PATH`, `APP_BACKEND_UPSTREAM_HOST`, 로그/임시/export/백업 경로값 결정 주체가 정리되었다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| `schema.sql` 선적용 수단 확보 | `backend/src/main/resources/schema.sql` 적용 도구, 실행 위치, 담당자, 검수자가 정리되었다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| bootstrap 수행자 확보 | 초기 관리자 회원가입 신청 수행자, DB 수동 승격 SQL 실행자, 최초 로그인 검수자가 정리되었다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| reverse proxy / health 정책 확정 | `APP_FORWARD_HEADERS_STRATEGY`, `APP_TRUST_PROXY_HEADERS`, health ACL 적용 위치가 정리되었다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| 운영 점검 결과 기록 위치 확정 | 실제 운영 점검 결과는 `docs/deploy-results/YYYY-MM-DD.md` 또는 내부 운영 결과 문서에만 남기기로 확정했다 | 내부 운영 문서 | [ ] |

---

## 6. schema.sql / .env / docker compose config / health 선행 조건

- [ ] 운영 기준 `spring.jpa.hibernate.ddl-auto=validate` 이므로, 외부 MariaDB 에 `backend/src/main/resources/schema.sql` 이 먼저 적용되기 전에는 backend 를 `prod` 로 기동하지 않는다.
- [ ] 운영 기준 `backend/src/main/resources/schema.sql` 선적용 완료 또는 적용 검수 완료가 확인되지 않으면 실제 운영 반영 단계로 넘어가지 않는다.
- [ ] [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서의 최종 확인 체크가 닫히기 전에는 실제 운영 반영 단계로 넘어가지 않는다.
- [ ] 운영용 `.env` 는 `.env.docker.example` 기반 작업본으로 준비하고, 실제 값은 저장소 원본이 아닌 대상 서버 작업본에만 넣는다.
- [ ] 운영용 `.env` 필수값 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 는 모두 실제 운영 기준으로 먼저 확정한다.
- [ ] `docker compose up -d` 전에 `docker compose config` 를 먼저 실행하고, backend 환경값의 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 를 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 대조한다.
- [ ] `docker compose config` 결과의 backend 환경값이 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 다르면 실제 운영 반영으로 넘어가지 않는다.
- [ ] `APP_DB_URL_DOCKER` 가 비어 있거나, placeholder 이거나, `jdbc:h2:` 류 값이거나, 테스트/로컬 DB 주소이거나, 실제 운영 외부 MariaDB JDBC URL 로 확정되지 않았으면 진행하지 않는다.
- [ ] `APP_SERVER_PORT`, `APP_FRONTEND_PORT`, `APP_HEALTHCHECK_PATH`, `APP_BACKEND_UPSTREAM_HOST` 도 `docker compose config` 결과와 운영 작업본 기준으로 먼저 대조한다.
- [ ] `BACKEND_LOGS_HOST_PATH`, `BACKEND_TMP_HOST_PATH`, `BACKEND_BACKUPS_HOST_PATH` 도 `docker compose config` 결과와 운영 작업본 기준으로 먼저 대조한다.
- [ ] `APP_SESSION_TIMEOUT`, `APP_FORWARD_HEADERS_STRATEGY`, `APP_TRUST_PROXY_HEADERS`, `APP_DB_DUMP_COMMAND` 도 운영 정책과 현재 compose 기본값 기준으로 확인한다.
- [ ] backend health 가 `status=UP`, `appStatus=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP` 또는 동등 기준으로 정상 확인되기 전에는 bootstrap 과 운영 스모크 테스트로 넘어가지 않는다.

주의:
- 현재 backend Docker entrypoint 와 `application-prod.yml` / prod runtime guard 는 DB Docker 환경값이 비어 있거나 placeholder 이거나 `jdbc:h2:` 면 즉시 실패한다.
- 따라서 DB 환경값 대조와 `docker compose config` 확인 전에 `docker compose up -d` 를 먼저 실행하지 않는다.

다음 단계:
- 6장의 항목이 모두 닫히면 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) 2.1, 3.4, 4장, 6장 순서로 실제 반영 전 점검을 진행한다.
- 6장의 항목이 비어 있으면 `docker compose up -d` 와 bootstrap 으로 넘어가지 않는다.

---

## 7. 초기 관리자 bootstrap 관련 체크

- [ ] 운영 기준 `app.seed.enabled=false` 이므로 seed 관리자 계정이 자동 생성되지 않는다는 점을 운영 담당자와 검수자가 모두 이해했다.
- [ ] 초기 관리자 준비는 `회원가입 신청 -> DB 수동 승격 -> 최초 로그인 확인` 순서로만 진행한다.
- [ ] 초기 관리자도 먼저 회원가입 신청으로 `users` 와 `user_approval_requests` 를 생성하고, 직접 `INSERT` 로 만들지 않는다.
- [ ] 회원가입 신청 단계로 들어가기 전 앱은 실제 운영 DB 를 바라보는 상태로 이미 기동되어 있고 backend health 가 정상이다.
- [ ] `scripts/sql/initial-admin-promote.template.sql` 원본은 직접 수정하지 않고, 복사한 로컬 작업본에서만 실제 `loginId` 와 메모를 치환한다.
- [ ] DB 수동 승격 전 `users.role = USER`, `users.status = PENDING`, 최신 `user_approval_requests.request_status = PENDING` 확인 기준을 먼저 알고 있다.
- [ ] DB 수동 승격 후 `/login` 로그인 성공, 관리자 메뉴 노출, 승인 상태 정합성 확인이 끝나기 전에는 bootstrap 완료로 보지 않는다.

다음 단계:
- 7장의 항목이 닫힌 뒤 실제 bootstrap 실행은 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 4장~8장 순서로 진행한다.
- 7장이 비어 있으면 bootstrap 단계로 넘어가지 않는다.

---

## 8. 운영 스모크 테스트 체크

아래 항목은 실제 운영 반영 직전 또는 실제 운영 반영 직후 최소 운영 점검 범위다.
아직 실제 운영 반영을 하지 않았다면 성공처럼 쓰지 말고, 기준만 남긴 채 결과는 비워 둔다.

| 점검 항목 | 최소 확인 기준 | 결과 기록 위치 | 완료 |
|---|---|---|---|
| `health` endpoint 확인 | HTTP 200, `status=UP`, `appStatus=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP`, `loadedScaleCount` 가 기대 척도 수와 일치한다 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| 관리자 로그인 확인 | bootstrap 또는 기존 운영 관리자 계정으로 로그인 성공 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| 관리자 메뉴 접근 확인 | 관리자 메뉴 접근이 가능하고 일반 사용자 계정에서는 관리자 메뉴가 노출되지 않는다 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| 대상자 생성 확인 | 신규 대상자 생성 성공, `clientNo` 생성, 상세 화면 또는 응답 정상 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| 최소 2종 세션 저장 확인 | 예: `PHQ-9 + GAD-7` 조합 등 최소 2종 척도 세션 저장 성공, `sessionNo` 생성 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| 세션 상세 확인 | 방금 저장한 세션 상세 화면이 정상 열리고 총점, 판정, 경고, 문항 응답 표시가 정상이다 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| `print view` 확인 | 같은 세션의 `print view` 가 정상 표시되고 인쇄 화면까지 확인되며 세션 메모는 포함되지 않는다 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| `statistics` 확인 | `statistics/summary`, `statistics/scales`, `statistics/alerts` 가 모두 정상 응답하고 최신 저장 데이터가 집계에 반영된다 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| `CSV export` 확인 | 관리자 계정 기준 다운로드 성공, 빈 파일 아님, 인코딩 또는 컬럼 깨짐 없음 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| 활동 로그 확인 | 로그인, 대상자 생성, 세션 저장, `print view`, export, 백업 등 주요 행위가 최신순으로 남는다 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |
| 수동 백업 확인 | 운영에서 사용하기로 한 수동 백업 절차 1회 확인, 백업 이력과 실제 산출물 또는 운영 승인 대체 수단이 일치한다 | `docs/deploy-results/YYYY-MM-DD.md`, 내부 운영 결과 문서 | [ ] |

---

## 9. 중단 조건

아래 항목 중 하나라도 해당되면 실제 운영 반영 단계로 넘어가지 않는다.

- [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서의 최종 확인 체크가 끝나지 않았다.
- 실제 운영값이 저장소 원본에만 적혀 있거나, 보안 저장소 밖에 흩어져 있어 참조 위치가 확정되지 않았다.
- `backend/src/main/resources/schema.sql` 선적용 또는 적용 검수 결과가 비어 있거나 미확인이다.
- 운영용 `.env` 필수값 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 중 하나라도 비어 있다.
- `APP_DB_URL_DOCKER` 가 비어 있거나, placeholder 이거나, `jdbc:h2:` 류 값이거나, 테스트/로컬 DB 주소이거나, 실제 운영 외부 MariaDB JDBC URL 로 대조되지 않았다.
- `docker compose config` 결과 대조가 끝나지 않았거나 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 다르다.
- backend health 가 비정상이거나, 앱이 실제 운영 DB 를 본다는 근거가 없다.
- 초기 관리자 bootstrap 이 `회원가입 신청 -> DB 수동 승격 -> 최초 로그인 확인` 순서로 준비되지 않았다.
- 운영 스모크 테스트 범위 중 하나라도 실패했거나, 아직 확인하지 않은 항목을 성공처럼 기록하려고 한다.
- 실제 값을 추측해서 채우고 있거나, 실제 운영 미실행 상태를 실제 운영 성공처럼 서술하려고 한다.

---

## 10. 관련 문서

- [docs/15-go-live-checklist.md](./15-go-live-checklist.md)
- [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md)
- [docs/19-production-bootstrap.md](./19-production-bootstrap.md)
- [docs/20-production-input-sheet.md](./20-production-input-sheet.md)
- [.env.docker.example](../.env.docker.example)
- [docs/examples/production-runtime.env.example](./examples/production-runtime.env.example)
- [scripts/sql/initial-admin-promote.template.sql](../scripts/sql/initial-admin-promote.template.sql)
