# 단일 서버 일체형 설치 운영 가이드

## 1. 문서 목적

이 문서는 `KWAKYOUNGJOON/dasiseogi-mental-health-intranet-template` 저장소를 기준으로, 한 대의 서버 안에서 DB, 백엔드, 프론트엔드를 함께 운영하는 설치 절차를 정리한 운영 문서다.

대상 독자:
- 비전공자 운영 담당자
- 실제 설치를 수행하는 실무자
- 설치 후 검수와 인수인계를 맡는 담당자

이 문서의 목적:
- 설치 전에 무엇을 준비해야 하는지 미리 알 수 있게 한다.
- 설치 담당자가 단계대로 그대로 따라할 수 있게 한다.
- 설치 후 검수, 운영 점검, 인수인계에 같은 문서를 다시 사용할 수 있게 한다.

이 문서는 아래 범위만 다룬다.
- 단일 서버 일체형 설치
- Docker Compose 기반 기동
- 최초 관리자 준비
- 설치 후 기능 검수, 백업, 자동 재기동, 1차 장애 점검

이 문서는 아래 범위를 다루지 않는다.
- 다중 서버 분산 구성
- Kubernetes
- 클라우드 매니지드 배포
- 코드 수정이나 설정 구조 변경

## 2. 단일 서버 일체형 설치 개념 설명

이 문서에서 말하는 단일 서버 일체형 설치는 한 대의 서버 안에서 아래 3개 서비스를 함께 운영하는 방식이다.

- `db`: MariaDB
- `backend`: Spring Boot 백엔드
- `frontend`: Nginx 기반 프론트엔드

중요한 점:
- 서버는 1대이지만, 컨테이너는 3개다.
- 사용자는 보통 프론트엔드 주소로 접속한다.
- 백엔드는 별도 포트로 직접 확인할 수 있어 health 점검에 쓴다.
- DB 는 기본 compose 기준 외부 포트로 직접 노출하지 않는다.

이 문서에서 사용하는 기준 파일:
- `docker-compose.yml`
- `.env.docker.example` 를 복사해 만든 루트 `.env`

이 기준을 사용하는 이유:
- 현재 저장소에서 `db / backend / frontend` 를 한 번에 빌드하고 함께 올리는 실제 compose 파일이 루트 `docker-compose.yml` 이다.
- `docker-compose.single-container.yml` 은 README 기준 optional local 경로다.
- `docker-compose.prod.yml` 도 저장소에 있지만, 이 문서는 현재 저장소를 서버에서 직접 배치해 함께 기동하는 경로를 기준으로 설명한다.

운영 모드는 `.env` 에서 아래 값으로 결정한다.

```dotenv
SPRING_PROFILES_ACTIVE=prod
```

이 값이 `prod` 여야 한다. `local` 로 두면 운영 기준이 아니라 로컬 기준으로 올라간다.

## 3. 설치 전 준비물

설치를 시작하기 전에 아래 준비물을 먼저 확보한다.

- 서버 접속 권한
  - Docker 를 설치하고 `docker compose` 를 실행할 수 있어야 한다.
- 저장소 반입본
  - `git clone` 으로 받거나, 승인된 ZIP 압축본을 받아야 한다.
- 실제 운영용 비밀값
  - DB 앱 계정 비밀번호
  - DB root 비밀번호
  - 최초 관리자용 로그인 ID와 임시 비밀번호
- 설치 경로 계획
  - 저장소를 둘 루트 경로
  - 로그 저장 경로
  - 임시 파일 경로
  - 백업 저장 경로
- 서버 네트워크 확인
  - 최초 설치 시 Docker 이미지 빌드와 패키지 다운로드가 가능해야 한다.
- 브라우저 또는 점검 도구
  - 프론트엔드 접속 확인
  - 백엔드 health 확인
- 운영 연락 체계
  - 설치 담당자
  - 검수 담당자
  - 장애 발생 시 연락 담당자

