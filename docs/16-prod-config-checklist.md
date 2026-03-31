# Prod Config Checklist

## 1. 목적

- 이 문서는 `backend/src/main/resources/application-prod.yml`, `docs/11-deployment.md`, `docs/12-release-readiness.md`, `docs/13-pre-deploy-runbook.md` 를 대조해 실제 운영 전에 반드시 채워야 하는 값만 추린 체크리스트다.
- 이 문서는 실제 운영값, 담당자, 확인 방법 템플릿만 관리한다.
- 실제 실행 순서, 스모크 테스트, 통과 여부 판정은 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 를 기준으로 본다.
- 범위는 `운영값 확정` 이며 Docker, `docker-compose`, 실제 배포 실행, 운영 서버 접속은 포함하지 않는다.
- 아직 모르는 값은 추측하지 않고 `미정`, `운영팀 입력`, `현장 확인 필요` 로 남긴다.

---

## 2. 사용 원칙

- 실제 비밀값은 Git 문서에 직접 확정 기록하지 말고, 환경 변수 또는 운영 전용 별도 보관 위치를 기준으로 관리한다.
- `현재 상태` 는 현재 저장소 문서와 템플릿 기준 상태를 적는다.
- `운영 시 입력할 값` 은 실제 운영 준비 시점에만 채운다.
- `실제 값 입력 담당자`, `확인 담당자`, `확인 일시` 는 항목별로 남긴다.
- 이 문서에는 배포 실행 순서를 다시 적지 않고, 값 입력 완료 여부와 확인 책임만 남긴다.

---

## 3. 공통 기록란

| 항목 | 값 |
|---|---|
| 대상 환경 | 미정 |
| 실제 값 입력 담당자 | 미정 |
| 확인 담당자 | 미정 |
| 확인 일시 | 미정 |
| 비고 | 미정 |

---

## 4. 운영값 체크리스트

### 4.1 DB 접속 및 드라이버

| 설정 키 | 설명 | 현재 상태 | 운영 시 입력할 값 | 확인 방법 | 실제 값 입력 담당자 | 확인 담당자 | 확인 일시 |
|---|---|---|---|---|---|---|---|
| `APP_DB_URL` | 운영 DB JDBC URL. 운영 DB host, port, DB명, 문자셋/타임존 일관성 확인 대상이다. | `jdbc:mariadb://DB_HOST_PLACEHOLDER:3306/DB_NAME_PLACEHOLDER` placeholder 상태 | 미정, 운영팀 입력 | `application-prod.yml` 또는 운영 환경 변수에 실제 값 반영 후 `/api/v1/health` 의 `dbStatus=UP` 확인, 배포 전 백업 명령 대상 DB 와 일치하는지 대조 | 미정 | 미정 | 미정 |
| `APP_DB_USERNAME` | 운영 앱 전용 DB 계정. root 직접 사용 금지 원칙 점검 대상이다. | `DB_USERNAME_PLACEHOLDER` placeholder 상태 | 미정, 운영팀 입력 | 운영 DB 계정으로 앱 기동과 수동 백업 사전 점검 수행, 최소 권한 계정인지 확인 | 미정 | 미정 | 미정 |
| `APP_DB_PASSWORD` | 운영 앱 전용 DB 계정 비밀번호. 문서에는 직접 값 대신 보관 위치만 남긴다. | `DB_PASSWORD_PLACEHOLDER` placeholder 상태 | 미정, 운영팀 입력 | 실제 값은 외부 비밀값 저장 위치에만 반영, 앱 기동과 수동 백업 점검으로 간접 확인 | 미정 | 미정 | 미정 |
| `APP_DB_DRIVER` | 운영 DB 계열과 일치하는 JDBC 드라이버 클래스명. 기본 템플릿은 MariaDB 기준이다. | 기본값 `org.mariadb.jdbc.Driver` | 미정, 운영 DB 계열 기준 확인 필요 | 운영 DB 계열 결정 후 실제 URL 과 함께 기동 확인, `/api/v1/health` 와 기동 로그에서 datasource 오류 없음 확인 | 미정 | 미정 | 미정 |

### 4.2 서버, 세션, 쿠키, 프록시

