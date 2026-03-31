# Go-Live Checklist

## 1. 전제

- 현재 판정은 `READY` 이다.
- 이 문서는 실제 운영 직전 실행 순서와 통과 여부 체크에 집중한다.
- 운영 DB 접속 정보, 경로, 프록시 값, 담당자, 확인 방법 템플릿은 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 에서 관리한다.
- 운영 직전에는 먼저 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 에서 실제 값 입력 필요 항목과 담당자 기입 상태를 확인한 뒤, 본 문서 순서대로 실행 결과와 통과 여부를 체크한다.
- 오늘 목표였던 아래 2개 readiness blocker 는 검증 환경 기준으로 해소되었다.
  - MariaDB/MySQL 실검증 완료
  - 검증 환경에서 운영 절차 기준 `DB_DUMP` 실제 성공 확인
- 위 2개 blocker 해소와 `3-12` 오늘 검증 성공 반영을 기준으로 최종 판정을 `READY` 로 기록한다.
- 위 결과는 실제 운영 배포 완료를 뜻하지 않는다. 실제 운영 배포 여부와 시각은 `docs/deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 에 별도 기록한다.
- 상세 기준과 결과 기록은 아래 문서를 함께 본다.
  - [docs/12-release-readiness.md](./12-release-readiness.md)
  - [docs/13-pre-deploy-runbook.md](./13-pre-deploy-runbook.md)
  - [docs/14-deploy-result-template.md](./14-deploy-result-template.md) (`docs/deploy-results/YYYY-MM-DD.md` 작성을 위한 참조용 템플릿)
  - 일자별 실제 결과 문서는 `docs/deploy-results/YYYY-MM-DD.md` 형식으로 생성해 보관한다.

---

## 2. 오늘 검증 할 일 요약

- [x] 1. MariaDB/MySQL 실검증 실행
- [x] 2. 검증 환경에서 운영 절차 기준 `DB_DUMP` 수동 백업 확인
- [x] 3. `health` endpoint 확인
- [x] 4. 관리자 로그인 확인
- [x] 5. 대상자 등록 확인
- [x] 6. 최소 2종 멀티 척도 세션 저장 확인
- [x] 7. 세션 상세 확인
- [x] 8. `print view` 확인
- [x] 9. `statistics summary/scales/alerts` 확인
- [x] 10. `CSV export` 확인
- [x] 11. 활동 로그 확인
- [x] 12. 수동 백업 이력 확인
- [x] 13. `READY` 판정 및 배포 미실행 상태를 `docs/deploy-results/YYYY-MM-DD.md` 에 기록

---

## 3. 검증 환경 실행 체크리스트

- 참고: 아래 체크리스트에서 사용하는 실제 운영값, 경로, 계정, 프록시 결정값은 이 문서에 다시 채우지 않고 [docs/16-prod-config-checklist.md](./16-prod-config-checklist.md) 의 해당 항목을 기준으로 대조한다.

### [x] 1. MariaDB/MySQL 실검증 실행
- 해야 할 일: 운영과 같은 DB 계열의 스테이징 또는 검증 환경에서 `cd backend` 후 `.\gradlew.bat mariaDbTest` 를 실행하고 `backend/build/test-results/mariaDbTest/TEST-com.dasisuhgi.mentalhealth.MariaDbCompatibilityTest.xml` 을 확인한다.
- 성공 기준: `BUILD SUCCESSFUL`, `MariaDbCompatibilityTest` 가 `skipped=0`, `assessment-records`, `statistics/summary`, `statistics/scales`, `statistics/alerts` 검증이 실제 수행된다.
- 실패 시 조치: Docker 또는 대상 DB 연결 조건을 다시 확인하고 재실행한다. `skip` 또는 실패가 남아 있으면 오늘 배포는 진행하지 않는다.
- 실행 결과 (`2026-03-30 00:41 KST`):
  - `cd backend`
  - `.\gradlew.bat mariaDbTest --rerun-tasks`
  - `BUILD SUCCESSFUL`
  - `backend/build/test-results/mariaDbTest/TEST-com.dasisuhgi.mentalhealth.MariaDbCompatibilityTest.xml`
  - `tests=4`, `skipped=0`, `failures=0`, `errors=0`
  - 수행 확인: `assessmentRecordsProjectionFilterAndPageableWorkOnMariaDb`, `statisticsSummaryAndScalesAggregateCorrectlyOnMariaDb`, `statisticsAlertsFiltersByScaleCodeAndAlertTypeOnMariaDb`, `loginWorksAgainstMariaDbContainer`
  - 비고: Windows + Docker Desktop 29.3.1 / Docker Desktop 4.66.1 환경에서 재실행했다. `backend/build.gradle` 의 Docker API `1.44` workaround 가 그대로 적용되었다.

### [x] 2. DB_DUMP 수동 백업 확인
- 해야 할 일: 관리자 화면 또는 `POST /api/v1/admin/backups/run` 으로 수동 백업을 1회 실행하고 사유는 `배포 직전 수동 백업` 으로 남긴다.
- 성공 기준: 응답 또는 화면에서 `status=SUCCESS`, `backupMethod=DB_DUMP`, `datasourceType=MARIADB` 또는 `MYSQL` 이 확인되고 실제 `.sql` 파일이 백업 경로에 생성된다.
- 실패 시 조치: `mariadb-dump`/`mysqldump` 설치, PATH, DB 계정 권한, 백업 경로 쓰기 권한을 확인한다. `backupMethod=SNAPSHOT` 만 나온 경우 blocker 해소로 보지 않고 배포를 진행하지 않는다.
- 실행 결과 (`2026-03-30 00:38 KST`, 로컬 MariaDB 검증 환경):
  - 백엔드 실행: `cd backend` 후 `.\gradlew.bat --no-daemon bootRun --args="--spring.profiles.active=local --server.port=18083 --spring.datasource.url=jdbc:mariadb://127.0.0.1:3307/mental_health_local?useUnicode=true&characterEncoding=utf8 --spring.datasource.username=mental_user --spring.datasource.password=mental_pass --spring.datasource.driver-class-name=org.mariadb.jdbc.Driver --app.backup.root-path=D:\dasiseogi-mental-health-intranet-template\local-backups\go-live-mariadb-check --app.backup.db-dump-command=D:\dasiseogi-mental-health-intranet-template\tmp\mariadb\dist\MariaDB-12.2\bin\mariadb-dump.exe"`
  - datasource: `jdbc:mariadb://127.0.0.1:3307/mental_health_local`
  - `POST /api/v1/admin/backups/run`
  - 요청 사유: `배포 직전 수동 백업`
  - 응답: `status=SUCCESS`, `backupMethod=DB_DUMP`, `datasourceType=MARIADB`
  - `preflightSummary`: `datasource=MARIADB, preferred=DB_DUMP, dumpCommand=D:\\dasiseogi-mental-health-intranet-template\\tmp\\mariadb\\dist\\MariaDB-12.2\\bin\\mariadb-dump.exe, dumpAvailable=true, fallback=-`
  - 생성 파일: `d:\dasiseogi-mental-health-intranet-template\local-backups\go-live-mariadb-check\backup-20260330-003830-db-dump.sql`
  - 비고: PowerShell 환경변수 주입과 Gradle daemon 조합으로 H2 fallback 이 섞일 수 있어, 이번 검증은 `bootRun --args` 로 datasource/backup 설정을 직접 넘겨 MariaDB 를 고정했다.

