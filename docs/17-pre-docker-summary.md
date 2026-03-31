# Pre-Docker Summary

## 1. 목적

- 이 문서는 Docker 작업 시작 직전 시점의 완료 항목, 남은 항목, 시작 조건 충족 여부만 짧게 정리한 요약 문서다.
- 기준 근거는 [docs/12-release-readiness.md](./12-release-readiness.md), [docs/15-go-live-checklist.md](./15-go-live-checklist.md), [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md), [docs/deploy-results/2026-03-31.md](./deploy-results/2026-03-31.md) 이다.
- 실제 운영값은 추측하지 않고, 미정 항목은 그대로 유지한다.

---

## 2. 완료된 항목

- [x] 일반 사용자 핵심 평가 흐름 회귀 고정 완료
- [x] 관리자 핵심 화면 테스트/실행 확인 완료
  - 가입 승인
  - 사용자 관리
  - 수동 백업
  - 활동 로그
- [x] 통계 조회 및 관리자 CSV export 스모크 확인 완료
- [x] `backend` `.\gradlew.bat test` 성공 반영 완료
- [x] `frontend` `npm run build` 성공 반영 완료
- [x] `release-readiness`, `deploy-results`, `go-live`, `prod-config` 문서 정리 완료
- [x] 검증 환경 기준 `MariaDB/MySQL` 실검증 및 `DB_DUMP` 성공 기록 반영 완료

---

## 3. Docker 전 남은 항목

- [ ] 실제 운영값 미정 항목 정리 완료 필요
  - DB 접속 정보
  - 세션 타임아웃
  - 로그 경로
  - 백업 경로
  - dump command 경로
  - export temp 경로
  - scale resource 경로
- [ ] `/api/v1/health` ACL 범위와 프록시 적용 위치 결정 필요
- [ ] `APP_FORWARD_HEADERS_STRATEGY`, `APP_TRUST_PROXY_HEADERS` 실제 운영 기준 결정 필요
- [ ] 초기 관리자 계정과 최초 승인 담당자 확정 필요
- [ ] 실제 운영 배포는 아직 미실행 상태

---

## 4. Docker 작업 시작 조건 판단

- 판단: `조건부 가능`
- 이유: 기능 회귀, 관리자 스모크, 통계/CSV, `backend test`, `frontend build`, readiness 문서 정리는 완료되었다. 다만 실제 운영값, `health` 노출 범위, 프록시 결정, 초기 관리자 준비는 아직 미정이므로 Docker 작업은 시작할 수 있지만 운영값 확정 전제 하에 진행해야 한다.

---

## 5. Docker 작업 시작 전 마지막 체크

- [ ] 실제 입력 담당자와 확인 담당자가 정해졌는지 확인
- [ ] 운영 DB/세션/경로 관련 실제 입력값 준비 여부 확인
- [ ] 로그 경로, 백업 경로, export temp 경로 writable 계획이 있는지 확인
- [ ] `/api/v1/health` 허용 범위와 ACL 적용 위치가 정리되었는지 확인
- [ ] reverse proxy 사용 여부와 proxy header 처리 기준이 정리되었는지 확인
- [ ] 초기 관리자 계정 준비 방식과 최초 승인 담당자가 정리되었는지 확인

---

## 6. 다음 단계 제안

- 다음 대화에서는 이 문서를 기준으로 Docker 작업 범위를 한정해서 진행한다.
- 우선순위는 `운영값 주입 방식`, `컨테이너 내 경로 구조`, `health/proxy 반영 방식` 을 문서 기준으로 보수적으로 연결하는 것이다.
- 실제 운영 배포나 서버 접속 작업은 Docker 작업과 분리해 다음 단계로 남긴다.