권장 준비 문서:
- 이 문서
- [docs/19-production-bootstrap.md](./19-production-bootstrap.md)
- [docs/20-production-input-sheet.md](./20-production-input-sheet.md)

### 3.1 운영 입력값 확인표

설치를 시작하기 전에 아래 표를 먼저 채워 두면 `.env` 작성, 검수, 인수인계가 훨씬 쉬워진다.

중요:
- 실제 비밀번호 값은 이 문서나 메신저에 적지 않는다.
- 비밀번호는 보안 저장소에 별도 보관하고, 설치 담당자는 저장 위치만 확인한다.

| 항목 | 설치 전 확정값 | 비고 |
|---|---|---|
| 서버 주소/IP |  | 예: `192.0.2.10` 또는 운영 도메인 |
| 설치 루트 경로 |  | 예: `/opt/dasiseogi` 또는 `D:\dasiseogi` |
| 프론트 포트 | `4173` 또는 운영 확정값 | `.env` 의 `APP_FRONTEND_PORT` |
| 백엔드 포트 | `8080` 또는 운영 확정값 | `.env` 의 `APP_SERVER_PORT` |
| DB 이름 |  | `.env` 의 `LOCAL_DB_NAME` |
| DB 앱 계정 |  | `.env` 의 `LOCAL_DB_USERNAME` |
| DB 앱 비밀번호 | 보안 저장소에 별도 보관 | 문서에 실제 값 직접 기재 금지 |
| DB root 비밀번호 | 보안 저장소에 별도 보관 | 문서에 실제 값 직접 기재 금지 |
| 관리자 승격 대상 `loginId` |  | 최초 관리자 승격 SQL 에 사용 |
| 로그 경로 |  | `.env` 의 `BACKEND_LOGS_HOST_PATH` |
| tmp 경로 |  | `.env` 의 `BACKEND_TMP_HOST_PATH` |
| 백업 경로 |  | `.env` 의 `BACKEND_BACKUPS_HOST_PATH` |

### 3.2 명령어 사용 기준

이 문서의 명령 예시는 기본적으로 Linux/bash 기준이다.
즉, 실제 운영 서버의 운영체제가 Linux 가 아닐 수도 있으며, Windows Server 에서 설치하는 경우에는 같은 작업을 PowerShell 기준으로 바꿔 실행하면 된다.

Windows Server 에서 설치하는 경우:
- 파일 경로는 Windows 경로 표기 방식으로 바꾼다.
- 폴더 생성, 파일 복사, health 확인 명령은 PowerShell 명령으로 치환해서 실행한다.
- `docker compose` 명령 자체는 같더라도, 앞뒤 파일 작업 명령은 Linux 예시를 그대로 붙여 넣지 않는다.

자주 바꾸는 명령 예시는 아래와 같다.

| 작업 | Linux/bash 예시 | Windows Server PowerShell 예시 |
|---|---|---|
| 폴더 생성 | `mkdir -p logs tmp local-backups` | `New-Item -ItemType Directory -Force logs, tmp, local-backups` |
| example env 복사 | `cp .env.docker.example .env` | `Copy-Item .env.docker.example .env` |
| health 확인 예시 | `curl -fsS http://127.0.0.1:8080/api/v1/health` | `(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/api/v1/health).Content` |

## 4. 권장 서버 환경

저장소 안에 고정된 최소 사양 수치는 명시돼 있지 않다. 아래는 단일 서버 일체형 설치를 시작할 때의 권장 기준이다. 실제 운영 규모에 따라 더 높게 잡을 수 있다.

| 항목 | 권장 기준 |
|---|---|
| CPU | 4 vCPU 이상 |
| 메모리 | 8GB 이상 |
| 디스크 | 여유 공간 100GB 이상 권장 |
| 디스크 유형 | 지속 보관 가능한 SSD 권장 |
| 운영체제 | Docker Engine 과 Docker Compose v2 를 안정적으로 운영할 수 있는 64비트 서버 OS |
| 시간 동기화 | 서버 시간이 정확해야 하며, 운영 기준 시각은 `Asia/Seoul` 로 맞추는 것을 권장 |
| 네트워크 | 운영자 접속용 포트와 사용자 접속용 포트 허용 |