### [x] 3. health endpoint 확인
- 해야 할 일: `scripts\health-check.bat` 또는 `GET /api/v1/health` 로 앱 상태를 확인한다.
- 성공 기준: HTTP 200, `status=UP`, `appStatus=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP`, `loadedScaleCount` 가 기대 척도 수와 일치한다.
- 실패 시 조치: 앱 로그, DB 연결 정보, scale JSON 배치 상태를 확인한다. `DOWN` 또는 503 이면 배포를 중지하거나 즉시 롤백 검토한다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - `GET /api/v1/health` 확인 통과
  - HTTP 200
  - `status=UP`, `appStatus=UP`, `dbStatus=UP`, `scaleRegistryStatus=UP`, `loadedScaleCount=8`
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 4. 관리자 로그인 확인
- 해야 할 일: 운영 관리자 계정으로 로그인하고 관리자 메뉴(승인 대기, 사용자 관리, 로그 확인, 백업 관리) 노출 여부를 확인한다.
- 성공 기준: 로그인 성공, 관리자 메뉴 접근 가능, 일반 사용자 계정에서는 관리자 메뉴가 보이지 않는다.
- 실패 시 조치: 계정 상태 `ACTIVE`, 역할 `ADMIN`, 세션/쿠키 동작을 확인한다. 로그인 또는 권한 오류가 반복되면 배포를 진행하지 않는다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - 관리자 로그인 성공
  - 관리자 기능 접근 확인 완료
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 5. 대상자 등록 확인
- 해야 할 일: 테스트용 대상자 1명을 신규 등록하고 저장 직후 상세 화면으로 이동하는지 확인한다.
- 성공 기준: 대상자 등록이 성공하고 `clientNo` 가 생성되며 상세 화면이 정상 표시된다.
- 실패 시 조치: 필수 입력값, 중복 경고, 서버 응답, DB 쓰기 상태를 확인한다. 신규 대상자 등록이 실패하면 배포를 진행하지 않는다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - 테스트 대상자 신규 등록 성공
  - `clientNo` 생성 및 상세 이동 확인
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 6. 최소 2종 멀티 척도 세션 저장 확인
- 해야 할 일: 방금 만든 대상자 또는 사전 준비된 대상자에서 최소 2종 척도 세션을 저장한다. 빠른 검증은 `PHQ-9` + `GAD-7` 조합을 권장한다.
- 성공 기준: 세션 저장이 성공하고 `sessionNo` 가 생성되며 저장 후 세션 상세로 정상 이동한다.
- 실패 시 조치: 문항 응답 누락 여부, 척도 선택 중복 여부, DB 쓰기 오류, 서버 로그를 확인한다. 멀티 척도 저장 실패는 즉시 롤백 또는 배포 중지 사유다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - 최소 2종 멀티 척도 세션 저장 성공
  - `sessionNo` 생성 및 저장 후 상세 이동 확인
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 7. 세션 상세 확인
- 해야 할 일: 방금 저장한 세션 상세 화면에서 대상자 요약, 척도 결과, 문항 응답, 경고, 메모 표시를 확인한다.
- 성공 기준: 상세 화면이 500 없이 열리고 총점, 판정, 경고가 정상 표시된다.
- 실패 시 조치: 저장 직후 응답, 세션 ID 전달, 상세 조회 API, 서버 로그를 확인한다. 상세 조회 실패가 반복되면 배포를 진행하지 않는다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - 세션 상세 조회 성공
  - 총점, 판정, 경고 표시 정상 확인
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 8. print view 확인
- 해야 할 일: 같은 세션의 `print view` 를 열고 브라우저 인쇄 화면까지 확인한다.
- 성공 기준: `print view` 가 정상 표시되고 인쇄 화면이 열리며 세션 메모는 포함되지 않는다.
- 실패 시 조치: `print-data` API 응답, 브라우저 인쇄 동작, 권한 오류를 확인한다. `print view` 가 깨지거나 500 이면 롤백 검토 대상이다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - `print view` 정상 표시 및 인쇄 화면 확인
  - 세션 메모 미포함 확인
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 9. statistics summary/scales/alerts 확인
- 해야 할 일: 통계 화면 또는 API에서 `statistics/summary`, `statistics/scales`, `statistics/alerts` 를 순서대로 조회한다.
- 성공 기준: 세 화면 또는 응답이 모두 정상으로 열리고 방금 저장한 데이터가 집계에 반영되며 500 오류가 없다.
- 실패 시 조치: 기간 필터, 오입력 제외 정책, 통계 쿼리 로그, MariaDB/MySQL 실검증 결과를 다시 확인한다. 셋 중 하나라도 실패하면 배포를 유지하지 않는다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - `statistics/summary`, `statistics/scales`, `statistics/alerts` 모두 정상 확인
  - 오늘 저장 데이터 반영 및 500 오류 없음
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 10. CSV export 확인
- 해야 할 일: 관리자 계정으로 statistics CSV export 를 1회 실행해 파일 다운로드까지 확인한다.
- 성공 기준: CSV 파일이 정상 다운로드되고 빈 파일이 아니며 인코딩 또는 컬럼이 깨지지 않는다.
- 실패 시 조치: 관리자 권한, export temp 경로, 브라우저 다운로드 정책, 서버 로그를 확인한다. export 실패가 반복되면 롤백 검토 대상이다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - CSV export 성공
  - 다운로드, 파일 내용, 인코딩/컬럼 확인 통과
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 11. 활동 로그 확인
- 해야 할 일: `/admin/logs` 에서 오늘 실행한 로그인, 대상자 등록, 세션 저장, print, CSV export, 수동 백업 기록을 최신순으로 확인한다.
- 성공 기준: 최소 `LOGIN`, `CLIENT_CREATE`, `SESSION_CREATE`, `PRINT_SESSION`, `STATISTICS_EXPORT`, `BACKUP_RUN` 이 남고 사용자, 시각, IP 가 기대값으로 기록된다.
- 실패 시 조치: reverse proxy 사용 시 `APP_TRUST_PROXY_HEADERS` 값과 로그 적재 로직을 확인한다. 주요 행위가 누락되면 배포를 유지하지 않는다.
- 실행 결과 (`2026-03-30`, 오늘 검증 기준):
  - `LOGIN`, `CLIENT_CREATE`, `SESSION_CREATE`, `PRINT_SESSION`, `STATISTICS_EXPORT`, `BACKUP_RUN` 확인
  - 사용자, 시각, IP 기록 확인
  - 오늘 검증 결과 기준으로 성공 처리

