# 다시서기 정신건강 평가관리 시스템

기관 내부망에서 운영되는 **정신건강 척도 자동 채점 및 통합 기록 관리 시스템**입니다.

본 프로젝트는 다시서기종합지원센터 정신건강팀의 실무 흐름에 맞춰, 정신건강 척도 시행부터 자동 채점, 기록 저장, 조회, 출력, 통계 확인까지 전 과정을 하나의 웹 시스템에서 처리할 수 있도록 설계되었습니다.

---

## 1. 프로젝트 개요

기존 현장에서는 종이 기반 또는 수기 방식으로 정신건강 척도 검사를 시행하고, 채점 결과를 다시 별도 문서나 파일에 옮겨 적는 방식이 반복되고 있었습니다. 이 과정에서 반복적인 수기 입력, 채점 오류, 기록 누락, 데이터 분산, 통계 집계의 어려움 같은 문제가 발생했습니다.

본 프로젝트는 이러한 문제를 해결하기 위해, 기관 내부망에서 다수 사용자가 함께 사용할 수 있는 **정신건강 평가관리 시스템**을 구축하는 것을 목표로 합니다.

---

## 2. 주요 목표

- 정신건강 척도 시행 과정의 업무 단순화
- 수기 채점 오류 감소 및 기록 정확성 향상
- 대상자별 검사 이력의 통합 관리
- 팀 단위 열람 및 협업 가능 구조 확보
- 통계 및 보고 업무 지원
- 내부망 환경에 적합한 안정적 운영 체계 확보

---

## 3. 주요 사용자

- 다시서기종합지원센터 정신건강팀 사회복지사
- 관리자 권한을 가진 운영 담당자

---

## 4. 운영 환경

- 기관 내부망 기반 웹 시스템
- 데스크톱 PC 중심 사용 환경
- 다수 사용자 동시 접속 가능
- 실무자가 직접 대상자 응답을 입력하는 업무형 시스템

---

## 5. 지원 척도

본 시스템은 아래 8종 정신건강 척도를 통합 지원합니다.

- PHQ-9
- GAD-7
- mKPQ-16
- K-MDQ
- PSS-10
- ISI-K
- AUDIT-K
- IES-R

---

## 6. 핵심 기능

### 6.1 대상자 관리
- 대상자 기본정보와 검사기록 분리 관리
- 사례번호 자동 생성
- 이름 + 생년월일 기반 검색
- 대상자 등록, 상세 조회, 기본정보 수정
- 최근 검사기록 확인

### 6.2 검사 수행
- 대상자 선택 후 검사 시작
- 여러 척도 복수 선택 가능
- 선택한 척도를 순차적으로 입력
- 문항 응답 즉시 총점 자동 계산
- 척도별 판정 자동 표시
- 고위험/주의 응답 즉시 경고 표시

### 6.3 기록 관리
- 검사 결과는 세션 단위 저장
- 세션 전체 요약 제공
- 검사기록 목록 조회
- 대상자별 이력 확인
- 삭제 대신 오입력 처리 방식 적용

### 6.4 출력 및 문서화
- 공식 문서형 출력물 제공
- 대상자 기본정보, 척도별 점수/판정, 세션 요약 포함
- 참고 메모는 화면에서만 확인하고 출력물에는 제외

### 6.5 통계 및 보고
- 시스템 내 통계 화면 제공
- 이번 주 기준 기본 현황 조회
- 척도별 비교
- 경고 기록 모아보기
- 관리자 전용 엑셀 내보내기

### 6.6 운영 관리
- 회원가입 신청 후 관리자 승인
- 관리자 / 일반 사용자 권한 분리
- 주요 기능 로그 기록
- 자동 백업 및 수동 백업 지원

---

## 7. 권한 정책

### 일반 사용자
- 대상자 열람
- 대상자 등록
- 검사 수행
- 검사기록 열람
- 통계 열람

### 관리자
- 일반 사용자 기능 전체
- 회원가입 승인
- 사용자 관리
- 로그 확인
- 백업 관리

### 공통 정책
- 1인 1계정
- 팀 전체 열람 가능
- 수정 권한은 작성자와 관리자만 가능
- 오입력 기록은 기본 목록에서 숨기고, 작성자 또는 관리자만 확인 가능

---

## 8. 기본 사용자 흐름

`로그인 → 대상자 목록 → 대상자 상세 → 검사 시작 → 척도 선택 → 척도 입력 → 세션 요약 → 세션 상세`

주요 화면 설계는 [`docs/01-screen-structure.md`](docs/01-screen-structure.md)를 기준으로 합니다.

---

## 9. 문서 구조

현재 저장소는 **설계 문서 중심 구조**를 기준으로 정리합니다.