포트 기준:
- 프론트엔드 기본 포트: `4173`
- 백엔드 직접 확인 포트: `8080`
- DB 는 기본 compose 기준 외부 공개 포트가 없다.

운영 보안 권장:
- 사용자는 프론트엔드 포트만 사용하게 하고, 백엔드 직접 포트는 운영 점검용으로만 제한하는 것이 안전하다.
- 방화벽 정책은 운영 환경에 맞게 설정한다.

## 5. 폴더 구조 예시

아래는 서버에 프로젝트를 배치한 예시 구조다.

```text
<install-root>/
├── backend/
├── docker/
├── docs/
├── frontend/
├── scripts/
├── .env
├── .env.docker.example
├── docker-compose.yml
├── logs/
├── tmp/
└── local-backups/
```

각 경로의 의미:
- `backend/`: 백엔드 소스와 Docker 빌드 원본
- `frontend/`: 프론트엔드 소스와 Docker 빌드 원본
- `docker-compose.yml`: 단일 서버 일체형 설치의 기준 compose 파일
- `.env`: 실제 운영값을 넣는 환경파일
- `logs/`: 백엔드 로그가 쌓이는 호스트 폴더
- `tmp/`: export 등 임시 파일이 쌓이는 호스트 폴더
- `local-backups/`: 백업 파일이 쌓이는 호스트 폴더

추가로 Docker named volume 도 생성된다.

- `local_db_data`

주의:
- 실제 Docker 볼륨 이름은 프로젝트명이 앞에 붙을 수 있다.
- 예를 들어 Docker 환경에 따라 `dasiseogi-mental-health-intranet-template_local_db_data` 처럼 보일 수 있다.
- 이름에 `local` 이 들어가지만, 이 문서 기준 운영 설치에서도 루트 compose 파일을 쓰면 같은 볼륨 이름 계열을 사용한다.

## 6. 프로젝트 배치 방법

### 6.1 저장소 받기

승인된 버전의 저장소를 서버에 배치한다.

예시:

```bash
git clone https://github.com/KWAKYOUNGJOON/dasiseogi-mental-health-intranet-template.git <install-root>
cd <install-root>
```

Git 을 쓰지 않는 경우:
- 승인된 ZIP 압축본을 서버에 복사한다.
- 압축을 푼 뒤 `docker-compose.yml`, `backend/`, `frontend/`, `docker/`, `scripts/` 가 같은 루트에 남도록 확인한다.

### 6.2 운영용 폴더 만들기

아래 폴더를 미리 만든다.

```bash
mkdir -p logs tmp local-backups
```

Windows Server PowerShell 예시:

```powershell
New-Item -ItemType Directory -Force logs, tmp, local-backups
```

### 6.3 배치 시 확인할 점

- 저장소 루트에서 `docker-compose.yml` 이 바로 보여야 한다.
- `backend/` 와 `frontend/` 폴더를 임의로 다른 위치로 옮기지 않는다.
- `.env` 는 반드시 저장소 루트에 둔다.
- 실제 비밀번호가 들어간 `.env` 는 Git 에 커밋하지 않는다.

## 7. 환경파일 준비 방법

### 7.1 `.env` 파일 만들기

루트에서 example 파일을 복사한다.

```bash
cp .env.docker.example .env
```

Windows Server PowerShell 예시:

```powershell
Copy-Item .env.docker.example .env
```

### 7.2 운영 설치에서 반드시 바꿔야 할 값

`.env` 에서 아래 항목은 운영 기준으로 확인하거나 변경한다.

