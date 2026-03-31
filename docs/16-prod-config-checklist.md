# Prod Config Checklist

## 1. 목적

- 이 문서는 실제 운영 반영 전에 반드시 확보해야 하는 입력값과 담당자만 정리하는 저장소 기준 체크리스트다.
- 실제 배포 실행, 실제 DB 적용, 실제 로그인 확인 결과는 이 문서에 기록하지 않는다.
- 실제 운영 반영 절차는 [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md), 최초 관리자 준비는 [docs/19-production-bootstrap.md](./19-production-bootstrap.md) 를 기준으로 본다.
- 실제 값 입력은 이 문서 원본이 아니라 [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 를 복사한 로컬 작업본 또는 내부 운영 문서에서 진행한다.

---

## 2. 작성 원칙

- 저장소 원본에는 실제 비밀번호, 실제 운영 계정명, 실제 운영 서버 주소를 적지 않는다.
- 실제 비밀값은 운영 비밀 저장소, 사내 암호 금고, 보안 티켓 등 저장소 밖 위치에만 기록한다.
- 실제 운영 `.env` 는 대상 서버 작업본으로만 만들고 커밋하지 않는다.
- `scripts/sql/initial-admin-promote.template.sql` 도 원본 그대로 유지하고, 실제 값은 복사한 로컬 작업본에만 넣는다.
- 아직 확보되지 않은 값은 추측하지 않고 `미정` 으로 둔다.
- `완료 확인` 은 아래 3가지가 모두 정해졌을 때만 체크한다.
  - 누가 제공하는지
  - 어디에 기록하는지
  - 누가 검수하는지

---

## 3. 기록 위치 기준

| 구분 | 기록 원칙 | 예시 |
|---|---|---|
| 실제 비밀값 | 저장소 밖 보안 저장소에만 기록 | DB 비밀번호, 초기 관리자 임시 비밀번호 |
| 실제 운영 주소/계정/담당자 | 저장소 밖 로컬 작업본 또는 내부 운영 문서에 기록 | [docs/20-production-input-sheet.md](./20-production-input-sheet.md) 복사본, 내부 위키, 운영 티켓 |
| 실제 런타임 환경값 | 대상 서버 작업본에만 기록 | 루트 `.env`, Windows Service/NSSM/WinSW 환경변수 |
| 초기 관리자 승격 SQL | 템플릿을 복사한 로컬 작업본에만 기록 | `initial-admin-promote.sql` 로컬 사본 |
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

## 5. 운영 입력값 작성형 체크리스트

| 분류 | 값 이름 | 연결 설정 또는 기준 문서 | 설명 | 누가 제공해야 하는지 | 어디에 기록할지 | 필수 여부 | 완료 확인 |
|---|---|---|---|---|---|---|---|
| 운영 접근 | 실제 운영 호스트 | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) | 앱이 실제로 올라갈 대상 서버 호스트명 또는 내부 IP | 인프라 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 운영 접근 | 실제 운영 URL | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) | 사회복지사 사용자가 접속할 실제 운영 URL | 인프라 담당자 또는 웹서버 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 운영 접근 | backend 직접 확인 주소 또는 포트 | `APP_SERVER_PORT`, `/api/v1/health` | health 확인, reverse proxy upstream 확인에 사용할 backend 포트 또는 직접 접속 URL | 인프라 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 운영 접근 | reverse proxy 사용 여부 | `APP_FORWARD_HEADERS_STRATEGY`, `APP_TRUST_PROXY_HEADERS` | proxy 뒤 운영인지, 앱이 직접 노출되는지 여부 | 인프라 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 운영 접근 | health endpoint 허용 범위 | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md), [docs/15-go-live-checklist.md](./15-go-live-checklist.md) | `/api/v1/health` 를 누가 어디서 호출할 수 있는지와 ACL 적용 위치 | 인프라 담당자 또는 보안 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| DB | 실제 운영 DB host | `APP_DB_URL_DOCKER`, `APP_DB_URL` | 실제 운영 DB 서버 주소 | DB 관리자 | 로컬 작업본, 비밀 저장소 참조 문서 | 필수 | [ ] |
| DB | 실제 운영 DB port | `APP_DB_URL_DOCKER`, `APP_DB_URL` | 실제 운영 DB 포트 | DB 관리자 | 로컬 작업본, 비밀 저장소 참조 문서 | 필수 | [ ] |
| DB | 실제 운영 DB name | `APP_DB_URL_DOCKER`, `APP_DB_URL` | 실제 운영 DB 이름 | DB 관리자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| DB | 실제 운영 DB 관리자 계정 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) | `schema.sql` 적용과 초기 관리자 승격 SQL 실행에 사용할 관리자 계정 | DB 관리자 | 비밀 저장소, 로컬 작업본 참조란 | 필수 | [ ] |
| DB | 실제 운영 앱 DB 계정 | `APP_DB_USERNAME` | backend 런타임이 사용할 앱 전용 DB 계정 | DB 관리자 | 비밀 저장소, 루트 `.env` 작업본 | 필수 | [ ] |
| DB | 실제 운영 앱 DB 비밀번호 보관 위치 | `APP_DB_PASSWORD` | 비밀번호 자체가 아니라 어디에 저장했는지와 누가 관리하는지 | DB 관리자 또는 비밀 관리 담당자 | 비밀 저장소, 로컬 작업본 참조란 | 필수 | [ ] |
| DB | DB 계열과 JDBC 드라이버 확정 | `APP_DB_DRIVER` | 기본은 MariaDB 이지만 실제 운영 DB 계열과 일치해야 한다 | DB 관리자 | 로컬 작업본, 루트 `.env` 작업본 | 필수 | [ ] |
| 런타임 | 실제 운영 `.env` 작성 위치 | `.env.docker.example` | 루트 `.env` 를 어느 서버 경로에서 만들지 | 실제 운영 반영 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 런타임 | 실제 운영 `.env` 관리 방식 | `.env.docker.example`, [docs/examples/production-runtime.env.example](./examples/production-runtime.env.example) | Docker Compose 루트 `.env` 인지, Windows Service 환경변수인지, 비밀값 변경 시 누가 갱신하는지 | 실제 운영 반영 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 런타임 | 로그 경로 | `BACKEND_LOGS_HOST_PATH`, `APP_LOG_FILE_PATH` | backend 파일 로그가 남을 실제 경로 | 인프라 담당자 | 루트 `.env` 작업본 또는 서비스 환경설정 | 필수 | [ ] |
| 런타임 | export 임시 경로 | `BACKEND_TMP_HOST_PATH`, `APP_EXPORT_TEMP_PATH` | CSV export 임시 파일이 생성될 실제 writable 경로 | 인프라 담당자 | 루트 `.env` 작업본 또는 서비스 환경설정 | 필수 | [ ] |
| 런타임 | 백업 루트 경로 | `BACKEND_BACKUPS_HOST_PATH`, `APP_BACKUP_ROOT_PATH` | 백업 파일이 생성될 실제 경로 | 인프라 담당자 | 루트 `.env` 작업본 또는 서비스 환경설정 | 필수 | [ ] |
| 런타임 | 척도 JSON 경로 또는 배치 방식 | `APP_SCALE_RESOURCE_PATH` | `classpath:scales` 유지인지, 외부 filesystem 경로인지 | 애플리케이션 운영 담당자 | 로컬 작업본, 서비스 환경설정 | 필수 | [ ] |
| 런타임 | `APP_FORWARD_HEADERS_STRATEGY` 결정값 | `APP_FORWARD_HEADERS_STRATEGY` | reverse proxy 구조에 맞는 전달 헤더 전략 | 인프라 담당자 | 루트 `.env` 작업본 또는 서비스 환경설정 | 필수 | [ ] |
| 런타임 | `APP_TRUST_PROXY_HEADERS` 결정값 | `APP_TRUST_PROXY_HEADERS` | 신뢰 가능한 proxy 뒤면 `true`, 아니면 `false` | 인프라 담당자 | 루트 `.env` 작업본 또는 서비스 환경설정 | 필수 | [ ] |
| DB 적용 도구 | `mysql` CLI 또는 동등 수단 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) | `schema.sql`, 초기 관리자 승격 SQL 을 실제로 적용할 수단 | DB 관리자 또는 실제 운영 반영 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| DB 적용 도구 | DB 적용 실행 위치 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) | DB 서버, 운영 서버, DBA 점프 서버, 관리 콘솔 등 실제 적용 위치 | DB 관리자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 초기 관리자 | 초기 관리자 준비 방식 확정 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md), `scripts/sql/initial-admin-promote.template.sql` | `회원가입 신청 -> DB 수동 승격 -> 최초 로그인 확인` 절차를 그대로 쓸지 확인 | 서비스 운영 책임자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 초기 관리자 | 초기 관리자 회원가입 신청 수행자 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) | 최초 1회 회원가입 신청을 누가 생성할지 | 서비스 운영 책임자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 초기 관리자 | 초기 관리자 승격 SQL 실행자 | `scripts/sql/initial-admin-promote.template.sql` | 복사한 로컬 SQL 작업본에 실제 값을 넣고 실행할 담당자 | DB 관리자 또는 실제 운영 반영 담당자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 초기 관리자 | 초기 관리자 로그인 검수자 | [docs/19-production-bootstrap.md](./19-production-bootstrap.md) | 최초 로그인과 관리자 메뉴 노출을 최종 확인할 사람 | 실제 운영 검수자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 책임 | 실제 운영 반영 담당자 | [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md) | `docker compose`, `.env`, 서버 반영을 실제로 수행할 담당자 | 서비스 운영 책임자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |
| 책임 | 실제 운영 검수자 | [docs/15-go-live-checklist.md](./15-go-live-checklist.md) | 반영 후 URL, 로그인, health, 관리자 기능을 검수할 담당자 | 서비스 운영 책임자 | 로컬 작업본, 내부 운영 문서 | 필수 | [ ] |

