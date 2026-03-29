# 다시서기 정신건강 평가관리 시스템 검증 규칙 정의

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `01-screen-structure.md`, `02-db-design.md`, `03-api-spec.md`, `04-scale-json.md`, `05-backend-architecture.md`, `06-frontend-architecture.md`를 기준으로,  
다시서기 정신건강 평가관리 시스템에서 사용하는 **입력 검증 규칙, 업무 검증 규칙, 상태 검증 규칙, 권한 연계 검증 규칙**을 실제 구현 가능한 수준으로 정의한 문서이다.

본 문서의 목적은 다음과 같다.

- 프론트엔드와 백엔드가 동일한 검증 기준을 사용하도록 한다.
- 단순 필수값 검사와 업무 규칙 검사를 구분한다.
- 세션 저장, 오입력 처리, 오등록 처리, 관리자 승인 등 핵심 흐름의 실패 조건을 명확히 한다.
- API 예외 코드와 화면 메시지 설계의 기준 문서를 제공한다.
- 바이브 코딩 과정에서 검증 로직이 여기저기 흩어지지 않도록 단일 기준을 만든다.

---

## 2. 검증 설계 원칙

### 2.1 서버 최종 검증 원칙
- 프론트엔드는 사용자 편의를 위해 즉시 검증을 수행할 수 있다.
- 그러나 **최종 저장/처리 가능 여부는 서버 검증 결과를 기준으로 한다.**
- 프론트 통과 = 저장 성공을 의미하지 않는다.
- 서버는 항상 현재 DB 상태, 사용자 권한, 척도 정의 JSON, 요청 본문을 함께 보고 검증한다.

### 2.2 검증 유형 분리 원칙
검증은 아래 4가지로 나눈다.

1. **형식 검증**
   - 필수값 누락
   - 문자열 길이
   - 날짜 형식
   - enum 허용값
   - 숫자 범위

2. **구조 검증**
   - 배열 중복 여부
   - 필드 조합 일관성
   - 객체 구조 유효성
   - 척도별 문항 수 일치 여부

3. **업무 규칙 검증**
   - 승인 대기 계정 로그인 차단
   - 비활성 대상자 검사 저장 차단
   - 오입력 세션 재오입력 처리 차단
   - 마지막 활성 관리자 강등 차단

4. **권한 검증**
   - 작성자 또는 관리자만 수정 가능
   - 작성자 또는 관리자만 오등록/오입력 포함 조회 가능
   - 관리자만 승인/백업/로그 조회 가능

### 2.3 Fail Fast 원칙
- 요청 자체가 잘못된 경우는 가능한 빨리 실패시킨다.
- 저장 트랜잭션 진입 전에 검증 가능한 항목은 모두 먼저 검증한다.
- 단, 필드 오류는 한 번에 여러 개 반환해 재시도 비용을 줄이는 것을 권장한다.

### 2.4 Silent Correction 금지 원칙
- 서버가 잘못된 값을 몰래 수정해서 저장하지 않는다.
- 예:
  - 공백 자동 제거는 가능
  - 허용되지 않은 enum 값을 임의 기본값으로 바꾸는 것은 금지
  - 잘못된 날짜를 오늘 날짜로 보정하는 것은 금지

### 2.5 상태 기반 검증 원칙
- 이 시스템은 삭제 대신 상태값으로 관리하므로, 검증 시 현재 상태를 반드시 확인해야 한다.
- 예:
  - `MISREGISTERED` 대상자에 새 검사 저장 금지
  - `MISENTERED` 세션에 일반 상세 접근 제한
  - `PENDING` 사용자의 로그인 차단

### 2.6 JSON 정의 우선 원칙
- 척도 문항 수, 옵션 값, 허용 응답값, 역채점 여부는 코드 하드코딩보다 **척도 정의 JSON 기준**으로 검증한다.
- 특히 `mKPQ-16`은 이름과 실제 문항 수가 다를 수 있으므로 문항 수를 코드명으로 추정하지 않는다.

---

## 3. 검증 책임 분담

## 3.1 프론트엔드 검증 책임
프론트는 아래 항목을 우선 검증한다.