| 항목 | 운영 설치 기준 |
|---|---|
| `SPRING_PROFILES_ACTIVE` | 반드시 `prod` |
| `APP_SERVER_PORT` | 기본 `8080`, 필요 시 운영 환경에 맞게 설정 |
| `APP_FRONTEND_PORT` | 기본 `4173`, 필요 시 운영 환경에 맞게 설정 |
| `APP_BACKEND_UPSTREAM_HOST` | 기본 `backend`, 특별한 이유가 없으면 유지 |
| `APP_HEALTHCHECK_PATH` | 기본 `/api/v1/health`, 특별한 이유가 없으면 유지 |
| `APP_SESSION_TIMEOUT` | 기본 `120m`, 운영 정책에 맞게 확인 |
| `APP_FORWARD_HEADERS_STRATEGY` | reverse proxy 가 없으면 기본 `none` 유지 |
| `APP_TRUST_PROXY_HEADERS` | reverse proxy 가 없으면 기본 `false` 유지 |
| `APP_DB_DRIVER` | MariaDB 기준 `org.mariadb.jdbc.Driver` |
| `APP_DB_DUMP_COMMAND` | 권장 `mariadb-dump` |
| `LOCAL_DB_NAME` | 운영 DB 이름 |
| `LOCAL_DB_USERNAME` | 운영 앱 계정 이름 |
| `LOCAL_DB_PASSWORD` | 운영 앱 계정 비밀번호 |
| `LOCAL_DB_ROOT_PASSWORD` | 운영 DB root 비밀번호 |
| `BACKEND_LOGS_HOST_PATH` | 로그 저장 경로 |
| `BACKEND_TMP_HOST_PATH` | 임시 파일 저장 경로 |
| `BACKEND_BACKUPS_HOST_PATH` | 백업 저장 경로 |

### 7.3 운영용 예시

아래는 예시다. 실제 값은 운영 환경에 맞게 설정한다.

```dotenv
SPRING_PROFILES_ACTIVE=prod

APP_SERVER_PORT=8080
APP_FRONTEND_PORT=4173
APP_BACKEND_UPSTREAM_HOST=backend
APP_HEALTHCHECK_PATH=/api/v1/health

APP_SESSION_TIMEOUT=120m
APP_FORWARD_HEADERS_STRATEGY=none
APP_TRUST_PROXY_HEADERS=false

APP_DB_DRIVER=org.mariadb.jdbc.Driver
APP_DB_DUMP_COMMAND=mariadb-dump

LOCAL_DB_NAME=mental_health_prod
LOCAL_DB_USERNAME=mental_app
LOCAL_DB_PASSWORD=<운영_APP_DB_비밀번호>
LOCAL_DB_ROOT_PASSWORD=<운영_DB_ROOT_비밀번호>

BACKEND_LOGS_HOST_PATH=./logs
BACKEND_TMP_HOST_PATH=./tmp
BACKEND_BACKUPS_HOST_PATH=./local-backups
```

### 7.4 이 경로에서 DB 주소를 따로 넣지 않는 이유

루트 `docker-compose.yml` 기준으로 backend 의 DB 접속 주소는 compose 안에서 자동으로 만들어진다.

실제 compose 기준:

```text
jdbc:mariadb://db:3306/<LOCAL_DB_NAME>?useUnicode=true&characterEncoding=utf8
```

즉, 이 문서 기준 경로에서는 `APP_DB_URL_DOCKER` 를 별도로 수동 입력하지 않는다.

### 7.5 운영자가 꼭 기억할 점

- `SPRING_PROFILES_ACTIVE` 가 `prod` 인지 먼저 확인한다.
- 예시 비밀번호나 약한 기본 비밀번호를 그대로 쓰지 않는다.
- `APP_DB_DUMP_COMMAND` 는 운영 백업 품질에 중요하다.
  - 현재 backend 이미지에는 `mariadb-client` 가 포함돼 있으므로 `mariadb-dump` 를 권장값으로 둘 수 있다.
  - 이 값이 없거나 실행 불가면 백업이 `SNAPSHOT` 방식으로 내려갈 수 있다.
- `.env` 값을 바꾼 뒤에는 `docker compose restart` 만으로는 새 값이 반영되지 않는다.
  - 값 변경 후에는 `docker compose up -d --build --force-recreate` 를 사용한다.

