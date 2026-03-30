# Pre-Deploy Runbook

## 1. 목적

- 이 문서는 현재 `docs/12-release-readiness.md` 가 `READY` 인 상태에서 배포 직전에 실행할 절차를 정리한다.
- `READY` 는 배포 가능 판정이며, 실제 운영 배포 완료를 뜻하지 않는다.
- 따라서 본 문서는 `READY` 판정 이후 실제 운영 반영 직전에 운영 담당자가 수행해야 하는 확인 절차를 실행 순서대로 정리한다.
- 검증 환경에서 확보한 증빙과 실제 운영 배포 결과는 [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 템플릿을 참고해 `./deploy-results/YYYY-MM-DD.md` 에 분리 기록한다.

---

## 2. 실행 전 준비

### 2.1 필수 준비물

- [ ] 운영 또는 스테이징 백엔드 실행 환경 접근 권한
- [ ] MariaDB/MySQL 접속 정보
- [ ] 관리자 계정 ID/비밀번호
- [ ] 배포 대상 backend jar 경로 확인
- [ ] 배포 대상 frontend `dist` 경로 확인
- [ ] `APP_HOME` 또는 운영 앱 루트 경로 확인
- [ ] 백업 저장 경로 접근 권한
- [ ] reverse proxy 사용 여부 확인
- [ ] `mariadb-dump` 또는 `mysqldump` 설치 여부 확인

### 2.2 참고 문서

- 판정 기준: [docs/12-release-readiness.md](./12-release-readiness.md)
- 배포 절차: [docs/11-deployment.md](./11-deployment.md)
- 테스트 시나리오: [docs/09-test-scenarios.md](./09-test-scenarios.md)
- API 기준: [docs/03-api-spec.md](./03-api-spec.md)

## 2.3 운영 스크립트 사용 범위

이번 배포/runbook 에서 사용하는 운영 스크립트는 아래 5개다.

- `scripts\run-local-mariadb-backend.ps1`
  - source 기반 검증 환경에서 backend 를 `bootRun --args` 로 기동하는 표준 스크립트다.
  - `local` profile, MariaDB datasource, backup root path, dump command, scale resource path, export temp path 를 직접 고정한다.
  - PowerShell 환경변수 주입 + Gradle daemon 조합에서 H2 기본값이 섞이는 위험을 줄이기 위해 사용한다.

- `scripts\health-check.bat`
  - `/api/v1/health` 응답을 확인한다.
  - 무인자 실행 시 기본 대상 `http://127.0.0.1:8080/api/v1/health` 를 사용한다.
  - 인자 1에는 base URL (`http://127.0.0.1:8080/api/v1`) 또는 full `/health` URL (`http://127.0.0.1:8080/api/v1/health`) 을 받을 수 있다.
  - 인자 1은 `http://` 또는 `https://` URL만 지원한다.
- `scripts\run-backup.bat`
  - 운영자용 직접 DB dump 파일 생성 보조 스크립트다.
  - 명령행 인자는 받지 않고 환경 변수만 사용한다.
  - `/api/v1/admin/backups/run` 대체 용도가 아니며 `backup_histories` 적재를 수행하지 않는다.
- `scripts\deploy-backend.bat`
  - backend jar 배치 보조 스크립트다.
  - 인자 1로 배포 대상 jar 파일 경로를 필수로 받는다.
  - 인자 1은 실제 존재하는 `.jar` 파일이어야 하며, 디렉터리 경로는 허용하지 않는다.
  - `APP_HOME` 이 있으면 해당 경로를, 없으면 스크립트 기준 상위 경로를 앱 루트로 해석한다.
  - 기존 backend 프로세스는 운영자가 먼저 수동 중지해야 하며, 스크립트는 서비스 시작/중지를 수행하지 않는다.
  - 기존 jar 가 있으면 `app\backend\backup\mental-health-app-YYYYMMDD-HHMMSS.jar` 형식으로 백업한다.
- `scripts\deploy-frontend.bat`
  - frontend `dist` 배치 보조 스크립트다.
  - 인자 1로 배포 대상 `dist` 디렉터리 경로를 필수로 받고, `index.html` 가 존재하고 해당 경로가 디렉터리가 아닌 실제 파일인지 검증한다.
  - `APP_HOME` 이 있으면 해당 경로를, 없으면 스크립트 기준 상위 경로를 앱 루트로 해석한다.
  - 기존 `dist` 는 `backups/release/frontend-dist-YYYYMMDD-HHMMSS/` 아래에 백업하고 `temp/deploy-frontend-YYYYMMDD-HHMMSS` 경로를 거쳐 최종 교체한다.
  - 웹서버 재시작, health check 호출, IIS/Nginx 설정 반영, cache invalidation 확인, 정적 파일 서비스 전환 확인은 별도 운영 절차다.

- 4개 운영 배치 스크립트(`health-check.bat`, `run-backup.bat`, `deploy-backend.bat`, `deploy-frontend.bat`)는 성공 시 종료코드 `0`, 실패 시 `0` 이외 값을 반환한다.

아래 작업은 위 스크립트 범위에 포함되지 않는다.

- 서비스 시작/중지
- 백엔드 프로세스 재기동
- 웹서버 재시작
- IIS/Nginx 설정 변경
- `backup_histories` 적재

즉, `backup_histories` 확인은 관리자 화면/API 기반 수동 백업으로 별도 검증해야 하며, 웹서버 반영과 서비스 제어도 운영자가 수동 수행해야 한다.

---

## 3. 배포 직전 실행 순서

주의:
- `3.1` 부터 `3.7` 까지 검증 환경에서 다시 수행한 결과는 `./deploy-results/YYYY-MM-DD.md` 의 `검증 환경 결과` 에 기록한다.
- 실제 운영 서버 또는 운영 DB 에서 실제 반영과 함께 수행한 결과만 `./deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 에 기록한다.

## 3.1 로컬/CI 기본 결과 확인

1. 백엔드 회귀 테스트 결과를 확인한다.

```powershell
cd backend
.\gradlew.bat test
```

확인 기준:
- [ ] `BUILD SUCCESSFUL`

2. 프론트 빌드 결과를 확인한다.

```powershell
cd frontend
npm run build
```

확인 기준:
- [ ] build 성공

---

## 3.2 MariaDB/MySQL 실검증 확인 절차

목적:
- `mariaDbTest` 가 더 이상 skip 상태가 아닌지 확인한다.
- 실제 운영 DB 계열에서 조회/집계 SQL 이 정상 동작하는지 확인한다.

실행:

```powershell
cd backend
.\gradlew.bat mariaDbTest
```

확인 기준:
- [ ] `BUILD SUCCESSFUL`
- [ ] `MariaDbCompatibilityTest` 가 `skipped=0`
- [ ] 아래 4개 검증이 실제 수행됨
  - `assessment-records projection/filter/pageable`
  - `statistics/summary`
  - `statistics/scales`
  - `statistics/alerts`

결과 기록 위치:
- `backend/build/test-results/mariaDbTest/TEST-com.dasisuhgi.mentalhealth.MariaDbCompatibilityTest.xml`

실패 또는 skip 시 조치:
- [ ] Docker 실행 상태 확인
- [ ] Docker 기반이 어렵다면 스테이징 MariaDB/MySQL 에서 동등 수동 검증 수행
- [ ] skip 또는 실패 상태면 이번 배포는 진행하지 않는다

---

## 3.3 운영 설정 확인

확인 파일:
- `backend/src/main/resources/application-prod.yml`
- 실제 운영 외부 설정 파일 또는 환경변수

체크:
- [ ] `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DRIVER` 값 확인
- [ ] `APP_SCALE_RESOURCE_PATH` 값 확인 (`classpath:scales` 또는 운영 scale 디렉터리 경로)
- [ ] `APP_EXPORT_TEMP_PATH` 값 확인 (writable export temp 디렉터리)
- [ ] `APP_BACKUP_ROOT_PATH` 확인
- [ ] `APP_DB_DUMP_COMMAND` 확인
- [ ] reverse proxy 뒤라면 `APP_TRUST_PROXY_HEADERS=true`, 아니면 `false`
- [ ] 운영 scale JSON 세트가 최신인지 확인

주의:
- `APP_TRUST_PROXY_HEADERS=true` 는 신뢰 가능한 프록시 뒤에서만 사용한다.
- source 기반 local/staging 검증에서는 `APP_DB_*` 환경변수로 `bootRun` 을 띄우지 않고 `scripts\run-local-mariadb-backend.ps1` 를 사용한다.

검증 환경에서 source 기반 backend 기동이 필요하면 아래 예시처럼 실행한다.

```powershell
.\scripts\run-local-mariadb-backend.ps1 `
  -DbHost 127.0.0.1 `
  -DbPort 3306 `
  -DbName mental_health_local `
  -DbUsername mental_user `
  -DbPassword mental_pass `
  -ServerPort 18080 `
  -BackupRootPath .\local-backups `
  -DbDumpCommand "C:\Program Files\MariaDB 11.4\bin\mariadb-dump.exe" `
  -ScaleResourcePath classpath:scales `
  -ExportTempPath .\tmp\exports
```

설명:
- 이 스크립트는 `bootRun --args` 로 `local + MariaDB + backup/export/scale path` 를 직접 넘긴다.
- 필수 DB 인자, backup/export 경로, dump command 경로를 먼저 점검하고 실패 시 즉시 중단한다.
- backup dump command 점검을 이번 실행에서 제외할 때만 `-SkipBackupCheck` 를 붙인다.

---

## 3.4 health endpoint 확인 절차

목적:
- 앱, DB, scale registry 상태를 배포 전 또는 직후 즉시 확인한다.

실행 1: 스크립트

```powershell
scripts\health-check.bat
scripts\health-check.bat "http://127.0.0.1:8080/api/v1"
scripts\health-check.bat "http://127.0.0.1:8080/api/v1/health"
```

실행 2: 직접 호출

```powershell
curl http://127.0.0.1:8080/api/v1/health
```

주의:
- `scripts\health-check.bat` 는 무인자 실행 시 기본 health URL 을 확인한다.
- 인자 1은 base URL 과 full `/health` URL 둘 다 받을 수 있다.
- 인자 1은 `http://` 또는 `https://` URL만 지원한다.

확인 기준:
- [ ] HTTP 200
- [ ] `status=UP`
- [ ] `appStatus=UP`
- [ ] `dbStatus=UP`
- [ ] `scaleRegistryStatus=UP`
- [ ] `loadedScaleCount` 가 예상 척도 수와 일치

실패 시 조치:
- [ ] 앱 로그 확인
- [ ] DB 연결 정보 확인
- [ ] scale registry 파일 배치 상태 확인
- [ ] `DOWN` 이면 배포 진행하지 않는다

---

## 3.5 관리자 로그인 및 권한 확인

목적:
- 관리자 계정이 실제 운영 환경에서 로그인 가능하고 관리자 메뉴/API 접근이 되는지 확인한다.

체크:
- [ ] 관리자 계정 로그인 성공
- [ ] 관리자 메뉴 노출 확인
  - 승인 대기
  - 사용자 관리
  - 로그 확인
  - 백업 관리
- [ ] 일반 사용자 계정으로 관리자 메뉴 미노출 확인

실패 시 조치:
- [ ] 사용자 상태가 `ACTIVE` 인지 확인
- [ ] 역할이 `ADMIN` 인지 확인
- [ ] 세션/쿠키 동작 확인

---

## 3.6 운영자 직접 DB dump 파일 생성 확인 절차

목적:
- 운영 절차 기준 운영자 직접 DB dump 파일 생성이 실제로 성공하는지 확인한다.

사전 확인:
- [ ] 백업 경로가 존재한다
- [ ] 백업 경로 writable 이다
- [ ] `mariadb-dump` 또는 `mysqldump` 실행 가능하다
- [ ] `APP_BACKUP_ROOT_PATH`, `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` 값을 준비했다

실행:

```powershell
$env:APP_BACKUP_ROOT_PATH = "<backup-root-path>"
$env:APP_DB_URL = "<jdbc-url>"
$env:APP_DB_USERNAME = "<db-username>"
$env:APP_DB_PASSWORD = "<db-password>"
$env:APP_DB_DUMP_COMMAND = "<dump-command-or-path>"
scripts\run-backup.bat
```

확인 기준:
- [ ] 스크립트 종료 코드가 `0`
- [ ] `db-backup-YYYYMMDD-HHMMSS.sql` 형식 파일이 실제 경로에 생성됨
- [ ] 생성 파일 크기가 `0` 보다 큼
- [ ] 출력된 datasource 정보가 의도한 운영 DB 와 일치함

주의:
- `APP_DB_DUMP_COMMAND` 는 PATH 에 `mariadb-dump` 또는 `mysqldump` 가 잡혀 있으면 생략 가능하다.
- 이 스크립트는 dump 파일 생성만 수행하며 `/api/v1/admin/backups/run` 호출이나 `backup_histories` 적재는 수행하지 않는다.
- 검증 환경에서 수행한 경우 `검증 환경 결과` 에 기록한다.
- 실제 운영 서버에서 수행한 경우에만 `실제 운영 배포 결과` 에 기록한다.

실패 시 조치:
- [ ] dump command PATH 또는 설정값 확인
- [ ] DB 계정 권한 확인
- [ ] 백업 경로 권한 확인
- [ ] `APP_DB_URL` 이 MariaDB/MySQL JDBC URL 형식인지 확인
- [ ] 같은 오류가 반복되면 배포 진행하지 않는다

---

## 3.7 앱 수동 백업 이력 확인 절차

목적:
- 관리자 화면/API 기준 `DB_DUMP` 수동 백업과 `backup_histories` 적재가 실제로 성공하는지 확인한다.

사전 확인:
- [ ] 백업 경로가 존재한다
- [ ] 백업 경로 writable 이다
- [ ] `mariadb-dump` 또는 `mysqldump` 실행 가능하다

실행:
1. 관리자 로그인
2. `/admin/backups` 화면 진입
3. 수동 백업 실행
4. 사유 입력 예시: `배포 직전 수동 백업`

또는 API 호출:

```http
POST /api/v1/admin/backups/run
Content-Type: application/json

{
  "reason": "배포 직전 수동 백업"
}
```

확인 기준:
- [ ] 응답 `status=SUCCESS`
- [ ] 응답 `backupMethod=DB_DUMP`
- [ ] 응답 `datasourceType=MARIADB` 또는 `MYSQL`
- [ ] `preflightSummary` 에 dump command 정보가 있음
- [ ] 생성 파일이 실제 경로에 존재
- [ ] `backup_histories` 최근 1건이 성공 상태

주의:
- `backupMethod=SNAPSHOT` 이면 blocker 해소가 아니다.
- `SNAPSHOT` 성공은 참고 정보일 뿐, 운영 DB restore 가능 상태 확인으로 보지 않는다.
- `scripts\run-backup.bat` 성공만으로는 이 항목을 통과로 보지 않는다.
- 검증 환경에서 수행한 경우 `검증 환경 결과` 에 기록한다.
- 실제 운영 서버에서 수행한 경우에만 `실제 운영 배포 결과` 에 기록한다.

실패 시 조치:
- [ ] dump command PATH 또는 설정값 확인
- [ ] DB 계정 권한 확인
- [ ] 백업 경로 권한 확인
- [ ] 같은 오류가 반복되면 배포 진행하지 않는다

---

## 3.8 배포 수행

1. 현재 운영 버전 백업
2. 새 백엔드 jar 배치
3. 새 프론트 빌드 반영
4. 설정 파일/척도 JSON 최종 확인
5. 앱 재기동

예시 명령:

```powershell
$env:APP_HOME = "<app-home>"
scripts\deploy-backend.bat "<release-jar-path>"
scripts\deploy-frontend.bat "<release-dist-path>"
```

주의:
- `scripts\deploy-backend.bat` 실행 전 기존 backend 프로세스는 운영자가 수동 중지해야 한다.
- `scripts\deploy-backend.bat` 는 인자 1로 전달한 실제 `.jar` 파일을 `app\backend\mental-health-app.jar` 로 배치하고, 기존 jar 가 있으면 `app\backend\backup\mental-health-app-YYYYMMDD-HHMMSS.jar` 형식으로 백업한다.
- `scripts\deploy-backend.bat` 는 jar 배치와 기존 jar 백업만 수행하며, 서비스 시작은 수행하지 않는다.
- `scripts\deploy-frontend.bat` 는 인자 1로 전달한 `dist` 디렉터리를 `app\frontend\dist` 로 교체하며, `index.html` 가 존재하고 디렉터리가 아닌 실제 파일인지 확인한다.
- `scripts\deploy-frontend.bat` 는 기존 dist 를 `backups/release/frontend-dist-YYYYMMDD-HHMMSS/` 아래에 백업하고 `temp/deploy-frontend-YYYYMMDD-HHMMSS` 경유로 교체한다.
- 웹서버 재시작, health check 호출, IIS/Nginx 설정 반영, cache invalidation 확인, 정적 파일 서비스 전환은 별도 운영 절차로 수행한다.
- `scripts\deploy-frontend.bat` 실행 성공만으로 정적 파일 서비스 전환 완료까지 보장하지는 않는다.

기록:
- [ ] 배포 시작 시각
- [ ] 배포 완료 시각
- [ ] 배포 담당자
- [ ] 검수 담당자
- [ ] 배포 버전/커밋/브랜치
- [ ] [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 템플릿을 참고해 `docs/deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 작성

---

## 3.9 배포 후 스모크 테스트

### A. 대상자/세션 흐름

1. 관리자 로그인
2. 대상자 등록
3. 대상자 상세 진입
4. 최소 2종 멀티 척도 선택
5. 세션 저장
6. 세션 상세 조회
7. print view 조회
8. 브라우저 인쇄 화면 확인

확인 기준:
- [ ] 저장 성공
- [ ] 세션 번호 생성 정상
- [ ] 총점/판정/경고 노출 정상
- [ ] print view 에 세션 메모 미포함

### B. 통계/출력

1. `statistics/summary` 확인
2. `statistics/scales` 확인
3. `statistics/alerts` 확인
4. CSV export 실행

확인 기준:
- [ ] summary 값 조회 정상
- [ ] scales 집계 정상
- [ ] alerts 목록 조회 정상
- [ ] CSV 다운로드 성공

### C. 관리자/감사

1. 승인 대기 목록 진입
2. 사용자 관리 진입
3. 활동 로그 조회
4. 수동 백업 이력 조회
5. `scripts\health-check.bat` 또는 `/api/v1/health` 재확인

확인 기준:
- [ ] 관리자 API/화면 접근 정상
- [ ] 활동 로그 최신 행 확인 가능
- [ ] 백업 이력 최신 행 확인 가능
- [ ] health 상태 `UP`

재확인 예시:

```powershell
scripts\health-check.bat
```

---

## 4. 활동 로그 확인 절차

목적:
- 배포 직전/직후 주요 성공 행위가 감사 로그에 남는지 확인한다.

확인 대상:
- [ ] 로그인 성공
- [ ] 대상자 등록
- [ ] 세션 저장
- [ ] print-data 조회 또는 print 실행
- [ ] statistics export 실행
- [ ] 수동 백업 실행

확인 방법:
1. `/admin/logs` 진입
2. 최신순 정렬 확인
3. 필요 시 `actionType`, 날짜 범위로 필터

확인 기준:
- [ ] `userId`, `userNameSnapshot`, `actionType`, `targetType`, `targetId`, `description`, `createdAt` 확인 가능
- [ ] reverse proxy 사용 환경이면 IP 값이 기대대로 적재됨

---

## 5. 롤백 판단 기준

아래 중 하나라도 해당되면 즉시 롤백 또는 배포 중지 판단을 한다.

- [ ] 로그인 실패 또는 권한 오류가 반복 발생
- [ ] 대상자 등록 실패
- [ ] 최소 2종 멀티 척도 세션 저장 실패
- [ ] 세션 상세 또는 print view 실패
- [ ] `statistics/summary`, `statistics/scales`, `statistics/alerts` 중 하나라도 500 오류 발생
- [ ] CSV export 실패
- [ ] 활동 로그가 주요 행위를 기록하지 않음
- [ ] 수동 백업 실패
- [ ] `/api/v1/health` 가 `DOWN` 또는 503
- [ ] blocker 2개 중 하나라도 미해소

---

## 6. 실행 완료 후 반드시 남길 기록

- [ ] [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 템플릿을 참고해 `docs/deploy-results/YYYY-MM-DD.md` 형식의 일자별 결과 문서 생성 또는 작성 완료
- [ ] `검증 환경 결과` 와 `실제 운영 배포 결과` 분리 기록 완료
- [ ] MariaDB/MySQL 실검증 결과 첨부
- [ ] 수동 백업 결과 첨부
- [ ] health 응답 캡처 또는 로그 첨부
- [ ] 최종 배포 승인자 확인