- 필수 입력 누락
- 문자열 길이
- 날짜 형식
- 기본 패턴 검증
- 저장 버튼 활성화/비활성화
- 척도 문항 전체 응답 여부
- 중복 선택 방지
- 위험 작업 전 확인 모달

### 프론트 검증의 목적
- 사용자 경험 개선
- 불필요한 API 호출 감소
- 즉시 피드백 제공

### 프론트 검증의 한계
- 작성자 권한 여부
- 대상자 현재 상태
- 승인 상태 변경 경쟁 조건
- 척도 JSON 버전 차이
- 동시 수정 충돌

위 항목은 서버가 최종 검증한다.

## 3.2 백엔드 검증 책임
백엔드는 아래 항목을 최종 검증한다.

- 요청 본문 형식
- 권한
- DB 상태값
- 참조 무결성
- 척도 정의 일치
- 저장 가능 조건
- 업무 정책 충족 여부

## 3.3 DB 제약 책임
DB는 마지막 안전장치로 아래 항목을 보장한다.

- PK/FK 무결성
- UNIQUE 제약
- NOT NULL 제약
- 기본 상태값
- 인덱스 기반 검색 효율

DB 제약은 사용자 친화적인 검증 메시지를 대신하지 않는다.

---

## 4. 공통 검증 응답 규칙

## 4.1 공통 응답 구조
검증 실패 시 아래 구조를 기본으로 사용한다.

```json
{
  "success": false,
  "message": "입력값을 다시 확인해주세요.",
  "errorCode": "VALIDATION_ERROR",
  "fieldErrors": [
    {
      "field": "birthDate",
      "reason": "유효한 날짜 형식이 아닙니다."
    }
  ]
}
```

## 4.2 필드 오류와 업무 오류 구분
- `fieldErrors`
  - 개별 입력 필드 문제
  - 프론트 폼에 매핑 가능해야 한다.

- `errorCode`
  - 업무 규칙/상태/권한 문제
  - 화면 상단 메시지 또는 공통 토스트로 처리한다.

### 예시
- `birthDate` 형식 오류 → `fieldErrors`
- `MISREGISTERED` 대상자 검사 저장 시도 → `CLIENT_NOT_ACTIVE`
- 작성자 아님 → `FORBIDDEN`

## 4.3 다중 오류 반환 원칙
- 형식 오류는 가능하면 여러 건을 함께 반환한다.
- 업무 규칙 오류는 대표 오류 1건 반환을 우선한다.
- 세션 저장처럼 구조가 큰 요청은 문항 단위 누락 오류를 집계해 반환할 수 있다.

---

## 5. 공통 필드 검증 규칙

## 5.1 문자열 공통 규칙
- 요청 입력값은 trim 후 검증한다.
- trim 후 빈 문자열이면 null/누락과 동일하게 취급한다.
- 줄바꿈이 필요 없는 단문 필드에는 개행 입력을 허용하지 않는다.

## 5.2 날짜 공통 규칙
- 날짜 형식은 `YYYY-MM-DD`
- 날짜시간 형식은 `YYYY-MM-DDTHH:mm:ss`
- 존재하지 않는 날짜는 허용하지 않는다.
- 미래 날짜 제한은 필드 의미에 따라 별도 적용한다.

## 5.3 전화번호 공통 규칙
- 저장 전 숫자/하이픈 정규화 가능
- 허용 예시:
  - `01012345678`
  - `010-1234-5678`
  - `02-123-4567`
- 권장 저장 형식은 하이픈 포함 정규화
- 국제번호 지원은 초기 버전에서 제외 가능

## 5.4 메모 공통 규칙
- XSS/HTML 태그 입력은 텍스트로 이스케이프 처리
- 서버는 HTML 렌더링을 허용하지 않는다.
- 세션 메모, 가입 신청 메모, 반려/승인 메모는 길이 제한을 둔다.

### 권장 길이 제한
- 가입 신청 메모: 0~500자
- 승인/반려 처리 메모: 0~255자
- 세션 참고 메모: 0~1000자
- 오입력/오등록 사유: 1~255자

---

## 6. 인증/로그인 검증 규칙

## 6.1 로그인 요청 검증

### 요청 필드
- `loginId`
- `password`

### 형식 검증
- `loginId`: 필수
- `password`: 필수