## 8. Docker 기반 실행 방법

### 8.1 기동 전 확인

루트에서 아래 명령으로 compose 치환 결과를 먼저 확인한다.

```bash
docker compose config
```

확인 포인트:
- `backend` 의 `SPRING_PROFILES_ACTIVE` 가 `prod` 로 보이는지
- 포트가 의도한 값인지
- 로그, tmp, 백업 경로가 의도한 값인지

### 8.2 최초 기동

```bash
docker compose up -d --build
docker compose ps
```

### 8.3 최초 기동 시 동작 이해

처음 설치이고 DB volume 이 비어 있으면 아래 순서로 진행된다.

1. `db` 컨테이너가 먼저 올라간다.
2. `backend/src/main/resources/schema.sql` 이 MariaDB 초기화 단계에서 적용된다.
3. `backend` 가 `prod` profile 로 올라오며 스키마를 `validate` 한다.
4. `frontend` 가 올라오고 `/api` 요청을 `backend` 로 프록시한다.

중요:
- `prod` 기준 `app.seed.enabled=false` 이므로 seed 관리자 계정은 자동 생성되지 않는다.
- 따라서 최초 관리자 계정은 뒤의 10장 절차로 별도 준비해야 한다.
- 이미 기존 DB 볼륨이 남아 있으면 `schema.sql` 초기화는 다시 자동 적용되지 않는다.
- 따라서 기존 `local_db_data` 계열 볼륨이 남아 있는 서버는 fresh install 인지 기존 운영 서버인지 먼저 구분해야 한다.

### 8.4 재기동과 재생성

일반 재기동:

```bash
docker compose restart
```

환경값 변경 후 재생성:

```bash
docker compose up -d --build --force-recreate
```

주의:
- `docker compose down -v` 는 DB 볼륨까지 삭제한다.
- 완전 초기화를 의도한 경우가 아니면 사용하지 않는다.

## 9. 실행 상태 확인 방법

### 9.1 컨테이너 상태 확인

```bash
docker compose ps
```

기대 상태:
- `db`: `healthy`
- `backend`: `healthy`
- `frontend`: `Up`

### 9.2 로그 확인

```bash
docker compose logs db --tail=100
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
```

### 9.3 health 확인

브라우저 또는 `curl` 로 아래 두 주소를 확인한다.

- 백엔드 직접 확인: `http://<서버주소>:8080/api/v1/health`
- 프론트엔드 경유 확인: `http://<서버주소>:4173/api/v1/health`

예시:

```bash
curl -fsS http://127.0.0.1:8080/api/v1/health
curl -fsS http://127.0.0.1:4173/api/v1/health
```

Windows Server PowerShell 예시:

```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/api/v1/health).Content
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/api/v1/health).Content
```

정상 기준:
- HTTP `200`
- `status=UP`
- `appStatus=UP`
- `dbStatus=UP`
- `scaleRegistryStatus=UP`
- `loadedScaleCount=9`

포트를 변경했다면:
- 백엔드는 `APP_SERVER_PORT`
- 프론트엔드는 `APP_FRONTEND_PORT`
값으로 같은 경로를 확인한다.

### 9.4 화면 접속 확인

프론트 기본 주소:

```text
http://<서버주소>:4173/login
```

포트를 변경했다면 프론트 주소도 `APP_FRONTEND_PORT` 기준으로 확인한다.

주의:
- 기동 직후에는 backend 가 완전히 `healthy` 가 되기 전까지 프론트 health 가 잠깐 `502` 가 될 수 있다.
- 이 경우 바로 장애로 판단하지 말고 `backend` 상태를 먼저 다시 확인한다.

## 10. 최초 관리자 설정

현재 저장소 기준 운영 절차는 아래 순서다.

1. 시스템 기동 완료
2. 회원가입 신청 생성
3. DB 수동 승격
4. 관리자 로그인 확인

### 10.1 회원가입 신청 생성

