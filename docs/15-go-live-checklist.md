# Go-Live Checklist

## 1. 목적

- 이 문서는 실제 운영 시작 직전 최종 점검 순서와 통과 여부를 확인하는 저장소 기준 체크리스트다.
- 이 문서는 실제 운영 성공, 실제 운영 반영 완료, 실제 로그인 성공을 선언하는 결과 문서가 아니다.
- 현재 저장소 기준으로 로컬 Docker Compose 검증, 로컬 MariaDB runtime 검증, custom admin 브라우저 검증, 전체 척도 8종 커버 검증, 운영 입력 시트/배포 절차/bootstrap 절차/prod config 체크리스트 정리는 끝났지만 실제 운영 시작은 아직 미실행이다.
- 따라서 아직 실제 운영에서 실행하지 않은 항목은 성공처럼 쓰지 않고, 실제 운영값도 추측해서 채우지 않는다.
- 실제 운영 입력값 작업본은 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서에서만 관리한다.
- 실제 운영 시작 결과와 성공/실패 판정은 `docs/deploy-results/YYYY-MM-DD.md` 또는 내부 운영 결과 문서에만 기록한다.
- 아래 문서를 함께 본다.
  - [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md)
  - [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md)
  - [docs/19-production-bootstrap.md](./19-production-bootstrap.md)
  - [docs/20-production-input-sheet.md](./20-production-input-sheet.md)
  - [docs/14-deploy-result-template.md](./14-deploy-result-template.md)

---

## 2. go-live 시작 전 선행 조건