---

## 6. 마감 체크

- [ ] 5장 표에서 필수 항목의 `완료 확인` 이 모두 체크되었다.
- [ ] 실제 운영 `.env` 작성 위치와 관리 방식이 결정되었다.
- [ ] 실제 운영 DB host/port/name, DB 관리자 계정, 앱 계정의 제공 주체가 정해졌다.
- [ ] `mysql` CLI 또는 동등한 DB 적용 수단과 실행 위치가 정해졌다.
- [ ] 초기 관리자 준비 방식과 수행자, 검수자가 정해졌다.
- [ ] 실제 운영 반영 담당자와 실제 운영 검수자가 정해졌다.

위 6개가 모두 충족되면 이번 단계의 판정은 `운영 입력값 수집 패키지 정리 완료` 다.
단, 실제 운영 반영과 실제 운영 로그인 확인은 아직 미실행 상태로 남는다.

---

## 7. 관련 문서

- [docs/15-go-live-checklist.md](./15-go-live-checklist.md)
- [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md)
- [docs/19-production-bootstrap.md](./19-production-bootstrap.md)
- [docs/20-production-input-sheet.md](./20-production-input-sheet.md)
- [.env.docker.example](../.env.docker.example)
- [docs/examples/production-runtime.env.example](./examples/production-runtime.env.example)
- [scripts/sql/initial-admin-promote.template.sql](../scripts/sql/initial-admin-promote.template.sql)