프론트에서 아래 주소로 들어간다.

```text
http://<서버주소>:4173/signup
```

입력 항목:
- 이름
- 아이디
- 비밀번호
- 연락처
- 직책 또는 역할
- 소속 팀
- 가입 신청 메모

저장소 기준 필수 핵심값:
- `name`
- `loginId`
- `password`

화면 기준으로는 연락처, 직책 또는 역할, 소속 팀도 함께 채우는 것이 안전하다.

신청 후 기대 상태:
- 아직 로그인은 되지 않는다.
- 안내 문구대로 관리자 승인 전 상태로 남는다.

### 10.2 승격 SQL 작업본 만들기

원본 파일:

- `scripts/sql/initial-admin-promote.template.sql`

원칙:
- 원본은 수정하지 않는다.
- 저장소 밖 안전한 작업 경로에 복사본을 만든다.
- 복사본에서 아래 2개만 실제 값으로 바꾼다.
  - `LOGIN_ID_PLACEHOLDER`
  - `PROMOTION_NOTE_PLACEHOLDER`

예시:

```bash
cp scripts/sql/initial-admin-promote.template.sql <safe-work-dir>/initial-admin-promote.sql
```

### 10.3 승격 SQL 실행

아래 명령은 DB 컨테이너 안에서 root 계정으로 승격 SQL 을 실행하는 예시다.

```bash
docker compose exec -T db sh -lc 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < "<safe-work-dir>/initial-admin-promote.sql"
```

정상 기준:
- 출력에 `updated_user_rows = 1`
- 출력에 `updated_request_rows = 1`

### 10.4 관리자 로그인 확인

이제 `/login` 에서 방금 신청한 계정으로 로그인한다.

확인할 항목:
- 로그인 성공
- 좌측 메뉴에 아래 4개가 보임
  - `승인 대기`
  - `사용자 관리`
  - `로그 확인`
  - `백업 관리`

관리자 설정이 끝나기 전까지는 설치 완료로 보지 않는다.

상세 절차가 더 필요하면 아래 문서를 함께 본다.

- [docs/19-production-bootstrap.md](./19-production-bootstrap.md)

## 11. 기능 검수 체크리스트

설치 직후 최소 검수 항목은 아래 순서로 확인한다.

- [ ] `http://<서버주소>:4173/login` 화면이 열린다.
- [ ] 관리자 계정으로 로그인된다.
- [ ] 관리자 메뉴 `승인 대기`, `사용자 관리`, `로그 확인`, `백업 관리` 가 모두 보인다.
- [ ] 대상자 1건을 신규 등록할 수 있다.
- [ ] 대상자 등록 후 `clientNo` 가 생성된다.
- [ ] `PHQ-9` 와 `GAD-7` 등 최소 2개 척도를 선택해 세션을 저장할 수 있다.
- [ ] 세션 저장 후 `sessionNo` 가 생성된다.
- [ ] 저장한 세션의 상세 화면이 열린다.
- [ ] 같은 세션의 출력 화면(`print view`)이 열린다.
- [ ] 통계 화면에서 summary, scale, alert 데이터가 조회된다.
- [ ] 관리자 기준 CSV export 가 다운로드된다.
- [ ] 활동 로그 화면에서 로그인, 대상자 생성, 세션 저장 기록을 확인할 수 있다.
- [ ] 관리자 `백업 관리` 화면에서 수동 백업 1회를 실행하고 이력이 남는다.

검수 결과는 별도 운영 결과 문서나 인수인계 문서에 남긴다.

## 12. 재부팅 후 자동 실행 확인

루트 `docker-compose.yml` 기준 각 서비스는 `restart: unless-stopped` 로 설정돼 있다.

### 12.1 사전 확인

```bash
docker inspect -f '{{ .HostConfig.RestartPolicy.Name }}' "$(docker compose ps -q db)"
docker inspect -f '{{ .HostConfig.RestartPolicy.Name }}' "$(docker compose ps -q backend)"
docker inspect -f '{{ .HostConfig.RestartPolicy.Name }}' "$(docker compose ps -q frontend)"
```