| 항목 | 확인 기준 | 기록 위치 | 완료 |
|---|---|---|---|
| [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 최종 확인 체크 완료 | 복사본 또는 내부 운영 문서 기준으로 실제 운영 입력값, 담당자, 기록 위치, 최종 확인 체크가 모두 정리되었다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| 실제 운영값 기록 위치 확정 | 실제 운영값은 저장소 원본이 아니라 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서에서만 관리한다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| `schema.sql` 선적용 완료 또는 적용 검수 완료 | 운영 기준 `spring.jpa.hibernate.ddl-auto=validate` 이므로 `backend/src/main/resources/schema.sql` 이 외부 MariaDB 에 먼저 적용되었거나 적용 검수 결과가 있다 | 내부 운영 문서, DB 작업 기록 | [ ] |
| 운영용 `.env` 작업본 준비 완료 | 운영용 `.env` 는 `.env.docker.example` 기반 작업본으로 준비하고, 실제 값은 대상 서버 작업본에만 넣는다 | 대상 서버 작업본, 내부 운영 문서 | [ ] |
| 운영용 `.env` 필수값 점검 완료 | `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 가 모두 실제 운영 기준으로 확정되었다 | 대상 서버 작업본, 내부 운영 문서 | [ ] |
| `docker compose config` 대조 완료 | backend 환경값과 host path 값이 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 일치한다 | 내부 운영 문서, 운영 점검 메모 | [ ] |
| 실제 운영 DB 연결 기준 확인 | `APP_DB_URL_DOCKER` 가 비어 있지 않고 placeholder, `jdbc:h2:` 류 값, 테스트/로컬 DB 주소가 아니며 실제 운영 외부 MariaDB JDBC URL 로 대조되었다 | 대상 서버 작업본, 내부 운영 문서 | [ ] |
| health 정상 확인 완료 | backend health 가 HTTP 200, `status=UP`, `appStatus=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP` 또는 동등 기준으로 확인되었다 | 운영 점검 메모, 결과 문서 | [ ] |

중요:
- 위 항목 중 하나라도 비어 있거나 미확인이면 실제 운영 시작 단계로 넘어가지 않는다.
- `schema.sql` 선적용, 운영용 `.env` 필수값 점검, `docker compose config` 대조, health 정상 확인이 끝나기 전에는 bootstrap 과 운영 스모크 테스트로 넘어가지 않는다.

---

## 3. 비밀값 기록 금지 원칙

- 저장소 원본에는 실제 비밀번호, 실제 운영 계정명, 실제 운영 서버 주소, 실제 JDBC URL 을 적지 않는다.
- 실제 운영값은 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서에서만 관리한다.
- 실제 비밀값은 운영 비밀 저장소, 사내 암호 금고, 보안 티켓 등 저장소 밖 위치에만 기록한다.
- 실제 운영 `.env` 는 대상 서버 작업본으로만 만들고 커밋하지 않는다.
- 실제 값이 들어간 SQL 작업본, 메모, 스크린샷, 임시 파일은 저장소에 커밋하지 않는다.
- 실제 값이 아직 확보되지 않았으면 추측해서 채우지 않고 `미정` 또는 미확인 상태로 남긴다.

---

## 4. 초기 관리자 bootstrap 관련 확인

| 항목 | 확인 기준 | 기록 위치 | 완료 |
|---|---|---|---|
| seed 관리자 자동 생성 비활성 이해 | 운영 기준 `app.seed.enabled=false` 이므로 seed 관리자 계정이 자동 생성되지 않는다는 점을 운영 담당자와 검수자가 모두 이해했다 | 내부 운영 문서 | [ ] |
| 초기 관리자 준비 순서 확정 | 초기 관리자 bootstrap 은 `회원가입 신청 -> DB 수동 승격 -> 최초 로그인 확인` 순서로만 진행한다 | 내부 운영 문서 | [ ] |
| 회원가입 신청 기반 준비 원칙 확인 | 초기 관리자도 먼저 회원가입 신청으로 `users` 와 `user_approval_requests` 를 생성하고 직접 `INSERT` 로 만들지 않는다 | 내부 운영 문서 | [ ] |
| bootstrap 시작 전 앱 상태 확인 | 회원가입 신청 단계로 들어가기 전 앱은 실제 운영 DB 를 바라보는 상태로 이미 기동되어 있고 backend health 가 정상이다 | 운영 점검 메모, 결과 문서 | [ ] |
| 승격 SQL 작업본 관리 방식 확인 | `scripts/sql/initial-admin-promote.template.sql` 원본은 수정하지 않고 복사본 작업본에서만 실제 값을 넣는다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| 최초 로그인 확인 완료 기준 이해 | DB 수동 승격 후 `/login` 로그인 성공, 관리자 메뉴 접근 가능, 승인 상태 정합성 확인이 끝나기 전에는 bootstrap 완료로 보지 않는다 | 운영 점검 메모, 결과 문서 | [ ] |

중요:
- 위 항목 중 하나라도 비어 있거나 미확인이면 초기 관리자 bootstrap 완료로 보지 않는다.
- seed 관리자 계정이 없다는 이유만으로 이상 상태로 판단하지 않고, 반드시 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 절차를 따른다.

---

## 5. go-live 직전 최종 점검 체크

아래 항목은 실제 운영 시작 직전에 다시 한 번 닫는 최종 게이트다.
아직 실제 운영에서 실행하지 않은 항목은 체크하지 않고 비워 둔다.

| 항목 | 최소 확인 기준 | 결과 기록 위치 | 완료 |
|---|---|---|---|
| 선행 조건 전체 재확인 | 2장의 선행 조건 항목이 모두 닫혔다 | 내부 운영 문서, 결과 문서 | [ ] |
| 실제 운영값 작업본 재확인 | 실제 운영값과 비밀값 위치가 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서 기준으로 최신 상태다 | 로컬 작업본, 내부 운영 문서 | [ ] |
| 대상 서버 `.env` 재확인 | 실제 운영 `.env` 필수값이 대상 서버 작업본에 반영되어 있고 저장소 원본에 남아 있지 않다 | 대상 서버 작업본, 내부 운영 문서 | [ ] |
| `docker compose config` 최종 대조 | backend 환경값과 `BACKEND_LOGS_HOST_PATH`, `BACKEND_TMP_HOST_PATH`, `BACKEND_BACKUPS_HOST_PATH` 가 작업본과 일치한다 | 운영 점검 메모, 내부 운영 문서 | [ ] |
| backend 상태 확인 | `docker compose ps` 또는 동등 수단으로 backend 가 기동 상태이며 실제 운영 DB 기준 health 가 정상이다 | 운영 점검 메모, 결과 문서 | [ ] |
| 초기 관리자 준비 상태 확인 | seed 관리자 자동 생성이 아니라 bootstrap 절차 기준으로 최초 관리자 준비 상태를 확인했다 | 운영 점검 메모, 결과 문서 | [ ] |

중요:
- 위 항목 중 하나라도 비어 있거나 미확인이면 실제 운영 시작 단계로 넘어가지 않는다.
- 실제 운영 미실행 상태를 성공처럼 적지 않는다.

---

## 6. 운영 스모크 테스트 체크

아래 항목이 실제 운영 기준 최소 확인 범위다.
아직 실제 운영 반영을 하지 않았다면 성공처럼 쓰지 말고, 실제 실행 후에만 체크한다.

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

## 7. 중단 조건

아래 항목 중 하나라도 해당되면 실제 운영 시작 단계로 넘어가지 않는다.

- 2장의 go-live 시작 전 선행 조건 중 하나라도 비어 있거나 미확인이다.
- 실제 운영값이 저장소 원본에 적혀 있거나, [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서 기준 기록 위치가 확정되지 않았다.
- 실제 값을 추측해서 채우고 있다.
- `backend/src/main/resources/schema.sql` 선적용 또는 적용 검수 결과가 비어 있거나 미확인이다.
- 운영용 `.env` 필수값 `APP_DB_URL_DOCKER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 중 하나라도 비어 있다.
- `APP_DB_URL_DOCKER` 가 비어 있거나, placeholder 이거나, `jdbc:h2:` 류 값이거나, 테스트/로컬 DB 주소이거나, 실제 운영 외부 MariaDB JDBC URL 로 대조되지 않았다.
- `docker compose config` 결과 대조가 끝나지 않았거나 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 작업본과 다르다.
- backend health 가 비정상이거나, 앱이 실제 운영 DB 를 본다는 근거가 없다.
- 운영 기준 `app.seed.enabled=false` 임에도 seed 관리자 자동 생성을 기대하고 있다.
- 초기 관리자 bootstrap 이 `회원가입 신청 -> DB 수동 승격 -> 최초 로그인 확인` 순서로 준비되지 않았다.
- 운영 스모크 테스트 최소 확인 범위 중 하나라도 실패했거나, 아직 확인하지 않은 항목을 성공처럼 기록하려고 한다.
- 실제 운영 미실행 상태를 실제 운영 성공처럼 서술하려고 한다.

---

## 8. 결과 기록 위치

- 실제 운영 시작 결과와 시각, 성공/실패 판정, 중단 사유, 스모크 테스트 결과는 `docs/deploy-results/YYYY-MM-DD.md` 또는 내부 운영 결과 문서에만 기록한다.
- 실제 운영 입력값, 비밀값 위치, 담당자, 작업본 경로는 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본 또는 내부 운영 문서에서만 관리한다.
- 실제 운영 미실행 상태라면 결과 문서에는 `미실행` 으로 명시하고 성공처럼 적지 않는다.
- 현재 저장소 기준 본 문서는 실제 운영 시작 직전 체크리스트이며, 실제 운영 성공 결과 문서를 대체하지 않는다.