### 업무 검증
- 사용자 존재 여부 확인
- 비밀번호 해시 일치 여부 확인
- 사용자 상태가 `ACTIVE` 인지 확인

### 상태별 실패 규칙
- 존재하지 않음 또는 비밀번호 불일치 → `LOGIN_FAILED`
- `PENDING` → `USER_PENDING_APPROVAL`
- `INACTIVE` → `USER_INACTIVE`
- `REJECTED` → `USER_REJECTED`

### 보안 규칙
- 존재하지 않는 아이디와 비밀번호 불일치를 지나치게 구분해서 노출하지 않는 것을 권장한다.
- 단, 내부 업무 시스템 특성상 `승인 대기`, `비활성`, `반려`는 안내 메시지 분리 허용 가능

---

## 7. 회원가입 신청 검증 규칙

## 7.1 필드 규칙

### name
- 필수
- 길이: 2~50자
- 한글/영문/숫자/공백 일부 허용
- 앞뒤 공백 제거 후 검증

### loginId
- 필수
- 길이: 4~20자 권장
- 허용 문자: 영문 소문자, 숫자, `_`, `-`
- 공백 불가
- 대소문자 혼용을 막기 위해 저장 시 소문자 정규화 권장

### password
- 필수
- 길이: 8~20자 권장
- 영문 + 숫자 조합 권장
- 초기 버전에서는 특수문자 허용 가능
- 너무 단순한 값은 차단 권장
  - 예: `12345678`, `password`, `11111111`

### phone
- 필수 권장
- 형식 검증 적용

### positionName
- 필수 권장
- 길이: 1~50자

### teamName
- 필수 권장
- 길이: 1~100자

### requestMemo
- 선택
- 0~500자

## 7.2 업무 검증
- 동일 `loginId`가 `users`에 이미 존재하면 신청 불가
- 동일 `loginId`가 승인 대기 중인 신청에 이미 걸려 있어도 신청 불가
- 이미 `REJECTED` 상태인 같은 아이디 재신청을 허용할지 여부는 정책 선택 사항이지만, 초기 버전은 **같은 loginId 재사용 불가**를 권장한다.

## 7.3 권장 에러 코드
- `LOGIN_ID_REQUIRED`
- `LOGIN_ID_INVALID_FORMAT`
- `LOGIN_ID_DUPLICATED`
- `PASSWORD_WEAK`
- `PHONE_INVALID_FORMAT`
- `SIGNUP_REQUEST_INVALID`

---

## 8. 사용자 승인/반려/관리 검증 규칙

## 8.1 승인/반려 공통 검증
- 관리자만 가능
- 요청 대상 신청이 존재해야 함
- 신청 상태가 `PENDING` 이어야 함

### 실패 규칙
- 신청 없음 → `SIGNUP_REQUEST_NOT_FOUND`
- 이미 처리됨 → `SIGNUP_REQUEST_ALREADY_PROCESSED`
- 관리자 아님 → `FORBIDDEN`

## 8.2 사용자 역할 변경 검증
- 관리자만 가능
- 대상 사용자 존재 필요
- 허용 role: `ADMIN`, `USER`

### 추가 업무 검증
- 마지막 활성 관리자 1명을 `USER` 로 변경하는 동작 금지 권장
- 자기 자신의 권한을 실수로 일반 사용자로 바꾸는 경우도 확인 모달 권장

### 권장 에러 코드
- `INVALID_ROLE`
- `LAST_ACTIVE_ADMIN_REQUIRED`

## 8.3 사용자 상태 변경 검증
- 관리자만 가능
- 대상 사용자 존재 필요
- 허용 status: `ACTIVE`, `INACTIVE`

### 추가 업무 검증
- 마지막 활성 관리자 1명을 `INACTIVE` 로 전환 금지 권장
- 이미 동일 상태면 중복 변경 차단 가능

### 권장 에러 코드
- `INVALID_USER_STATUS`
- `USER_STATUS_ALREADY_SET`
- `LAST_ACTIVE_ADMIN_REQUIRED`

---

## 9. 대상자 검증 규칙

## 9.1 대상자 중복 확인 API
### 필드 검증
- `name`: 필수
- `birthDate`: 필수, 유효한 과거/현재 날짜