기대값:

```text
unless-stopped
```

### 12.2 실제 재부팅 후 확인

가능하면 설치 검수 시간 안에 서버를 한 번 재부팅하거나 Docker 서비스 재시작 점검을 한다.

현장 점검용 체크 순서는 아래처럼 짧게 본다.

- [ ] 서버를 재부팅한다.
- [ ] `1~3분` 정도 기다린다.
- [ ] 설치 루트에서 `docker compose ps` 를 실행해 `db`, `backend`, `frontend` 상태를 확인한다.
- [ ] `http://<서버주소>:8080/api/v1/health` 를 열어 backend health 가 `200` 이고 `status=UP` 인지 확인한다.
- [ ] `http://<서버주소>:4173/api/v1/health` 를 열어 frontend 경유 health 가 정상인지 확인한다.
- [ ] `http://<서버주소>:4173/login` 에 접속한다.
- [ ] 관리자 계정으로 다시 로그인한다.

포트를 바꿨다면 위 health 주소와 `/login` 주소도 변경된 포트 기준으로 본다.

중요:
- `.env` 값을 바꾼 경우 자동 재기동과 별개로 `docker compose up -d --build --force-recreate` 를 다시 해야 한다.
- `docker compose restart` 는 새 환경값을 읽지 않는다.

## 13. 백업 항목 및 백업 권장 주기

### 13.1 현재 구현 기준 백업 방식

현재 구현 기준으로 백업은 아래처럼 동작한다.

- 관리자 화면/API 수동 백업
  - `BackupService` 가 실행한다.
  - MariaDB dump 가 가능하면 `DB_DUMP`
  - dump 명령을 찾지 못하면 `SNAPSHOT` fallback
- 자동 백업
  - 기본 구현상 `매일 02:00`, `Asia/Seoul` 기준으로 동작한다.
  - 운영 정책상 변경이 필요하면 운영 환경에 맞게 설정한다.

백업 파일 저장 위치:
- 호스트 기본 경로 `./local-backups`
- 컨테이너 내부 경로 `/data/backups`

### 13.2 무엇을 백업해야 하는가

| 항목 | 위치 | 권장 주기 |
|---|---|---|
| 애플리케이션 생성 백업 ZIP | `BACKEND_BACKUPS_HOST_PATH` 기본 `./local-backups` | 자동 백업은 매일 확인, 수동 백업은 배포 전·설정 변경 전·대량 작업 전 1회 |
| 운영용 `.env` | 저장소 루트 또는 운영 비밀 저장소 | 값 변경 시마다 즉시 별도 보관 |
| 전달받은 저장소 버전 또는 배포본 | 설치 루트 또는 내부 배포 보관소 | 배포 시마다 |
| 로그 파일 | `BACKEND_LOGS_HOST_PATH` 기본 `./logs` | 주 1회 점검, 장애 발생 시 즉시 보관 |

### 13.3 운영자가 꼭 알아야 할 점

- `APP_DB_DUMP_COMMAND` 가 정상이어야 DB dump 기반 백업 품질이 좋아진다.
- 수동 백업 성공 여부는 `백업 관리` 화면과 실제 파일 생성 둘 다 확인한다.
- DB live 데이터는 Docker named volume 에 들어 있으므로, 볼륨만 믿지 말고 애플리케이션 백업 파일도 반드시 확보한다.
- 큰 작업 전에는 자동 백업만 기다리지 말고 수동 백업을 한 번 더 실행하는 것이 안전하다.

## 14. 장애 발생 시 1차 점검 순서

장애가 발생하면 아래 순서로 본다.

### 14.1 상태 확인

```bash
docker compose ps
docker compose logs db --tail=100
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
```

### 14.2 health 확인

```bash
curl -fsS http://127.0.0.1:8080/api/v1/health
curl -fsS http://127.0.0.1:4173/api/v1/health
```

