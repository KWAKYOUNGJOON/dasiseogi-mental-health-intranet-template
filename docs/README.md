# 다시서기 정신건강 평가관리 시스템

기관 내부망에서 운영되는 **정신건강 척도 자동 채점 및 통합 기록 관리 시스템** 설계 문서 세트다.

현재 저장소 상태는 **설계 문서 중심**이며, 업로드된 범위에는 실제 백엔드/프론트엔드 구현 소스(Java, TypeScript 등)는 포함되어 있지 않다.  
따라서 이 README는 소개 문서이면서 동시에 **문서 진입점(index)** 역할을 한다.

---

## 1. 프로젝트 한 줄 정의

다시서기종합지원센터 정신건강팀의 정신건강 척도 시행, 자동 채점, 기록 저장, 조회, 출력, 통계, 운영 관리를 내부망에서 통합 처리하는 실무형 웹 시스템

---

## 2. 현재 문서 세트

### 핵심 설계 문서
- `00-project-overview.md`  
  프로젝트 목적, 배경, 운영 환경, 핵심 정책 요약

- `01-screen-structure.md`  
  화면 목록, 사용자 흐름, 메뉴 구조, 권한 노출 기준, 화면 상세 설계

- `02-db-design.md`  
  데이터베이스 엔터티 구조, 상태값, 인덱스, 저장 정책

- `03-api-spec.md`  
  인증, 대상자, 척도, 세션, 통계, 관리자 기능 API 명세

- `04-scale-json.md`  
  척도 정의, 응답 구조, 채점 규칙, 판정 규칙, 경고 규칙, 결과 스냅샷 구조

### 구현 기준 문서
- `05-backend-architecture.md`  
  백엔드 패키지 구조, 서비스 계층, 트랜잭션, 척도 계산 엔진, 권한 처리

- `06-frontend-architecture.md`  
  프론트엔드 라우팅, 상태관리, 기능 모듈 구조, 페이지 책임 분리

- `07-validation-rules.md`  
  입력 검증, 업무 규칙 검증, 상태/권한 검증, 에러 코드 기준

- `08-error-handling.md`  
  예외 분류, HTTP 상태 코드 매핑, 공통 에러 응답, 프론트 노출 정책

### 운영 준비 문서
- `09-test-scenarios.md`  
  P0/P1/P2 테스트 시나리오, 자동화 범위, 배포 전 최소 통과 기준

- `10-dev-setup.md`  
  로컬 개발환경, 시드 데이터, 척도 JSON 배치, 실행 절차

- `11-deployment.md`  
  내부망 운영 배포 구조, 운영 설정, 로그/백업, 롤백 및 장애 대응

- `18-docker-compose-deployment.md`
  외부 MariaDB 기준 Docker Compose 운영 반영 절차

- `19-production-bootstrap.md`
  초기 관리자 1건 준비를 위한 부트스트랩 절차

- `20-production-input-sheet.md`
  운영 입력값과 preflight 체크를 닫기 위한 입력 시트

---

## 3. 문서 읽기 권장 순서

1. `00-project-overview.md`
2. `01-screen-structure.md`
3. `02-db-design.md`
4. `03-api-spec.md`
5. `04-scale-json.md`
6. `05-backend-architecture.md`
7. `06-frontend-architecture.md`
8. `07-validation-rules.md`
9. `08-error-handling.md`
10. `09-test-scenarios.md`
11. `10-dev-setup.md`
12. `11-deployment.md`
13. `18-docker-compose-deployment.md`
14. `19-production-bootstrap.md`
15. `20-production-input-sheet.md`

---

## 4. 핵심 운영 용어

- **오등록(MISREGISTERED)**  
  잘못 등록된 대상자 상태. 대상자는 삭제하지 않고 상태값으로 숨긴다.

- **오입력(MISENTERED)**  
  잘못 저장된 검사 세션 상태. 세션/검사기록은 삭제하지 않고 상태값으로 숨긴다.

- **세션(session)**  
  한 대상자에게 한 번의 검사 흐름에서 수행한 여러 척도 결과의 상위 묶음

- **척도 결과(session scale)**  
  세션 안에 포함된 개별 척도 1건의 결과 요약

---

## 5. 현재 문서 기준 핵심 결정사항

- 로그인 후 첫 화면은 대상자 목록 화면이다.
- 대상자는 오등록 처리, 검사 세션은 오입력 처리로 관리한다.
- 검사 저장의 최상위 단위는 세션이다.
- 최종 점수/판정/경고 계산은 서버가 수행한다.
- 척도 정의 원본은 JSON 파일로 관리한다.
- 대상자 연락처는 대상자 상세 화면/API에서만 노출한다.
- 세션 참고 메모는 화면에서만 사용하고 출력물에는 포함하지 않는다.
- 통계와 목록은 기본적으로 오입력 세션을 제외한다.
- 관리자만 승인, 사용자 관리, 로그 조회, 백업, 통계 export를 수행한다.

---

## 6. 파일명 정리 기준

문서명은 아래 형식을 기준으로 통일한다.

- `00-project-overview.md`
- `01-screen-structure.md`
- `02-db-design.md`
- ...
- `11-deployment.md`

기존의 `01_screen_structure.md` 형태는 **`01-screen-structure.md`로 통일**하는 것을 권장한다.

---

## 7. 다음 작업 권장 순서

문서 검토가 끝났다면 다음 순서를 권장한다.

1. `backend/`, `frontend/` 프로젝트 뼈대 생성
2. `04-scale-json.md` 기준 JSON 파일 초안 작성
3. 인증/대상자/세션 저장 핵심 API 구현
4. P0 테스트 시나리오 자동화
5. 로컬 실행 및 배포 스모크 테스트 정리