### 업무 규칙
- 중복 확인은 저장 차단이 아니라 경고용이다.
- 동일 이름 + 생년월일 후보를 반환하되, 신규 등록 가능 상태는 유지한다.

---

## 9.2 대상자 등록 검증

### 필수 필드
- `name`
- `gender`
- `birthDate`
- `primaryWorkerId`

### 선택 필드
- `phone`

### 필드 규칙

#### name
- 필수
- 길이: 1~50자
- trim 후 빈 문자열 금지

#### gender
- 필수
- 허용값:
  - `MALE`
  - `FEMALE`
  - `OTHER`
  - `UNKNOWN`

#### birthDate
- 필수
- 유효한 날짜여야 함
- 미래 날짜 불가
- 비정상적으로 오래된 날짜는 경고 또는 제한 가능
  - 권장 허용 범위: 현재 날짜 기준 120년 이내

#### phone
- 선택
- 입력 시 형식 검증 필수

#### primaryWorkerId
- 필수
- 존재하는 사용자여야 함
- `ACTIVE` 상태 사용자여야 함 권장

### 업무 검증
- 사례번호는 요청으로 받지 않음
- 동일 `name + birthDate` 존재 시 저장은 허용, 화면 경고만 수행
- `primaryWorkerId` 가 존재하지 않거나 비활성 사용자인 경우 저장 차단

### 권장 에러 코드
- `CLIENT_NAME_REQUIRED`
- `INVALID_GENDER`
- `INVALID_BIRTH_DATE`
- `PRIMARY_WORKER_NOT_FOUND`
- `PRIMARY_WORKER_NOT_ACTIVE`

---

## 9.3 대상자 상세 조회 검증
- 대상자 존재 필요
- 기본적으로 `ACTIVE`, `INACTIVE` 는 팀 전체 조회 가능
- `MISREGISTERED` 는 관리자 또는 작성자만 조회 가능

### 권장 에러 코드
- `CLIENT_NOT_FOUND`
- `CLIENT_VIEW_FORBIDDEN`

---

## 9.4 대상자 수정 검증
- 대상자 존재 필요
- 작성자 또는 관리자만 가능
- 수정 가능 필드만 허용
- `clientNo` 수정 금지
- 대상자 상태가 `MISREGISTERED` 인 경우에도 관리자/작성자는 수정 가능하게 둘 수 있으나, 초기 버전은 **수정 대신 상태 처리 우선**을 권장한다.

### 권장 실패 코드
- `CLIENT_NOT_FOUND`
- `CLIENT_UPDATE_FORBIDDEN`
- `CLIENT_NO_UPDATE_NOT_ALLOWED`

---

## 9.5 대상자 오등록 처리 검증
- 대상자 존재 필요
- 작성자 또는 관리자만 가능
- 현재 상태가 `MISREGISTERED` 가 아니어야 함
- `reason` 필수
- `reason`: 1~255자

### 권장 에러 코드
- `CLIENT_NOT_FOUND`
- `CLIENT_MARK_MISREGISTERED_FORBIDDEN`
- `CLIENT_ALREADY_MISREGISTERED`
- `MISREGISTERED_REASON_REQUIRED`

---

## 10. 척도 정의 조회 검증 규칙

## 10.1 척도 목록 조회
- 로그인 사용자만 접근 가능
- 서버에 로딩된 활성 척도만 반환

## 10.2 척도 상세 조회
- `scaleCode` 필수
- 레지스트리에 존재하는 활성 척도만 허용

### 권장 에러 코드
- `INVALID_SCALE_CODE`
- `SCALE_NOT_FOUND`
- `SCALE_NOT_ACTIVE`

### 서버 내부 검증
- JSON 로딩 시 아래 항목 검증 실패하면 기동 실패 권장
  - `scaleCode`
  - `scaleName`
  - `questionCount`
  - `items`
  - `optionSetRef` 또는 개별 option 정의
  - scoring 규칙
  - interpretationRules 구조

---

## 11. 검사 세션 저장 검증 규칙

