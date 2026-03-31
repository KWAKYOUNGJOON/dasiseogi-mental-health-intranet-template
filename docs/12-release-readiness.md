# Release Readiness

## 1. 현재 판정

- 판정: `READY`
- 의미: 현재 증빙 범위 기준 `배포 가능` 이자 `release readiness 확보` 판정이며, 실제 운영 배포 완료를 뜻하지 않는다. 실제 운영 반영 여부, 배포 시작/완료 시각, 배포 결과는 `docs/deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 에 별도 기록한다.

### 판정 요약
- 핵심 업무 흐름과 관리자 기능은 구현되어 있고, `2026-03-31` 기준 `CoreWorkflowIntegrationTest` 기대값 최소 수정 후 `backend` `.\gradlew.bat test` 는 `BUILD SUCCESSFUL` (`67 tests completed`, 실패 없음), `frontend` `npm run build` 는 `tsc -b && vite build` 통과로 확인되었다.
- 세션 저장은 [`AssessmentService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/assessment/service/AssessmentService.java) 의 단일 트랜잭션 구조로 유지되고, 오등록/오입력 숨김 정책과 print/export 권한도 코드에 반영되어 있다.
- health endpoint, 활동 로그, 수동 백업, 관리자 승인/사용자 관리, 문서/스크립트 템플릿도 현재 저장소에 존재한다.
- `2026-03-30 00:41 KST` 기준 `.\gradlew.bat mariaDbTest --rerun-tasks` 가 `BUILD SUCCESSFUL`, `MariaDbCompatibilityTest` `tests=4`, `skipped=0` 으로 재확인되었다.
- `2026-03-30 00:38 KST` 기준 로컬 MariaDB 검증 환경에서 수동 백업이 `backupMethod=DB_DUMP`, `datasourceType=MARIADB` 로 성공했고 최신 `backup_histories` 와 `.sql` 파일까지 일치했다.
- 따라서 기존 `CONDITIONAL` blocker 는 해소되었고 현재 판정은 `READY` 이다.

---

## 2. 축별 평가 요약