### [x] 12. 수동 백업 이력 확인
- 해야 할 일: 백업 관리 화면 또는 DB에서 `backup_histories` 최신 1건 이상을 확인한다.
- 성공 기준: 조금 전 수동 백업 결과가 성공 상태로 남고 `backupMethod=DB_DUMP`, 실행 시각, 실행자, 파일 정보가 일치한다.
- 실패 시 조치: 백업 API 응답과 실제 파일명을 다시 대조한다. 이력이 없거나 `DB_DUMP` 가 아니면 blocker 해소로 보지 않고 배포를 중지한다.
- 확인 결과 (`2026-03-30 00:38 KST`, `GET /api/v1/admin/backups?status=SUCCESS&page=1&size=3`):
  - 최신 이력: `backupId=2`, `status=SUCCESS`, `backupMethod=DB_DUMP`
  - 실행자: `관리자A`
  - 파일명: `backup-20260330-003830-db-dump.sql`
  - 파일경로: `d:\dasiseogi-mental-health-intranet-template\local-backups\go-live-mariadb-check\backup-20260330-003830-db-dump.sql`
  - 파일크기: `17679 bytes`

### [x] 13. 롤백 판단 기준 확인
- 해야 할 일: 아래 항목 중 하나라도 발생했는지 확인하고 해당되면 실제 운영 배포를 중지하거나 롤백 대상으로 판단한다.
- 성공 기준: 아래 모든 항목이 `아니오` 이다.
  - 로그인 불가 또는 권한 오류 반복
  - 대상자 등록 실패
  - 최소 2종 멀티 척도 세션 저장 실패
  - 세션 상세 또는 `print view` 실패
  - `statistics/summary`, `statistics/scales`, `statistics/alerts` 중 하나라도 실패
  - CSV export 실패
  - 활동 로그 누락
  - 수동 백업 실패 또는 `backupMethod=SNAPSHOT`
  - `health` endpoint `DOWN` 또는 503
  - MariaDB/MySQL 실검증 미완료
- 실패 시 조치: 새 버전 운영 반영 결정을 중지하고 [docs/11-deployment.md](./11-deployment.md) 의 롤백 절차를 따른다. 결과는 `docs/deploy-results/YYYY-MM-DD.md` 에 즉시 기록한다.
- 판단 결과 (`2026-03-30`, 오늘 검증 기준):
  - 위 배포 중지 조건 모두 `아니오`
  - `1`, `2`, `12` blocker 해소 완료
  - `3-11` 오늘 검증 기준 성공 반영 완료
  - 최종 판단: `READY` 판정 유지
  - 실제 운영 배포 진행 여부: `미실행`