## 11.1 세션 저장 요청 구조
```json
{
  "clientId": 101,
  "sessionStartedAt": "2026-03-28T13:50:00",
  "sessionCompletedAt": "2026-03-28T14:20:00",
  "memo": "상담 중 수면 문제 호소",
  "selectedScales": [
    {
      "scaleCode": "PHQ9",
      "answers": [
        { "questionNo": 1, "answerValue": "2" }
      ]
    }
  ]
}
```

## 11.2 상위 필드 검증

### clientId
- 필수
- 존재하는 대상자여야 함
- 대상자 상태가 `ACTIVE` 여야 함

### sessionStartedAt
- 필수
- 날짜시간 형식 검증

### sessionCompletedAt
- 필수
- 날짜시간 형식 검증
- `sessionCompletedAt >= sessionStartedAt`

### memo
- 선택
- 0~1000자
- HTML 렌더링 금지

### selectedScales
- 필수
- 최소 1개 이상
- 최대 8개
- 중복 `scaleCode` 금지

## 11.3 세션 단위 업무 검증
- 대상자가 `MISREGISTERED` 이면 저장 금지
- 대상자가 `INACTIVE` 이면 저장 금지 권장
- 요청 척도는 모두 활성 척도여야 함
- 프론트가 선택하지 않은 척도 데이터가 섞여 있으면 저장 금지
- 빈 세션 저장 금지

### 권장 에러 코드
- `SESSION_EMPTY`
- `CLIENT_NOT_FOUND`
- `CLIENT_NOT_ACTIVE`
- `INVALID_SESSION_TIME_RANGE`
- `SCALE_DUPLICATED`
- `INVALID_SCALE_CODE`

---

## 11.4 척도별 응답 구조 검증

### 공통 규칙
각 `selectedScales[*]` 에 대해 아래를 검증한다.

- `scaleCode` 필수
- 해당 척도 정의 존재 필요
- `answers` 필수
- 문항 응답 수가 정의와 정확히 일치해야 함
- 동일 `questionNo` 중복 금지
- 허용되지 않은 `questionNo` 금지
- 허용되지 않은 `answerValue` 금지
- 추가 필드 허용 여부는 현재 API 스키마 기준으로 제한

### 중요 구현 결정
초기 버전 API는 `session_answers.answer_value` 단일값 구조를 사용하므로,  
현재 저장 API에서는 **문항 1개당 answerValue 1개**만 허용한다.

즉, 현재 버전에서는:
- PHQ-9, GAD-7, PSS-10, ISI-K, AUDIT-K, IES-R: 단일 선택값
- K-MDQ: 각 문항 단일 선택값
- mKPQ-16: 현재 버전은 `Y/N` 단일값만 허용

### mKPQ-16 확장 제한
- distress 보조 입력은 추후 확장 가능하지만, 현재 저장 API에서는 허용하지 않는다.
- 현재 버전에서 object형 답변이 들어오면 검증 실패 처리한다.

### 권장 에러 코드
- `ANSWER_REQUIRED`
- `ANSWER_INCOMPLETE`
- `ANSWER_DUPLICATED`
- `QUESTION_NO_INVALID`
- `ANSWER_VALUE_INVALID`
- `ANSWER_STRUCTURE_INVALID`

---

## 11.5 척도별 세부 검증 규칙

### PHQ-9
- 문항 수: 9
- 각 문항 허용값: `0`, `1`, `2`, `3`

### GAD-7
- 문항 수: 7
- 각 문항 허용값: `0`, `1`, `2`, `3`

### mKPQ-16
- 현재 구현 기준 문항 수: 척도 정의 JSON 기준
- 현재 버전 허용값: `Y`, `N`
- distress 입력 금지

### K-MDQ
- 증상 문항 13개: `Y`, `N`
- 동시성 문항: `Y`, `N`
- 기능손상 문항: 허용값
  - `NONE`
  - `MINOR`
  - `MODERATE`
  - `SERIOUS`

### PSS-10
- 문항 수: 10
- 허용값: `0`, `1`, `2`, `3`, `4`

### ISI-K
- 문항 수: 7
- 허용값: 척도 정의 JSON 기준 0~4

### AUDIT-K
- q1~q8: 0~4
- q9~q10: `0`, `2`, `4`

