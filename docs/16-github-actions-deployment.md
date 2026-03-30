# GitHub Actions 배포 자동화 설정

## 개요

- 워크플로우 파일: `.github/workflows/deploy-production.yml`
- 배포 헬퍼 스크립트: `scripts/deploy-from-github-actions.ps1`
- 기본 동작:
  - `workflow_dispatch` 로 backend/frontend/backup/health check를 선택 실행 가능
  - 현재 저장소는 작업 내용을 GitHub에 자동 백업하므로, 의도치 않은 운영 반영을 막기 위해 자동 push 배포는 기본값으로 두지 않았다

## 전제 조건

- GitHub Actions self-hosted runner가 운영용 Windows 서버 또는 해당 서버에 접근 가능한 Windows 머신에 설치되어 있어야 한다.
- runner label은 기본 `self-hosted`, `windows`, `x64` 를 사용한다.
- 운영 서버에는 Java, Node.js, `mariadb-dump` 또는 `mysqldump` 가 필요한 방식으로 준비되어 있어야 한다.
- 이 저장소의 `scripts/deploy-backend.bat`, `scripts/deploy-frontend.bat`, `scripts/health-check.bat`, `scripts/run-backup.bat` 가 runner 환경에서 실행 가능해야 한다.

## GitHub Environment

`production` environment를 만들고 아래 값을 설정한다.

### Variables

- `APP_HOME`
  - 필수
  - 운영 배포 루트 경로
  - 예: `D:\apps\mental-health`
- `APP_HEALTHCHECK_URL`
  - 선택
  - health check 대상 URL
  - 미설정 시 `scripts/health-check.bat` 기본값 사용
- `APP_BACKUP_ROOT_PATH`
  - 선택
  - backend 배포 전에 backup을 돌릴 때 사용
- `APP_DB_DUMP_COMMAND`
  - 선택
  - 예: `D:\tools\MariaDB\bin\mariadb-dump.exe`
- `APP_BACKEND_STOP_COMMAND_PWSH`
  - 선택
  - backend 중지용 PowerShell 명령
  - 예: `Stop-Service -Name MentalHealthBackend`
- `APP_BACKEND_START_COMMAND_PWSH`
  - 선택
  - backend 시작용 PowerShell 명령
  - 예: `Start-Service -Name MentalHealthBackend`
- `APP_FRONTEND_POST_DEPLOY_COMMAND_PWSH`
  - 선택
  - 프론트 반영 후 필요한 후처리 PowerShell 명령
  - 예: `iisreset /noforce`

### Secrets

- `APP_DB_URL`
- `APP_DB_USERNAME`
- `APP_DB_PASSWORD`

위 3개 secret은 workflow에서 `run_backup=true` 로 backend 배포를 수행할 때 필요하다.

## 동작 순서

1. GitHub-hosted runner에서 backend test + bootJar 수행
2. GitHub-hosted runner에서 frontend build 수행
3. 산출물을 artifact로 업로드
4. Windows self-hosted runner에서 artifact 다운로드
5. 선택적으로 `scripts/run-backup.bat` 실행
6. `scripts/deploy-backend.bat`, `scripts/deploy-frontend.bat` 실행
7. 선택적으로 서비스 stop/start 또는 frontend 후처리 명령 실행
8. 선택적으로 `scripts/health-check.bat` 실행

## 주의사항

- 현재 저장소 기본 스크립트는 파일 배치만 담당한다.
- backend 서비스 재시작, IIS/Nginx 재시작, reverse proxy 반영은 environment variable에 넣은 PowerShell 명령으로 연결해야 한다.
- production 배포는 GitHub Actions 화면에서 수동 실행하는 방식이다.
- 저장소 자동 백업과 운영 배포를 분리했기 때문에, 개발 중 저장되는 commit이 즉시 운영 반영되지는 않는다.
