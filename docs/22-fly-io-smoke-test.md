# Fly.io 배포 실행 보조 및 스모크 테스트

## 1. 목적

이 문서는 실제 `fly deploy` 전에 사람이 반복 실행할 수 있는 최소 보조 스크립트와,
배포 직후 확인해야 하는 스모크 테스트 절차만 정리한다.

이 문서의 범위:
- backend 배포 보조 스크립트
- frontend 배포 보조 스크립트
- 배포 직후 `curl` 중심 확인 절차

이 문서는 아래를 자동화하지 않는다.
- `fly apps create`
- 실제 운영 비밀번호 저장
- 관리자 계정 자동 생성

---

## 2. 배포 보조 스크립트

추가된 스크립트:
- `scripts/fly-deploy-backend.sh`
- `scripts/fly-deploy-frontend.sh`

공통 원칙:
- 스크립트 상단의 대문자 placeholder 값을 먼저 수정한다.
- 앱이 이미 Fly 에 생성되어 있다는 전제에서만 사용한다.
- 스크립트는 `fly.toml` 을 자동 수정하지 않는다.
- 스크립트 값과 `fly.toml` 값이 다르면 실패하게 해서 잘못된 앱/URL 배포를 막는다.

실행 전 1회 권한 부여:

```bash
chmod +x scripts/fly-deploy-backend.sh scripts/fly-deploy-frontend.sh
```

권장 실행 순서:

```bash
./scripts/fly-deploy-backend.sh
./scripts/fly-deploy-frontend.sh
```

---

## 3. 스모크 테스트 준비값

아래 값은 실제 운영값으로 바꿔서 터미널에 준비한다.
비밀번호는 문서에 직접 남기지 않는다.

```bash
BACKEND_URL="https://REPLACE_BACKEND_FLY_APP_NAME.fly.dev"
FRONTEND_URL="https://REPLACE_FRONTEND_FLY_APP_NAME.fly.dev"
ADMIN_LOGIN_ID="REPLACE_ADMIN_LOGIN_ID"
ADMIN_PASSWORD="REPLACE_ADMIN_PASSWORD"
```

---

## 4. 배포 후 스모크 테스트

### 4.1 backend health 확인

```bash
curl --fail --silent --show-error \
  "${BACKEND_URL}/api/v1/health"
```

성공 기준:
- HTTP `200`
- 응답 JSON 에 `success: true`
- `data.status`, `data.dbStatus`, `data.scaleRegistryStatus` 가 모두 `UP`

---

### 4.2 frontend 메인 페이지 응답 확인

```bash
curl -I "${FRONTEND_URL}/"
```

성공 기준:
- HTTP `200`

---

### 4.3 frontend `/api` 프록시 확인

frontend 도메인으로 backend health 가 그대로 통과하는지 확인한다.

```bash
curl --fail --silent --show-error \
  "${FRONTEND_URL}/api/v1/health"
```

성공 기준:
- HTTP `200`
- backend 직접 호출과 같은 형태의 health JSON 이 반환됨

---

### 4.4 로그인 화면 진입 확인

SPA 라우팅 기준으로 `/login` 진입이 가능한지 먼저 확인한다.

```bash
curl -I "${FRONTEND_URL}/login"
```

성공 기준:
- HTTP `200`

브라우저 수동 확인:
- `${FRONTEND_URL}/login` 접속
- 로그인 폼이 보이는지 확인

---

### 4.5 관리자 로그인 후 최소 1개 API 확인

세션 쿠키를 발급받은 뒤 관리자 API 하나를 바로 확인한다.
아래 예시는 `GET /api/v1/admin/users?page=0&size=10` 기준이다.

```bash
COOKIE_JAR="$(mktemp)"

curl --fail --silent --show-error \
  --cookie-jar "${COOKIE_JAR}" \
  --cookie "${COOKIE_JAR}" \
  --header "Content-Type: application/json" \
  --data "{\"loginId\":\"${ADMIN_LOGIN_ID}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  "${FRONTEND_URL}/api/v1/auth/login"

curl --fail --silent --show-error \
  --cookie "${COOKIE_JAR}" \
  "${FRONTEND_URL}/api/v1/admin/users?page=0&size=10"

rm -f "${COOKIE_JAR}"
```

성공 기준:
- 로그인 응답이 HTTP `200`
- 관리자 API 응답이 HTTP `200`
- 관리자 API 응답 JSON 에 `success: true` 가 포함됨

---

## 5. 실패 시 우선 점검 항목

- backend health 실패: `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `schema.sql` 선적용 여부 확인
- frontend `/api` 실패: `frontend/fly.toml` 의 `BACKEND_UPSTREAM_URL` 값 재확인
- `/login` 실패: frontend 배포 로그와 Nginx 기동 상태 확인
- 관리자 API 실패: 관리자 계정의 `role=ADMIN`, `status=ACTIVE` 여부 확인