### IES-R
- 문항 수: 22
- 허용값: `0`, `1`, `2`, `3`, `4`

---

## 11.6 서버 계산 전 검증 체크리스트
서버는 계산 전에 반드시 아래를 확인한다.

1. 대상자 존재 여부
2. 대상자 상태
3. 척도 코드 유효성
4. 척도 활성 여부
5. 문항 수 일치 여부
6. questionNo 범위/중복 여부
7. answerValue 허용값 여부
8. 선택 척도 중복 여부
9. 세션 시간 유효 여부

하나라도 실패하면 계산 엔진에 진입하지 않는다.

---

## 12. 세션 상세/목록/오입력 검증 규칙

## 12.1 세션 상세 조회
- 세션 존재 필요
- 기본적으로 `COMPLETED` 는 조회 가능
- `MISENTERED` 는 작성자 또는 관리자만 조회 가능
- `highlightScaleCode` 가 들어오면 해당 세션 내 존재 여부 검증 권장

### 권장 에러 코드
- `SESSION_NOT_FOUND`
- `SESSION_VIEW_FORBIDDEN`
- `HIGHLIGHT_SCALE_NOT_FOUND`

## 12.2 대상자별 세션 목록 조회
- 대상자 존재 필요
- `includeMisentered = false` 기본
- 일반 사용자가 `includeMisentered = true` 를 사용할 경우 본인 작성 세션만 포함
- 관리자는 전체 포함 가능

## 12.3 검사기록 목록 조회
### 필터 검증
- `dateFrom <= dateTo`
- `scaleCode` 가 있으면 유효한 코드인지 확인
- `performedById` 가 있으면 존재하는 사용자 검증 권장
- `page >= 1`
- `size` 는 허용 범위 제한
  - 권장: 1~100

### 권장 에러 코드
- `INVALID_DATE_RANGE`
- `INVALID_SCALE_CODE`
- `INVALID_PAGE_REQUEST`

## 12.4 세션 오입력 처리
- 세션 존재 필요
- 작성자 또는 관리자만 가능
- 현재 상태가 `MISENTERED` 가 아니어야 함
- `reason` 필수
- `reason`: 1~255자

### 권장 에러 코드
- `SESSION_NOT_FOUND`
- `SESSION_MARK_MISENTERED_FORBIDDEN`
- `SESSION_ALREADY_MISENTERED`
- `MISENTERED_REASON_REQUIRED`

---

## 13. 출력 검증 규칙

## 13.1 세션 출력용 데이터 조회
- 세션 존재 필요
- 기본적으로 `COMPLETED` 세션만 허용
- `MISENTERED` 는 작성자 또는 관리자만 허용 권장
- 출력 데이터에는 메모를 포함하지 않음

### 권장 에러 코드
- `SESSION_NOT_FOUND`
- `PRINT_NOT_ALLOWED`

---

## 14. 통계 검증 규칙

## 14.1 공통 검증
- 로그인 필요
- 기본적으로 오입력 세션 제외
- `dateFrom`, `dateTo` 유효성 검증
- 조회 기간 과도 제한 권장
  - 예: 한 번에 최대 1년

### 권장 에러 코드
- `INVALID_DATE_RANGE`
- `DATE_RANGE_TOO_LARGE`

## 14.2 통계 엑셀 내보내기
- 관리자만 가능
- `type` 필수
- 허용값:
  - `SUMMARY`
  - `SCALE_COMPARE`
  - `ALERT_LIST`

### 권장 에러 코드
- `STATISTICS_EXPORT_FORBIDDEN`
- `INVALID_EXPORT_TYPE`

---

## 15. 관리자 운영 검증 규칙

## 15.1 로그 조회
- 관리자만 가능
- `dateFrom <= dateTo`
- `actionType` 허용값 검증 권장

## 15.2 백업 조회
- 관리자만 가능
- `backupType`, `status` 허용값 검증 권장

## 15.3 수동 백업 실행
- 관리자만 가능
- `reason` 선택 또는 필수는 운영 정책 선택 가능
- 권장 길이: 0~255자

### 백업 실행 전 검증 권장
- 저장 경로 존재 여부
- 쓰기 권한 여부
- 동일 시각 중복 실행 제한 여부