| 설정 키 | 설명 | 현재 상태 | 운영 시 입력할 값 | 확인 방법 | 실제 값 입력 담당자 | 확인 담당자 | 확인 일시 |
|---|---|---|---|---|---|---|---|
| `APP_SERVER_PORT` | 운영 backend 실제 포트. health check URL, 프록시 upstream, 접근 통제 기준과 같이 맞춰야 한다. | 기본값 `8080` | 미정, 운영팀 입력 | 프록시 upstream 또는 직접 접속 포트와 일치하는지 확인, `scripts\health-check.bat` 대상 URL 재대조 | 미정 | 미정 | 미정 |
| `APP_SESSION_TIMEOUT` | 세션 기반 인증 유지 시간. 운영 업무 시간과 보안 정책을 함께 고려해야 한다. | 기본값 `120m` | 미정, 운영팀 입력 | 운영 정책 결정 후 로그인 유지 시간 점검, 세션 만료 후 재로그인 흐름 확인 | 미정 | 미정 | 미정 |
| `APP_FORWARD_HEADERS_STRATEGY` | reverse proxy 사용 시 전달 헤더 해석 방식. proxy 미사용이면 기본값 유지 대상이다. | 기본값 `none`, 구체 운영값 미정 | 미정, 현장 프록시 구성 기준 입력 | reverse proxy 사용 여부 확인 후 실제 프록시 전달 헤더와 맞춰 설정, 로그인 후 redirect URL 과 활동 로그 IP 기록 이상 여부 확인 | 미정 | 미정 | 미정 |
| `APP_TRUST_PROXY_HEADERS` | `X-Forwarded-*` 같은 proxy header 신뢰 여부. 잘못 켜면 spoofed IP 기록 위험이 있다. | 기본값 `false` | 미정. 신뢰 가능한 내부 reverse proxy 뒤면 `true` 검토, 아니면 `false` 유지 | reverse proxy 존재 여부 확인, 활동 로그 IP 가 기대값과 일치하는지 확인, 직접 노출 환경이면 `false` 유지 | 미정 | 미정 | 미정 |
| `세션 쿠키 전달 정책(프록시/웹서버)` | 세션/쿠키 기반 인증이 프록시나 웹서버 설정 때문에 깨지지 않도록 쿠키 전달, 재작성, 보안 속성을 점검한다. `application-prod.yml` 에 별도 키는 없고 현장 설정 확인 항목이다. | 문서상 세션/쿠키 기반 흐름 유지 원칙만 존재, 실제 현장 쿠키 처리 방식 미정 | 미정, 운영팀 입력 | 브라우저 로그인 후 `Set-Cookie` 확인, 페이지 이동/새로고침 후 세션 유지 여부 확인, 프록시가 쿠키를 제거하거나 잘못 재작성하지 않는지 확인 | 미정 | 미정 | 미정 |

### 4.3 로그, 백업, 임시 경로

| 설정 키 | 설명 | 현재 상태 | 운영 시 입력할 값 | 확인 방법 | 실제 값 입력 담당자 | 확인 담당자 | 확인 일시 |
|---|---|---|---|---|---|---|---|
| `APP_LOG_FILE_PATH` | 애플리케이션 로그 저장 경로. 권장 기준은 `<app-home>/logs/application` 이다. | `LOG_PATH_PLACEHOLDER` placeholder 상태 | 미정, 운영팀 입력 | 대상 경로 존재 여부와 쓰기 권한 확인, 앱 기동 후 로그 파일 생성 여부 확인 | 미정 | 미정 | 미정 |
| `프록시/웹서버 access log 경로` | 접근 로그를 앱 로그와 분리할 경우 기록 위치. 문서 권장 구조는 `<app-home>/logs/access` 이다. 애플리케이션 설정 키가 아니라 운영 경로 결정 항목이다. | 문서 권장 경로만 존재, 실제 운영 경로 미정 | 미정, 운영팀 입력 | 프록시 또는 웹서버 운영 표준 경로 확인, 앱 로그 경로와 분리되는지 확인 | 미정 | 미정 | 미정 |
| `APP_BACKUP_ROOT_PATH` | 백업 루트 경로. 문서 권장 구조는 `<app-home>/backups` 이고 하위에 `db`, `app-config`, `release` 를 둔다. | `BACKUP_ROOT_PATH_PLACEHOLDER` placeholder 상태 | 미정, 운영팀 입력 | 대상 경로 존재 여부와 쓰기 권한 확인, 배포 전 `scripts\run-backup.bat` 또는 관리자 수동 백업 전 대조 | 미정 | 미정 | 미정 |
| `APP_DB_DUMP_COMMAND` 또는 `APP_BACKUP_DB_DUMP_COMMAND` | DB dump 실행 명령 또는 절대 경로. PATH 에 `mariadb-dump` 또는 `mysqldump` 가 없으면 명시가 필요하다. | 기본 fallback `mariadb-dump`, 실제 운영 경로 미정 | 미정, 운영팀 입력 | 운영 서버에서 명령 실행 가능 여부 확인, 수동 백업 preflight 또는 `scripts\run-backup.bat` 로 실제 탐지 여부 확인 | 미정 | 미정 | 미정 |
| `APP_EXPORT_TEMP_PATH` | CSV export 임시 파일 경로. writable 경로여야 한다. | 기본값 `./tmp/exports` | 미정, 운영팀 입력 | 대상 경로 존재 여부와 쓰기 권한 확인, 관리자 CSV export 실행 시 파일 생성/다운로드 정상 여부 확인 | 미정 | 미정 | 미정 |

### 4.4 Health 노출, 관리자 준비, 척도 로딩