| 평가 축 | 확인한 근거 | 현재 상태 | 필요한 조치 |
|---|---|---|---|
| 로그인/권한 | [`AuthService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/auth/service/AuthService.java), [`AccessPolicyService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/common/security/AccessPolicyService.java), [`docs/03-api-spec.md`](./03-api-spec.md) | 로그인, 세션 기반 권한, 관리자 권한 차단은 코드로 구현됨 | 운영 계정/권한 매트릭스만 배포 전 실제 계정으로 한 번 점검 |
| 대상자/세션 저장 정확성 | [`AssessmentService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/assessment/service/AssessmentService.java), [`docs/09-test-scenarios.md`](./09-test-scenarios.md) | 세션 저장은 서버 재계산 + 단일 트랜잭션, 롤백 테스트도 존재 | 운영 DB 계열에서 동일 흐름 한 번 더 검증 |
| 8종 척도 계산 및 통계 반영 | [`ScaleService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/scale/service/ScaleService.java), `backend/src/main/resources/scales/**/*.json`, [`StatisticsExportService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/statistics/service/StatisticsExportService.java) | 8종 정의 로딩과 통계/export 경로가 구현되어 있고 `2026-03-30` MariaDB 실검증까지 완료 | 실제 운영 데이터로 배포 직후 한 번 더 스모크 확인 |
| 오등록/오입력 숨김 정책 | [`AccessPolicyService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/common/security/AccessPolicyService.java), [`AssessmentService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/assessment/service/AssessmentService.java) | MISREGISTERED/MISENTERED 조회 제한과 상태값 처리가 코드에 반영됨 | 관리자/작성자 외 차단을 운영 계정으로 수동 확인 |
| print/export | [`AssessmentService#getSessionPrintData`](../backend/src/main/java/com/dasisuhgi/mentalhealth/assessment/service/AssessmentService.java), [`StatisticsExportService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/statistics/service/StatisticsExportService.java), [`docs/03-api-spec.md`](./03-api-spec.md) | print-data는 메모 제외, export는 관리자 전용 CSV로 동작 | 배포 직후 브라우저 인쇄와 CSV 다운로드 실기 확인 |
| 관리자 기능 | [`AdminService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/admin/service/AdminService.java), [`docs/03-api-spec.md`](./03-api-spec.md) | 승인/반려, 사용자 목록, 역할/상태 변경, requestId/userId 혼동 방지가 구현됨 | 운영자 계정으로 승인/반려 1회씩 확인 |
| 활동 로그 | [`ActivityLogService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/audit/service/ActivityLogService.java), [`RequestMetadataService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/common/web/RequestMetadataService.java) | 주요 성공 행위와 IP 저장 로직이 구현됨 | reverse proxy 사용 시 신뢰 header 설정 검증 필요 |
| 백업 | [`BackupService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/backup/service/BackupService.java), [`docs/11-deployment.md`](./11-deployment.md) | DB_DUMP 우선 + SNAPSHOT fallback, preflight, 이력 기록 구현 + `2026-03-30` 검증 환경에서 실제 `DB_DUMP` 성공 확인 | 실제 운영 반영 직전 실제 백업 경로와 dump command 값만 다시 대조 |
| health check | [`HealthController`](../backend/src/main/java/com/dasisuhgi/mentalhealth/health/controller/HealthController.java), [`HealthService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/health/service/HealthService.java), [`scripts/health-check.bat`](../scripts/health-check.bat) | 앱/DB/scale registry 상태 확인 가능 | 인증 없이 노출되므로 네트워크/프록시 레벨 접근 범위 점검 필요 |
| prod 설정/배포 스크립트 | `backend/src/main/resources/application-prod.yml`, `scripts/*.bat`, [`docs/11-deployment.md`](./11-deployment.md) | 템플릿과 순서는 준비됨 | 실제 기관 환경 값 주입과 실행 경로 검증 필요 |
| 문서 정합성 | [`README.md`](../README.md), [`docs/03-api-spec.md`](./03-api-spec.md), [`docs/09-test-scenarios.md`](./09-test-scenarios.md), [`docs/10-dev-setup.md`](./10-dev-setup.md), [`docs/11-deployment.md`](./11-deployment.md) | 현재 구현 범위와 운영 절차 문서가 대체로 맞춰져 있음 | 배포 담당자가 본 문서 기준으로 최종 체크 수행 |

---

## 3. 지금 당장 배포를 막는 항목

`2026-03-30` go-live 검증으로 기존 blocker 2건은 모두 해소되었다. 아래 증빙은 `검증 환경 결과` 기준이며, 실제 운영 배포 완료 기록은 아니다. 실제 운영 반영 시각과 결과는 `docs/deploy-results/YYYY-MM-DD.md` 에 별도 남긴다.

1. MariaDB/MySQL 실검증 완료
   - 확인한 근거: `backend/build/test-results/mariaDbTest/TEST-com.dasisuhgi.mentalhealth.MariaDbCompatibilityTest.xml` 에 `tests="4" skipped="0"` 기록
   - 현재 상태: `.\gradlew.bat mariaDbTest --rerun-tasks` 재실행 완료, `assessment-records`, `statistics/summary`, `statistics/scales`, `statistics/alerts`, `login` 검증 실제 수행
   - 비고: Windows + Docker Desktop 29.3.1 / Docker Desktop 4.66.1 환경에서 재확인

2. 검증 환경에서 DB_DUMP 실제 성공 확인 완료
   - 확인한 근거: `POST /api/v1/admin/backups/run` 응답 `status=SUCCESS`, `backupMethod=DB_DUMP`, `datasourceType=MARIADB`
   - 현재 상태: `backup_histories` 최신 이력과 생성된 `backup-20260330-003830-db-dump.sql` 파일이 일치
   - 비고: PowerShell 환경변수 주입 + Gradle daemon 조합으로 H2 fallback 이 섞일 수 있어, 이번 검증은 `bootRun --args` 로 datasource/backup 설정을 직접 넘겨 MariaDB 를 고정했다

---

## 4. 실제 운영 배포 전 최종 선행 조치

아래 항목을 끝내면 현재 저장소 상태로 실제 운영 배포 진행 가능하다. 실제 운영 반영을 수행했다면 결과는 `docs/deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 에 별도 기록한다.

1. Docker 가능 환경 또는 스테이징 DB 에서 MariaDB 호환 테스트 수행
2. 운영 설정 파일에 실제 DB 접속 정보, 백업 경로, `APP_TRUST_PROXY_HEADERS` 값 반영
3. 운영 백업 경로 writable 여부 확인
4. 수동 백업 1회 실행 후 `backup_histories` 와 생성 파일 검증
5. `/api/v1/health` 응답이 `UP` 인지 확인
6. reverse proxy 사용 시 `APP_TRUST_PROXY_HEADERS=true` 를 켜고, activity log IP 가 기대값으로 남는지 확인
7. `/api/v1/health` 가 내부망 또는 프록시 ACL 로만 노출되는지 확인

---

## 5. 배포 전 필수 확인 항목

아래 `[x]` 표시는 현재 readiness 증빙 범위에서 이미 확보된 항목을 뜻하며, 실제 운영 반영 완료 여부를 뜻하지 않는다. 실제 운영 배포 결과는 `docs/deploy-results/YYYY-MM-DD.md` 에 별도 기록한다.

- [x] `backend`: `.\gradlew.bat test` 성공
- [x] `backend`: `.\gradlew.bat mariaDbTest` 실제 실행 또는 동등한 MariaDB/MySQL 스모크 확인
- [x] `frontend`: `npm run build` 성공
- [ ] 운영용 `application-prod.yml` 또는 외부 설정값 준비 완료
- [ ] 운영 DB 접속 정보와 세션 타임아웃 값 점검
- [ ] 운영 백업 경로 존재 및 writable 확인
- [x] 수동 백업 1회 성공 확인
- [ ] `/api/v1/health` 가 `UP` 응답 확인
- [ ] 8종 scale registry 로딩 확인
- [ ] 관리자/일반 사용자 테스트 계정 또는 운영 계정 점검
- [ ] 내부망/프록시에서 `/api/v1/health` 접근 범위 점검
- [ ] reverse proxy 사용 시 `APP_TRUST_PROXY_HEADERS` 값 최종 확인

---

## 6. 배포 후 스모크 테스트

아래 항목은 실제 운영 배포 직후 다시 확인해야 하는 스모크 테스트다. 검증 환경에서의 성공 기록은 readiness 증빙으로 유지하되, 실제 운영 서버 결과와 혼용하지 않는다.

1. 관리자 로그인
2. 대상자 목록 조회
3. 대상자 등록
4. 최소 2종 척도 선택 후 세션 저장
5. 세션 상세 조회
6. print view 조회 및 브라우저 인쇄 확인
7. 검사기록 목록 조회
8. `statistics/summary` 조회
9. `statistics/scales` 조회
10. `statistics/alerts` 조회
11. statistics CSV export 다운로드
12. 관리자 승인/반려 1회 확인
13. 관리자 사용자 상태/역할 변경 1회 확인
14. 관리자 활동 로그 조회
15. 수동 백업 실행 또는 직전 백업 이력 확인
16. `/api/v1/health` 재확인

### 통과 기준
- 500 오류 없음
- 저장 후 상세 이동 정상
- 오등록/오입력 기본 숨김 유지
- print/export/admin 기능 접근 정상
- health 상태 `UP`

---

## 7. 롤백 판단 기준

아래 중 하나라도 발생하면 즉시 롤백 또는 배포 중지 판단 대상으로 본다.

- 로그인 불가 또는 다수 사용자 인증 실패
- 대상자 등록 또는 세션 저장 실패
- 저장 후 세션 상세 조회 실패
- 오등록/오입력 숨김 정책 붕괴
- 관리자 승인/반려 또는 사용자 상태 변경 실패
- `/api/v1/health` 가 `DOWN` 또는 503
- 수동 백업이 실패하고 대체 복구 수단이 없음
- 통계 조회 또는 CSV export 에서 반복 500 발생

---

## 8. 남은 미해결 이슈 우선순위표

### Resolved Blocker (`2026-03-30`)

| 이슈 | 확인한 근거 | 현재 상태 | 필요한 조치 |
|---|---|---|---|
| MariaDB/MySQL 실검증 완료 | `mariaDbTest` 결과 파일에 `tests="4" skipped="0"` | 운영 DB 계열과 동일한 SQL 실행 증거 확보 | 실제 운영 반영 직전 같은 명령 1회 재확인 권장 |
| 검증 환경 DB_DUMP 실성공 확인 | `backupMethod=DB_DUMP`, `datasourceType=MARIADB`, `.sql` 파일 및 최신 `backup_histories` 일치 | 복구 가능한 dump 파일 확보 확인 | 실제 운영 백업 경로/권한으로 동일 절차 1회 재확인 권장 |

### High

| 이슈 | 확인한 근거 | 현재 상태 | 필요한 조치 |
|---|---|---|---|
| `/api/v1/health` 인증 없음 | [`HealthController`](../backend/src/main/java/com/dasisuhgi/mentalhealth/health/controller/HealthController.java) | 내부망 전제면 허용 가능하지만 외부 노출 시 정보 노출 위험 | 프록시/방화벽/내부망 ACL 로 접근 범위 제한 |
| trusted proxy 설정 오용 가능 | [`RequestMetadataService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/common/web/RequestMetadataService.java), `application-prod.yml` | `APP_TRUST_PROXY_HEADERS=true` 를 잘못 켜면 spoofed IP 기록 가능 | 신뢰 가능한 reverse proxy 뒤에서만 활성화, 아니면 false 유지 |

### Medium

| 이슈 | 확인한 근거 | 현재 상태 | 필요한 조치 |
|---|---|---|---|
| `SNAPSHOT` 백업은 DB restore 파일이 아님 | [`BackupService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/backup/service/BackupService.java), [`docs/11-deployment.md`](./11-deployment.md) | 운영자가 “백업 성공”을 DB 복구 가능 상태로 오해할 수 있음 | 운영 체크리스트에 `backupMethod` 확인 절차 유지 |
| health 응답은 최소 상태만 확인 | [`HealthService`](../backend/src/main/java/com/dasisuhgi/mentalhealth/health/service/HealthService.java) | 앱/DB/scale registry 외 세부 하위 의존성 검증은 없음 | 배포 후 수동 스모크 테스트를 health와 별도로 수행 |

### Low

| 이슈 | 확인한 근거 | 현재 상태 | 필요한 조치 |
|---|---|---|---|
| 배포 스크립트는 템플릿 수준 | `scripts/deploy-backend.bat`, `scripts/deploy-frontend.bat` | 기관별 서비스 등록/로그 경로/권한은 별도 조정 필요 | 기관 환경에 맞는 실제 경로/서비스 래퍼만 추가 |
| 활동 로그/백업은 최소 운영 화면 수준 | [`docs/03-api-spec.md`](./03-api-spec.md), 현재 UI 범위 | 조회/필터/다운로드 고도화는 아직 아님 | 배포 후 안정화 단계에서 보강 |

---

## 9. 실제 운영 리스크와 추후 고도화 구분

### 실제 운영 리스크
- `/api/v1/health` 외부 노출 가능성
- trusted proxy 설정 오용 가능성
- `SNAPSHOT` 을 DB 복구 파일로 오해할 가능성

### 나중에 고도화하면 좋은 항목
- health endpoint 세부 지표 확장
- backup 실행 로그/성공률 대시보드
- 활동 로그 다운로드/고급 검색
- 백업 restore 자동화
- 배포 스크립트의 서비스 등록 자동화

---

## 10. 최종 권고

- 현재 저장소 상태는 핵심 기능/권한/문서/스크립트와 운영 직전 blocker 해소 증거까지 갖춰져 있어 `READY` 이다.
- 실제 운영 배포 직전에는 운영 DB 접속 정보, 백업 경로, reverse proxy / `APP_TRUST_PROXY_HEADERS` 값만 다시 대조하면 된다.
- 현재 `READY` 판정은 readiness 증빙 정리 완료와 배포 가능 상태 확보를 뜻하며, 실제 운영 반영 여부, 시작/완료 시각, 배포 후 결과는 `docs/deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 에 별도 기록한다.
- 현재 코드베이스와 문서 기준으로 실제 운영 배포 진행 가능하다.