### 권장 에러 코드
- `BACKUP_RUN_FORBIDDEN`
- `BACKUP_PATH_NOT_WRITABLE`
- `BACKUP_ALREADY_RUNNING`

---

## 16. 프론트엔드 화면별 즉시 검증 규칙

## 16.1 로그인 화면
- 아이디 빈값 차단
- 비밀번호 빈값 차단

## 16.2 회원가입 신청 화면
- 이름, 아이디, 비밀번호, 연락처, 직책, 소속팀 즉시 검증 권장
- 아이디 패턴 안내 문구 노출
- 비밀번호 규칙 문구 노출

## 16.3 대상자 등록/수정 화면
- 이름, 성별, 생년월일, 담당자 필수
- 연락처 형식 검증
- 생년월일 미래 날짜 차단
- 저장 전 중복 확인 호출 권장

## 16.4 척도 선택 화면
- 최소 1개 선택 전 시작 버튼 비활성화
- 중복 선택 불가

## 16.5 척도 입력 화면
- 각 문항 응답 전 다음/완료 제한
- 현재 척도 미완료 상태에서 요약 이동 금지
- 이탈 시 확인 모달

## 16.6 세션 요약 화면
- 저장 중 중복 클릭 방지
- 저장 전 전체 척도 응답 완료 여부 재확인
- 메모 길이 제한 즉시 표시

---

## 17. 백엔드 구현 위치 기준

## 17.1 Controller 레벨
- DTO 필수값/형식 검증
- enum/날짜 파싱 검증
- page/size 범위 검증

## 17.2 Service 레벨
- 권한 검증
- 상태 검증
- 업무 규칙 검증
- 중복/충돌 검증

## 17.3 Scale Engine 레벨
- 문항 수 일치 검증
- 허용 option 검증
- 점수 계산 가능 여부 검증

## 17.4 Repository/DB 레벨
- UNIQUE/FK/NOT NULL 보장

---

## 18. 권장 에러 코드 체계

## 18.1 공통
- `VALIDATION_ERROR`
- `RESOURCE_NOT_FOUND`
- `FORBIDDEN`
- `UNAUTHORIZED`
- `CONFLICT`

## 18.2 인증/사용자
- `LOGIN_FAILED`
- `USER_PENDING_APPROVAL`
- `USER_INACTIVE`
- `USER_REJECTED`
- `LOGIN_ID_DUPLICATED`
- `LAST_ACTIVE_ADMIN_REQUIRED`

## 18.3 대상자
- `CLIENT_NOT_FOUND`
- `CLIENT_NOT_ACTIVE`
- `CLIENT_UPDATE_FORBIDDEN`
- `CLIENT_ALREADY_MISREGISTERED`
- `MISREGISTERED_REASON_REQUIRED`

## 18.4 척도/응답
- `INVALID_SCALE_CODE`
- `SCALE_NOT_FOUND`
- `SCALE_NOT_ACTIVE`
- `ANSWER_REQUIRED`
- `ANSWER_INCOMPLETE`
- `ANSWER_DUPLICATED`
- `ANSWER_VALUE_INVALID`
- `ANSWER_STRUCTURE_INVALID`
- `QUESTION_NO_INVALID`

## 18.5 세션
- `SESSION_EMPTY`
- `INVALID_SESSION_TIME_RANGE`
- `SESSION_NOT_FOUND`
- `SESSION_ALREADY_MISENTERED`
- `SESSION_MARK_MISENTERED_FORBIDDEN`

## 18.6 통계/관리
- `INVALID_DATE_RANGE`
- `INVALID_EXPORT_TYPE`
- `STATISTICS_EXPORT_FORBIDDEN`
- `BACKUP_ALREADY_RUNNING`
- `BACKUP_PATH_NOT_WRITABLE`

---

## 19. DB 제약과 검증 규칙 매핑

## 19.1 users
- `login_id` UNIQUE
- `role`, `status` 허용값 검증
- 승인/반려 처리 상태 전이 검증

## 19.2 clients
- `client_no` UNIQUE
- `name`, `birth_date`, `primary_worker_id` 필수
- `status` 허용값 검증