```text
mental-health-system/
├── docs/
│   ├── 00-project-overview.md
│   ├── 01-screen-structure.md
│   ├── 02-db-design.md
│   ├── 03-api-spec.md
│   ├── 04-scale-json.md
│   ├── 05-backend-architecture.md
│   ├── 06-frontend-architecture.md
│   ├── 07-validation-rules.md
│   ├── 08-error-handling.md
│   ├── 09-test-scenarios.md
│   ├── 10-dev-setup.md
│   └── 11-deployment.md
└── README.md
```

### 문서 설명
- [`docs/00-project-overview.md`](docs/00-project-overview.md)
  - 프로젝트 목적, 배경, 운영 환경, 핵심 요구사항 정리
- [`docs/01-screen-structure.md`](docs/01-screen-structure.md)
  - 화면 목록, 메뉴 구조, 사용자 흐름, 권한 노출 기준, 화면 상세 설계
- [`docs/02-db-design.md`](docs/02-db-design.md)
  - 데이터베이스 구조 설계
- [`docs/03-api-spec.md`](docs/03-api-spec.md)
  - API 명세
- [`docs/04-scale-json.md`](docs/04-scale-json.md)
  - 척도 정의, 채점 규칙, 경고 규칙, 결과 스냅샷 구조
- [`docs/05-backend-architecture.md`](docs/05-backend-architecture.md)
  - 백엔드 구조 설계
- [`docs/06-frontend-architecture.md`](docs/06-frontend-architecture.md)
  - 프론트엔드 구조 설계
- [`docs/07-validation-rules.md`](docs/07-validation-rules.md)
  - 입력/업무/권한 검증 규칙
- [`docs/08-error-handling.md`](docs/08-error-handling.md)
  - 공통 에러 처리 기준
- [`docs/09-test-scenarios.md`](docs/09-test-scenarios.md)
  - 테스트 시나리오
- [`docs/10-dev-setup.md`](docs/10-dev-setup.md)
  - 로컬 개발환경 설정 가이드
- [`docs/11-deployment.md`](docs/11-deployment.md)
  - 배포 및 운영 가이드

---

## 10. 권장 문서 읽기 순서

1. [`docs/00-project-overview.md`](docs/00-project-overview.md)
2. [`docs/01-screen-structure.md`](docs/01-screen-structure.md)
3. [`docs/02-db-design.md`](docs/02-db-design.md)
4. [`docs/03-api-spec.md`](docs/03-api-spec.md)
5. [`docs/04-scale-json.md`](docs/04-scale-json.md)
6. [`docs/05-backend-architecture.md`](docs/05-backend-architecture.md)
7. [`docs/06-frontend-architecture.md`](docs/06-frontend-architecture.md)
8. [`docs/07-validation-rules.md`](docs/07-validation-rules.md)
9. [`docs/08-error-handling.md`](docs/08-error-handling.md)
10. [`docs/09-test-scenarios.md`](docs/09-test-scenarios.md)
11. [`docs/10-dev-setup.md`](docs/10-dev-setup.md)
12. [`docs/11-deployment.md`](docs/11-deployment.md)

---

## 11. 현재 상태

- 핵심 설계 문서 작성 완료
- 시스템 구조, 데이터 모델, API, 척도 규칙, 검증/에러 처리 기준 정리 완료
- 현재 저장소는 **구현 착수 직전의 설계 기준 문서 세트**를 중심으로 구성됨

---

## 12. 다음 작업 우선순위

1. `backend/` 프로젝트 뼈대 생성
2. `frontend/` 프로젝트 뼈대 생성
3. 척도 JSON 파일 실제 리소스 형태로 정리
4. DB 초기 스키마 또는 마이그레이션 구조 준비
5. 세션 저장 기능부터 핵심 흐름 구현 시작

---

## 13. 향후 권장 디렉터리 확장 구조

구현 단계에서는 아래 구조로 확장하는 것을 권장합니다.

```text
mental-health-system/
├── backend/
├── frontend/
├── docs/
├── scripts/
├── local-backups/
└── README.md
```

---

## 14. 개발 기준 요약

이 프로젝트는 단순 소개용 시스템이 아니라, 정신건강팀 사회복지사가 실제로 사용하는 **실무형 내부 업무 시스템**을 목표로 합니다.

따라서 개발 시 아래 원칙을 유지해야 합니다.

- 빠른 대상자 검색과 검사 시작이 가능해야 한다.
- 입력 실수를 줄일 수 있도록 흐름이 단순해야 한다.
- 기록은 세션 중심으로 저장되되, 조회는 실무 친화적으로 제공해야 한다.
- 권한 정책과 개인정보 노출 범위를 명확히 구분해야 한다.
- 출력, 통계, 로그, 백업까지 운영 관점 기능을 함께 고려해야 한다.

---

## 15. 한 줄 정의

**기관 내부망에서 운영되는 정신건강 척도 자동 채점 및 통합 기록 관리 시스템**