| 설정 키 | 설명 | 현재 상태 | 운영 시 입력할 값 | 확인 방법 | 실제 값 입력 담당자 | 확인 담당자 | 확인 일시 |
|---|---|---|---|---|---|---|---|
| `/api/v1/health` 노출 범위 | health endpoint 는 인증 없이 노출되므로 내부망 또는 허용된 운영 점검 경로로만 열어야 한다. | 문서상 내부망 또는 프록시 ACL 제한 필요, 실제 허용 범위 미정 | 미정, 운영팀 입력 | 허용해야 하는 IP 대역 또는 운영 점검 주체만 정리, 비허용 구간에서 접근 차단되는지 확인 | 미정 | 미정 | 미정 |
| `/api/v1/health` 프록시/방화벽 ACL | reverse proxy, 웹서버, 방화벽 중 어디에서 차단할지 결정해야 한다. | 결정 기준만 존재, 실제 ACL 위치 미정 | 미정, 운영팀 입력 | 프록시 설정 또는 ACL 문서 기준으로 허용/차단 규칙 확인, 운영 점검 경로 외 차단 테스트 수행 | 미정 | 미정 | 미정 |
| `초기 관리자 계정 준비` | `app.seed.enabled` 가 `false` 이므로 운영 시작 전 별도 관리자 계정 준비가 필요하다. | 문서상 관리자 계정 준비 필요만 명시, 실제 계정/전달 방식 미정 | 미정, 운영팀 입력 | 초기 관리자 로그인 후 승인 대기, 사용자 관리, 로그, 백업 메뉴 접근 가능 여부 확인 | 미정 | 미정 | 미정 |
| `가입 승인 절차 / 최초 승인 담당자` | 1인 1계정, 가입 신청 후 관리자 승인 구조이므로 최초 승인 가능 주체와 대체 담당자를 미리 정해야 한다. | 문서상 승인 기능 존재, 실제 운영 담당자와 절차 미정 | 미정, 운영팀 입력 | 일반 사용자 1건 신청 후 관리자 승인 또는 반려 1회 테스트, 담당자 부재 시 대체 승인자 있는지 확인 | 미정 | 미정 | 미정 |
| `APP_SCALE_RESOURCE_PATH` | 척도 JSON 로딩 경로. 기본은 `classpath:scales`, 배포 문서는 외부 filesystem 경로 사용을 권장한다. | 기본값 `classpath:scales`, 실제 운영 경로 미정 | 미정, 운영팀 입력 | 실제 경로에 운영 척도 JSON 세트가 존재하는지 확인, 앱 기동 후 scale registry 로딩 성공 로그 확인 | 미정 | 미정 | 미정 |
| `운영 척도 JSON 세트` | 운영에 사용할 척도 JSON 확정본과 배치 위치. 문서 기준 대상은 8종 척도 세트다. | 문서상 파일 목록만 존재, 실제 운영 배치본 확정 여부 미기재 | 미정, 운영팀 입력 | 운영 배치본 파일 목록과 백업 위치 확인, 변경 이력과 함께 보관되는지 확인 | 미정 | 미정 | 미정 |
| `scale registry 로딩 확인` | health 응답과 기동 로그에서 척도 로딩 상태를 확인한다. 문서 기준 기대값은 `loadedScaleCount=8` 이다. | 확인 절차만 존재, 실제 운영 결과 미확인 | 미정 아님, 운영 반영 후 결과 확인 필요 | `/api/v1/health` 에서 `scaleRegistryStatus=UP`, `loadedScaleCount=8` 확인, 척도 상세 API 또는 샘플 세션 저장으로 추가 확인 | 미정 | 미정 | 미정 |

---

## 5. 값 입력 완료 확인

- 아래 항목은 4장 표가 채워졌는지 보는 마감 체크다. 실제 실행 순서와 통과 여부 체크는 [docs/15-go-live-checklist.md](./15-go-live-checklist.md) 를 따른다.
- [ ] `DB 접속 정보`, `로그 경로`, `백업 경로`, `dump command`, `scale 경로` 의 placeholder 제거 여부와 담당자 기입이 완료되었다.
- [ ] `APP_TRUST_PROXY_HEADERS`, `APP_FORWARD_HEADERS_STRATEGY`, `health ACL` 의 실제 입력값과 결정 근거가 문서 또는 운영 설정에 남아 있다.
- [ ] 초기 관리자 계정 준비와 가입 승인 절차 담당자 기록이 완료되었다.
- [ ] `/api/v1/health` 접근 허용 범위와 ACL 적용 위치 기록이 완료되었다.
- [ ] `loadedScaleCount=8` 확인 방법, 수행 시점, 담당자 기록이 완료되었다.

---

## 6. 근거 문서

- [backend/src/main/resources/application-prod.yml](../backend/src/main/resources/application-prod.yml)
- [docs/11-deployment.md](./11-deployment.md)
- [docs/12-release-readiness.md](./12-release-readiness.md)
- [docs/13-pre-deploy-runbook.md](./13-pre-deploy-runbook.md)
