# Worklog

이 폴더는 날짜별 작업 로그를 쌓아두는 용도입니다.

## 구조
- `daily/YYYY/YYYY-MM-DD.md`: 날짜별 작업 로그
- `_template.md`: 새 로그 파일을 만들 때 사용하는 기본 템플릿

## 사용법
아래 명령을 실행하면 오늘 날짜 로그 파일이 생성되거나 갱신됩니다.

```powershell
.\scripts\update-worklog.bat
```

직접 날짜를 지정하려면 다음처럼 실행합니다.

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\update-worklog.ps1 -Date 2026-03-30
```

GitHub까지 자동 반영하려면 아래 명령으로 worklog만 커밋하고 푸시할 수 있습니다.

```powershell
.\scripts\publish-worklog.bat
```

매일 자동 실행을 등록하려면 아래 명령을 한 번만 실행하면 됩니다.

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-worklog-autopush-task.ps1 -DailyTime 23:50
```

자동 실행 해제가 필요하면 아래 명령을 사용합니다.

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\unregister-worklog-autopush-task.ps1
```

## 자동으로 들어가는 내용
- 현재 브랜치
- 오늘 커밋 목록
- 현재 작업 트리의 변경 파일 요약
- 상위 변경 영역 요약

`## 직접 정리` 아래 내용은 스크립트를 다시 실행해도 유지됩니다.

## 자동 푸시 범위
기본 자동화는 아래 범위만 커밋하고 푸시합니다.
- `worklog/`
- worklog 자동화에 쓰이는 전용 스크립트 파일

진행 중인 소스 전체를 자동 푸시하도록 기본 설정하지 않은 이유는 다음과 같습니다.
- 미완성 코드가 의도치 않게 올라갈 수 있음
- `.env`, 로컬 산출물, 임시 파일 같은 민감한 변경이 섞일 수 있음
- 사용자가 직접 검토하려던 스테이징 상태를 깨뜨릴 수 있음

코드 변경까지 포함하는 자동 푸시가 필요하면 별도 정책으로 추가하는 편이 안전합니다.
