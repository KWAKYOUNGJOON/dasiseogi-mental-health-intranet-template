# Fly.io 배포 가이드

## 1. 목적

이 문서는 현재 저장소의 `backend/Dockerfile`, `frontend/Dockerfile`,
`backend/fly.toml`, `frontend/fly.toml` 기준으로
외부 MariaDB 를 사용하는 구성을 Fly.io 에 올리는 절차를 정리한다.

이 문서의 범위:
- Fly.io 에 backend / frontend 를 각각 별도 앱으로 배포하는 절차
- backend 와 frontend 의 현재 설정값 의미
- Fly secret / 환경변수 입력 순서
- 최초 배포 후 health 확인 절차

이 문서는 아래를 직접 다루지 않는다.
- Fly PostgreSQL / MySQL 자체 운영
- 운영 DB 스키마 설계 변경
- CI/CD 자동화
- 커스텀 도메인 연결

---

## 2. 현재 Fly 배포 구조

현재 저장소는 Docker Compose 기준으로 backend 와 frontend 가 분리되어 있다.
Fly.io 에서도 같은 방향으로 배포한다.

```text
[Browser]
   ↓ HTTPS
[frontend Fly app]
  - React 정적 파일
  - Nginx
  - /api 요청을 backend Fly URL 로 프록시
   ↓ HTTPS
[backend Fly app]
  - Spring Boot API
  - 세션 인증
  - 외부 MariaDB 연결
```

중요:
- frontend 는 브라우저에서 직접 backend 로 CORS 호출하지 않는다.
- frontend Nginx 가 `/api` 요청을 backend 로 프록시하므로, 브라우저 기준으로는 같은 origin 처럼 동작한다.
- backend 는 외부 MariaDB 를 사용한다. Fly 내부 DB 를 자동 생성하지 않는다.

---

## 3. 배포 전 선행 조건

아래 항목이 모두 준비된 뒤에만 배포를 시작한다.

- Fly 계정과 `flyctl` 설치 완료
- Fly 로그인 완료
- 외부 MariaDB 생성 완료
- `backend/src/main/resources/schema.sql` 선적용 완료
- 앱 전용 DB 계정 / 비밀번호 준비 완료
- 초기 관리자 부트스트랩 절차 준비 완료

MariaDB 선적용 원칙은 계속 아래 문서를 따른다.

- [docs/18-docker-compose-deployment.md](./18-docker-compose-deployment.md)
- [docs/19-production-bootstrap.md](./19-production-bootstrap.md)
- [docs/20-production-input-sheet.md](./20-production-input-sheet.md)

---

## 4. 설정 파일 위치

- backend Fly 설정: `backend/fly.toml`
- frontend Fly 설정: `frontend/fly.toml`

루트에서 자동 생성된 `fly.toml` 이 있더라도,
현재 저장소 구조에서는 위 두 파일을 기준으로 배포하는 편이 안전하다.

이유:
- backend Dockerfile 은 `backend/` 디렉터리를 build context 로 기대한다.
- frontend Dockerfile 은 `frontend/` 디렉터리를 build context 로 기대한다.
- 따라서 각 디렉터리에서 개별 배포하는 쪽이 현재 Dockerfile 과 가장 잘 맞는다.

---

## 5. 앱 이름 점검

첫 배포 전 아래 값을 먼저 점검한다.

- `backend/fly.toml` 의 `app`
- `frontend/fly.toml` 의 `app`
- `frontend/fly.toml` 의 `BACKEND_UPSTREAM_URL`

기본 상태에서 frontend 는 아래 backend URL 을 바라본다.

```text
https://dasiseogi-mental-health-intranet-template-dry-sea-7928.fly.dev
```

backend 앱 이름을 바꾸면 frontend 의 `BACKEND_UPSTREAM_URL` 도 같이 바꿔야 한다.

---

## 6. backend 최초 배포

### 6.1 앱 생성

`backend/fly.toml` 의 `app` 값과 같은 이름으로 앱을 준비한다.

```bash
fly apps create dasiseogi-mental-health-intranet-template-dry-sea-7928
```

### 6.2 secret 입력

민감한 값은 `backend/fly.toml` 에 넣지 말고 secret 으로 넣는다.

