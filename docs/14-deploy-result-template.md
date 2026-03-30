# Deploy Result

- 일자별 결과 문서는 `docs/deploy-results/YYYY-MM-DD.md` 형식으로 생성해 보관한다.
- 동일 문서 안에서 `검증 환경 결과` 와 `실제 운영 배포 결과` 를 반드시 분리 기록한다.
- `READY` 판정과 검증 성공은 실제 운영 배포 완료와 같은 의미로 기록하지 않는다.
- 실제 운영 배포를 수행하지 않았다면 관련 항목은 `미실행` 또는 `미기록` 으로 남긴다.

## 1. 기본 정보

- 기준 일자: `YYYY-MM-DD`
- release readiness 판정: `READY`
- 배포 버전: `미기록`
- 관련 커밋/브랜치: `미기록`
- 배포 담당자: `미기록`
- 검수 담당자: `미기록`
- 관련 readiness 문서:
  - [docs/12-release-readiness.md](/d:/dasiseogi-mental-health-intranet-template/docs/12-release-readiness.md)
  - [docs/13-pre-deploy-runbook.md](/d:/dasiseogi-mental-health-intranet-template/docs/13-pre-deploy-runbook.md)
  - [docs/15-go-live-checklist.md](/d:/dasiseogi-mental-health-intranet-template/docs/15-go-live-checklist.md)

---

## 2. 현재 판정

- 검증 환경 결과 반영 여부: `미기록`
- 실제 운영 배포 진행 여부: `미실행`
- 비고: `READY` 는 배포 가능 판정이며 실제 운영 배포 완료와 다르다.

---

## 3. 검증 환경 결과

### 3.1 검증 개요

- 검증 수행 여부: `미기록`
- 검증 환경: `미기록`
- 검증 시작 시각: `미기록`
- 검증 완료 시각: `미기록`
- 검증 요약: `미기록`

### 3.2 MariaDB/MySQL 실검증 결과

- 실행 일시: `미기록`
- 실행 환경: `미기록`
- 실행 명령:

```powershell
cd backend
.\gradlew.bat mariaDbTest --rerun-tasks
```

- 결과:
  - [ ] 성공
  - [ ] 실패
  - [ ] skip
- `MariaDbCompatibilityTest` 수행 건수: `미기록`
- `MariaDbCompatibilityTest` skip 건수: `미기록`
- 확인 파일: `미기록`
- 비고: `미기록`

### 3.3 DB_DUMP 수동 백업 결과

- 실행 일시: `미기록`
- 실행 환경: `미기록`
- 실행 계정: `미기록`
- 실행 방식:
  - [ ] 관리자 화면
  - [ ] API
- 입력 사유: `미기록`
- 응답 상태: `미기록`
- `backupMethod`: `미기록`
- `datasourceType`: `미기록`
- `preflightSummary`: `미기록`
- 생성 파일명: `미기록`
- 생성 파일경로: `미기록`
- 파일 존재 확인:
  - [ ] 예
  - [ ] 아니오
- `backup_histories` 최신 이력 확인:
  - [ ] 예
  - [ ] 아니오
- 비고: `미기록`

### 3.4 오늘 검증 체크리스트 결과

- `health` endpoint 확인
  - [ ] 성공
  - [ ] 실패
- 관리자 로그인 확인
  - [ ] 성공
  - [ ] 실패
- 대상자 등록 확인
  - [ ] 성공
  - [ ] 실패
- 최소 2종 멀티 척도 세션 저장 확인
  - [ ] 성공
  - [ ] 실패
- 세션 상세 확인
  - [ ] 성공
  - [ ] 실패
- `print view` 확인
  - [ ] 성공
  - [ ] 실패
- `statistics/summary` 확인
  - [ ] 성공
  - [ ] 실패
- `statistics/scales` 확인
  - [ ] 성공
  - [ ] 실패
- `statistics/alerts` 확인
  - [ ] 성공
  - [ ] 실패
- `CSV export` 확인
  - [ ] 성공
  - [ ] 실패
- 활동 로그 확인
  - [ ] 성공
  - [ ] 실패
- 수동 백업 이력 확인
  - [ ] 성공
  - [ ] 실패
- 메모: `미기록`

---

## 4. 실제 운영 배포 결과

- 실제 운영 배포 진행 여부: `미실행`

### 4.1 배포 수행 메타

- 배포 시작 시각: `미실행`
- 배포 완료 시각: `미실행`
- 배포 대상 환경: `미기록`

### 4.2 배포 수행 기록

- 백엔드 반영 결과: `미실행`
- 프론트 반영 결과: `미실행`
- 설정 파일 반영 결과: `미실행`
- 척도 JSON 반영 결과: `미실행`
- 배포 중 오류: `미기록`

### 4.3 배포 후 스모크 테스트 결과

- 관리자 로그인: `미실행`
- 대상자 등록: `미실행`
- 최소 2종 멀티 척도 세션 저장: `미실행`
- 세션 상세 조회: `미실행`
- `print view`: `미실행`
- `statistics/summary`: `미실행`
- `statistics/scales`: `미실행`
- `statistics/alerts`: `미실행`
- `CSV export`: `미실행`
- 활동 로그 조회: `미실행`
- 수동 백업 이력 조회: `미실행`
- `/api/v1/health` 재확인: `미실행`
- 메모: `실제 운영 배포 미실행 시 그대로 유지`

---

## 5. 롤백/중지 판단 결과

- 실제 운영 롤백 판단 대상 여부: `미대상`
- 실제 운영 배포 중지 사유: `미기록`
- readiness 최종 판단: `미기록`
- 비고: `실제 운영 배포 미실행이면 롤백 판단은 미대상으로 남긴다.`

---

## 6. 후속 조치

- 즉시 수정 필요 항목: `없음`
- 차기 배포 전 보강 항목: `없음`
- 문서 업데이트 필요 항목: `없음`
- 담당자: `미기록`
- 완료 목표일: `미기록`