## 19.3 assessment_sessions
- `client_id`, `performed_by`, `session_started_at`, `session_completed_at` 필수
- `status` 허용값 검증
- 시간 역전 금지

## 19.4 session_scales
- `(session_id, scale_code)` UNIQUE
- 동일 세션 내 동일 척도 중복 저장 금지

## 19.5 session_answers
- `(session_scale_id, question_no)` UNIQUE
- 동일 척도 결과 내 문항 중복 금지

---

## 20. 테스트 케이스 작성 시 반드시 포함할 검증 시나리오

1. 승인 대기 계정 로그인 차단
2. 중복 loginId 회원가입 차단
3. 미래 생년월일 대상자 등록 차단
4. 동일 이름+생년월일 대상자 등록은 경고만 발생
5. 비활성 담당자 지정 차단
6. 빈 세션 저장 차단
7. 중복 척도 선택 저장 차단
8. 문항 누락 저장 차단
9. 허용되지 않은 answerValue 저장 차단
10. `MISREGISTERED` 대상자 검사 저장 차단
11. 작성자 아닌 사용자의 대상자 수정 차단
12. 작성자 아닌 사용자의 세션 오입력 처리 차단
13. 이미 `MISENTERED` 인 세션 재처리 차단
14. 관리자 아닌 사용자의 통계 export 차단
15. 관리자 아닌 사용자의 백업 실행 차단

---

## 21. 바이브 코딩 시 적용할 검증 구현 규칙

1. 프론트와 백엔드에 같은 규칙이 필요한 경우, 백엔드 기준 문구를 먼저 확정한다.
2. 세션 저장 검증은 컨트롤러에서 끝내지 말고 서비스에서 한 번 더 확인한다.
3. 척도 응답 검증은 scale JSON 기준으로 구현한다.
4. `mKPQ-16` 문항 수는 코드명이 아니라 정의 파일 기준으로 동작하게 만든다.
5. 상태값 검증 없이 수정/오입력 처리 API를 구현하지 않는다.
6. 권한 체크를 버튼 숨김만으로 끝내지 않는다.
7. DB 제약 오류를 사용자 메시지로 그대로 노출하지 않는다.
8. 공통 에러 코드 문자열은 하드코딩 중복을 줄이고 enum/상수로 관리한다.

---

## 22. 초안 기준 최종 권장 사항

- 검증은 형식, 구조, 업무 규칙, 권한 검증으로 분리한다.
- 서버가 최종 검증 책임을 가진다.
- 세션 저장 검증은 가장 엄격하게 설계한다.
- 척도 응답은 JSON 정의 기준으로 검증한다.
- `MISREGISTERED`, `MISENTERED`, `PENDING`, `INACTIVE` 같은 상태값은 항상 검증 조건에 포함한다.
- 현재 API 버전에서는 문항 1개당 answerValue 1개만 허용한다.
- mKPQ-16 distress 보조 입력은 현재 저장 API에서 허용하지 않는다.
- 프론트 검증은 UX 개선용, 서버 검증은 저장 보장용으로 역할을 분리한다.

---

## 23. 다음 단계 연계

본 문서 다음 단계에서는 `08-error-handling.md` 를 작성하는 것을 권장한다.

다음 문서에는 아래 내용을 포함한다.

- 예외 클래스 구조
- HTTP 상태 코드 매핑
- 공통 에러 응답 스키마
- 사용자 메시지 정책
- 로그 메시지 정책
- 프론트 토스트/폼 에러/페이지 에러 처리 기준

---

## 24. 결정사항 요약

- 서버가 최종 검증한다.
- 검증은 형식/구조/업무/권한 검증으로 나눈다.
- 대상자 등록은 중복 경고는 하되 저장은 허용한다.
- 세션 저장은 대상자 상태, 척도 코드, 문항 수, answerValue, 시간 범위를 모두 검증한다.
- 현재 저장 API는 문항 1개당 answerValue 1개만 허용한다.
- mKPQ-16 distress 입력은 현재 버전에서 허용하지 않는다.
- 오등록/오입력 처리는 작성자 또는 관리자만 가능하다.
- MISREGISTERED 대상자에는 새 검사 저장을 허용하지 않는다.
- 통계 export, 로그 조회, 백업 실행은 관리자만 가능하다.