```bash
cd backend

fly secrets set \
  APP_DB_URL='jdbc:mariadb://DB_HOST:3306/DB_NAME?useUnicode=true&characterEncoding=utf8' \
  APP_DB_USERNAME='DB_USERNAME' \
  APP_DB_PASSWORD='DB_PASSWORD' \
  APP_DB_DRIVER='org.mariadb.jdbc.Driver'
```

필요하면 아래도 함께 넣는다.

```bash
fly secrets set APP_DB_DUMP_COMMAND='/usr/bin/mariadb-dump'
```

주의:
- 현재 공식 backend Docker 이미지에는 `mariadb-dump` 가 기본 포함되지 않는다.
- 따라서 `APP_DB_DUMP_COMMAND` 을 넣더라도 이미지 안에 바이너리가 없으면 DB dump 기반 백업은 실패한다.
- backup UI 를 꼭 써야 하면 dump 바이너리가 포함된 파생 이미지를 따로 만들어야 한다.

### 6.3 배포

```bash
fly deploy
```

backend `fly.toml` 에는 `/data` volume mount 가 포함되어 있다.
최초 배포 시 해당 app 에 volume 이 없으면 Fly 가 `data` volume 을 만든다.

### 6.4 확인

```bash
fly status
fly logs
curl https://dasiseogi-mental-health-intranet-template-dry-sea-7928.fly.dev/api/v1/health
```

health 응답 전 확인 포인트:
- backend 가 실제 외부 MariaDB 를 바라보는지
- `schema.sql` 선적용 누락으로 `ddl-auto=validate` 오류가 나지 않는지
- placeholder 값 또는 H2 fallback 으로 잘못 기동되지 않았는지

---

## 7. frontend 최초 배포

### 7.1 앱 생성

`frontend/fly.toml` 의 `app` 값과 같은 이름으로 앱을 준비한다.

```bash
fly apps create dasiseogi-mental-health-intranet-template-web
```

### 7.2 backend URL 점검

frontend 는 `BACKEND_UPSTREAM_URL` 로 backend 를 프록시한다.
배포 전 `frontend/fly.toml` 에 있는 URL 이 실제 backend 앱 URL 과 일치하는지 확인한다.

### 7.3 배포

```bash
cd frontend
fly deploy
```

### 7.4 확인

```bash
fly status
fly logs
curl -I https://dasiseogi-mental-health-intranet-template-web.fly.dev
curl https://dasiseogi-mental-health-intranet-template-web.fly.dev/api/v1/health
```

성공 기준:
- `/` 에서 프런트 앱이 열린다.
- `/api/v1/health` 호출이 frontend 도메인에서 정상 응답한다.
- 브라우저 로그인 후 세션 유지가 된다.

---

## 8. 재배포 순서

일반적으로는 아래 순서를 권장한다.

1. backend 수정 배포
2. backend health 확인
3. frontend 수정 배포
4. 로그인 / 목록 / 저장 / 관리자 메뉴 스모크 테스트

frontend 가 backend URL 을 프록시하는 구조이므로,
backend 앱 이름이나 도메인을 바꾼 경우에는 frontend 도 함께 재배포해야 한다.

---

## 9. 로컬 Docker Compose 와의 차이

로컬 Docker Compose 에서는 아래 기본값을 쓴다.

```dotenv
FRONTEND_BACKEND_UPSTREAM_URL=http://backend:8080
```

Fly 에서는 아래처럼 public HTTPS URL 을 쓴다.

```dotenv
BACKEND_UPSTREAM_URL=https://<backend-app>.fly.dev
```

즉, 같은 Nginx 이미지를 사용하되 환경변수만 다르게 넣어
로컬과 Fly 를 같은 방식으로 유지한다.

---

## 10. 중단 조건

아래 항목 중 하나라도 해당되면 실제 운영 배포를 중단한다.

- 외부 MariaDB 에 `schema.sql` 선적용이 끝나지 않았다.
- backend secret 값 중 하나라도 비어 있다.
- frontend 의 `BACKEND_UPSTREAM_URL` 이 실제 backend 앱 URL 과 다르다.
- backend 로그에 `falling back to local H2 profile` 문구가 보인다.
- backend health 가 정상인데도 로그인 / 세션 유지가 실패한다.

이 경우 먼저 secret 값, backend URL, 프록시 헤더, 초기 관리자 준비 상태를 다시 점검한다.