### 14.3 현재 환경값 반영 여부 확인

```bash
docker compose exec backend sh -lc 'printenv | sort | grep "^APP_"'
```

확인 포인트:
- `SPRING_PROFILES_ACTIVE=prod` 인가
- 포트 값이 의도와 같은가
- 로그, tmp, 백업 경로가 의도와 같은가
- 최근 `.env` 를 바꾸고 `restart` 만 한 것은 아닌가

### 14.4 저장 경로와 여유 공간 확인

아래 경로가 쓰기 가능한지 확인한다.

- `logs/`
- `tmp/`
- `local-backups/`

또한 디스크 여유 공간이 부족하지 않은지 확인한다.

### 14.5 흔한 1차 판단 기준

- `db` 가 비정상
  - DB 컨테이너 로그를 먼저 본다.
- `backend` 만 비정상
  - `schema.sql` 초기화, DB 연결, health 로그를 본다.
- `frontend` 만 비정상
  - `backend` 가 먼저 `healthy` 인지 본다.
- 백업만 실패
  - `APP_DB_DUMP_COMMAND`
  - 백업 경로 쓰기 권한
  - 디스크 여유 공간
  - `/admin/backups` 최신 실패 이력

### 14.6 하지 말아야 할 일

- 원인 확인 전 `docker compose down -v` 를 실행하지 않는다.
- DB 볼륨을 임의 삭제하지 않는다.
- 실제 비밀값이 들어 있는 `.env` 를 메신저나 일반 문서에 복사하지 않는다.

## 15. 운영자 인수인계 항목

설치가 끝나면 아래 항목을 운영자에게 넘긴다.

- 설치 서버 정보
  - 서버 이름 또는 IP
  - 접속 방법
- 설치 경로
  - `<install-root>`
- 현재 사용 중인 포트
  - 프론트엔드 포트
  - 백엔드 직접 확인 포트
- 실제 `.env` 보관 위치와 변경 책임자
- 최초 관리자 계정 보관 위치
  - 실제 비밀번호는 저장소 밖 보안 저장소에만 보관
- 백업 경로와 백업 확인 방법
  - `./local-backups`
  - 관리자 `백업 관리` 화면
- 로그 경로
  - `./logs`
- health 확인 방법
  - `http://<서버주소>:8080/api/v1/health`
  - `http://<서버주소>:4173/api/v1/health`
- 재기동 방법
  - 일반 재기동: `docker compose restart`
  - 환경 변경 반영: `docker compose up -d --build --force-recreate`
- 최근 검수 결과
  - 기능 검수 체크리스트 결과
  - 수동 백업 성공 여부
  - 재부팅 후 자동 실행 확인 여부
- 미해결 사항
  - 아직 검수하지 못한 항목
  - 추후 점검 필요 항목

## 16. 설치 완료 판정 기준

아래 조건이 모두 충족되면 단일 서버 일체형 설치 완료로 판정한다.

- [ ] `docker compose ps` 기준 `db`, `backend`, `frontend` 가 정상 상태다.
- [ ] 백엔드 직접 health 가 `200` 이고 `status=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP` 다.
- [ ] 프론트엔드 경유 health 도 정상이다.
- [ ] `loadedScaleCount=9` 가 확인된다.
- [ ] `/login` 화면이 열리고 최초 관리자 로그인이 성공한다.
- [ ] 관리자 메뉴 4종이 모두 보인다.
- [ ] 대상자 등록, 세션 저장, 세션 상세, 출력 화면, 통계, CSV export 까지 최소 1회 검수했다.
- [ ] 관리자 수동 백업 1회를 실행했고 파일과 이력을 모두 확인했다.
- [ ] 재부팅 또는 자동 재기동 확인이 끝났다.
- [ ] 운영자 인수인계 항목이 문서나 작업본에 정리됐다.

위 항목 중 하나라도 비어 있으면 설치는 완료 처리하지 않고 `설치 진행 중` 또는 `검수 보류` 로 남긴다.
