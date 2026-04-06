# 다시서기 정신건강 평가관리 시스템 API 명세

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `01-screen-structure.md`, `02-db-design.md`를 기준으로, 다시서기 정신건강 평가관리 시스템의 API 구조를 실제 개발 가능한 수준으로 정의한 명세서이다.

이 문서는 다음 목적을 가진다.

- 화면 구조를 기준으로 필요한 API를 화면 단위로 정리한다.
- 프론트엔드와 백엔드가 동일한 요청/응답 계약을 공유할 수 있도록 한다.
- 세션 단위 저장, 오입력 처리, 작성자/관리자 권한, 팀 전체 열람 등 핵심 운영 정책을 API 수준에서 확정한다.
- 이후 구현 단계에서 DTO, 서비스, 권한 체크, 검증 규칙의 기준 문서로 사용한다.

---

## 2. API 설계 원칙

### 2.1 기본 원칙
- API 기본 경로는 `/api/v1` 로 통일한다.
- 데이터 형식은 JSON을 기본으로 사용한다.
- 문자 인코딩은 UTF-8을 사용한다.
- 저장된 검사기록은 수정하지 않으므로, 검사 세션 관련 API는 `생성(Create)`, `조회(Read)`, `상태 변경(Status Change)` 중심으로 설계한다.
- 삭제 API는 제공하지 않는다.
- 대상자와 세션은 내부 PK(`id`)로 식별하되, 화면 표시용 번호(`clientNo`, `sessionNo`)도 함께 응답한다.

### 2.2 인증/인가 원칙
- 인증 방식은 **세션 기반 로그인**을 기본으로 한다.
- 로그인 성공 시 서버는 세션을 생성하고, 클라이언트는 세션 쿠키를 사용해 인증한다.
- 세션 유효시간은 **마지막 활동 시점 기준 2시간**으로 한다.
- 권한은 `ADMIN`, `USER` 두 가지로 구분한다.
- 데이터 열람은 팀 전체 가능하되, 수정/상태 변경은 작성자 또는 관리자만 가능하다.

### 2.3 날짜/시간 원칙
- 날짜는 `YYYY-MM-DD` 형식을 사용한다.
- 날짜시간은 `YYYY-MM-DDTHH:mm:ss` 형식을 사용한다.
- 서버와 DB 시간대는 기관 운영 환경 기준으로 일관되게 관리한다.
- 통계/목록 필터는 화면에서 입력한 날짜 범위를 서버가 그대로 해석한다.

### 2.4 응답 원칙
- 조회 성공 시 HTTP 200을 사용한다.
- 생성 성공 시 HTTP 201을 사용한다.
- 잘못된 요청은 HTTP 400을 사용한다.
- 인증 실패는 HTTP 401을 사용한다.
- 권한 부족은 HTTP 403을 사용한다.
- 리소스 없음은 HTTP 404를 사용한다.
- 중복/상태 충돌은 HTTP 409를 사용한다.
- 서버 내부 오류는 HTTP 500을 사용한다.

### 2.5 공통 응답 형식

#### 성공 응답 예시
```json
{
  "success": true,
  "data": {},
  "message": null
}
```

#### 실패 응답 예시
```json
{
  "success": false,
  "message": "세션 저장에 실패했습니다.",
  "errorCode": "SESSION_SAVE_FAILED",
  "fieldErrors": [
    {
      "field": "memo",
      "reason": "허용 길이를 초과했습니다."
    }
  ]
}
```

### 2.6 페이징 원칙
- 목록 조회 API는 기본적으로 페이지네이션을 지원한다.
- 공통 요청 파라미터는 `page`, `size`, `sort` 를 사용한다.
- 공통 응답 구조는 아래와 같이 한다.

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "size": 20,
    "totalItems": 125,
    "totalPages": 7
  }
}
```

### 2.7 필드 노출 원칙
- 대상자 연락처는 **대상자 상세 조회 API에서만 포함**한다.
- 세션 참고 메모는 **세션 상세 조회 API에서만 포함**한다.
- 출력용 API에는 참고 메모를 포함하지 않는다.
- 목록 조회 API에는 불필요한 민감정보를 포함하지 않는다.

---

## 3. 권한 정책 요약

### 3.1 일반 사용자
- 로그인/로그아웃 가능
- 본인 계정 정보 조회 가능
- 대상자 목록 조회, 상세 조회 가능
- 대상자 등록 가능
- 본인이 등록한 대상자 수정 가능
- 검사 세션 저장 가능
- 검사기록 조회 가능
- 통계 조회 가능
- 본인이 작성한 **오등록 대상자**와 **오입력 세션** 조회 가능
- 본인이 작성한 대상자만 오등록 상태 변경 가능
- 본인이 작성한 세션만 오입력 상태 변경 가능

### 3.2 관리자
- 일반 사용자 기능 전체 가능
- 회원가입 승인/반려 가능
- 사용자 목록 조회 및 권한/상태 변경 가능
- 모든 오등록 대상자와 오입력 세션 조회 가능
- 모든 대상자 수정 가능
- 모든 대상자 오등록 / 세션 오입력 상태 변경 가능
- 로그 조회 가능
- 백업 조회 및 수동 백업 가능
- 표준 전체 백업 ZIP 복원 업로드 및 서버 검증 가능
- 통계 엑셀 내보내기 가능

---

## 4. 공통 코드값 정의

### 4.1 사용자 역할
- `ADMIN`
- `USER`

### 4.2 사용자 상태
- `PENDING`
- `ACTIVE`
- `INACTIVE`
- `REJECTED`

### 4.3 대상자 상태
- `ACTIVE`
- `INACTIVE`
- `MISREGISTERED`

### 4.4 세션 상태
- `COMPLETED`
- `MISENTERED`

### 4.5 척도 코드
- `PHQ9`
- `GAD7`
- `MKPQ16`
- `KMDQ`
- `PSS10`
- `ISIK`
- `AUDITK`
- `IESR`
- `CRI`

### 4.6 경고 유형
- `HIGH_RISK`
- `CAUTION`
- `CRITICAL_ITEM`
- `COMPOSITE_RULE`

---

## 5. API 영역 구성

본 시스템의 API는 아래 영역으로 구성한다.

1. 인증/세션 API
2. 회원가입 신청 및 승인 API
3. 사용자 관리 API
4. 대상자 관리 API
5. 척도 정의 조회 API
6. 검사 세션 저장/조회 API
7. 검사기록 목록 API
8. 통계 API
9. 관리자 운영 API(로그/백업/복원 검증)

---

## 6. 인증/세션 API

## 6.1 로그인

### 목적
아이디/비밀번호를 검증하고 서버 세션을 생성한다.

### 요청
- Method: `POST`
- Path: `/api/v1/auth/login`
- Auth: 불필요

```json
{
  "loginId": "socialworker01",
  "password": "<SECRET>"
}
```

### 처리 규칙
- `ACTIVE` 상태 사용자만 로그인 가능하다.
- `PENDING` 상태이면 승인 대기 메시지를 반환한다.
- `REJECTED`, `INACTIVE` 상태이면 로그인 불가 메시지를 반환한다.
- 성공 시 세션 쿠키를 발급한다.
- 성공/실패 모두 로그를 남길 수 있다.

### 성공 응답
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "loginId": "socialworker01",
      "name": "홍길동",
      "role": "USER",
      "status": "ACTIVE"
    },
    "sessionTimeoutMinutes": 120
  }
}
```

---

## 6.2 로그아웃

### 목적
현재 로그인 세션을 만료시킨다.

### 요청
- Method: `POST`
- Path: `/api/v1/auth/logout`
- Auth: 필요

### 성공 응답
```json
{
  "success": true,
  "data": null,
  "message": "로그아웃되었습니다."
}
```

---

## 6.3 내 정보 조회

### 목적
현재 로그인한 사용자 정보를 반환한다.

### 요청
- Method: `GET`
- Path: `/api/v1/auth/me`
- Auth: 필요

### 성공 응답
```json
{
  "success": true,
  "data": {
    "id": 1,
    "loginId": "socialworker01",
    "name": "홍길동",
    "phone": "010-1234-5678",
    "positionName": "사회복지사",
    "teamName": "정신건강팀",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

---

## 6.4 헬스 체크 API

### 목적
운영자가 인증 상태와 무관하게 서버 기동 상태를 확인한다.

### 요청
- Method: `GET`
- Path: `/api/v1/health`
- Auth: 불필요

### 처리 규칙
- 앱 기동 여부를 반환한다.
- DB 연결 가능 여부를 함께 확인한다.
- scale registry 로딩 여부를 함께 확인한다.
- 현재 활성/구현 완료 척도 수를 `loadedScaleCount` 로 함께 반환한다.
- 전체 상태가 `UP` 이 아니면 HTTP `503` 으로 응답한다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "appStatus": "UP",
    "dbStatus": "UP",
    "scaleRegistryStatus": "UP",
    "loadedScaleCount": 9
  }
}
```

---

## 7. 회원가입 신청 및 승인 API

## 7.1 회원가입 신청

### 목적
신규 사용자의 가입 신청을 접수한다.

### 요청
- Method: `POST`
- Path: `/api/v1/signup-requests`
- Auth: 불필요

```json
{
  "name": "김지원",
  "loginId": "jwkim",
  "password": "<SECRET>",
  "phone": "010-2222-3333",
  "positionName": "사회복지사",
  "teamName": "정신건강팀",
  "requestMemo": "신규 입사자 계정 요청"
}
```

### 처리 규칙
- 동일 `loginId`가 이미 존재하면 신청 불가
- 신청 성공 시 `users.status = PENDING`
- 신청 원문은 `user_approval_requests`에 저장
- 응답의 `requestId` 와 `userId` 는 서로 다른 식별자다.
- 관리자 승인 전 로그인 불가
- 로그 기록 대상이다

### 성공 응답
```json
{
  "success": true,
  "data": {
    "requestId": 10,
    "userId": 25,
    "requestStatus": "PENDING"
  }
}
```

---

## 7.2 승인 대기 목록 조회

### 목적
관리자가 승인 대기 중인 가입 신청 목록을 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/admin/signup-requests`
- Auth: 필요
- Role: `ADMIN`

### 쿼리 파라미터
- `status` : 기본값 `PENDING`
- `page`, `size`

### 성공 응답 항목
- 신청 ID
- 신청일시
- 이름
- 아이디
- 연락처
- 직책
- 소속 팀
- 신청 메모
- 처리 상태

---

## 7.3 가입 신청 승인

### 목적
관리자가 가입 신청을 승인한다.

### 요청
- Method: `POST`
- Path: `/api/v1/admin/signup-requests/{requestId}/approve`
- Auth: 필요
- Role: `ADMIN`

```json
{
  "processNote": "정상 승인"
}
```

### 처리 규칙
- 경로 변수는 반드시 `requestId` 기준이다.
- `userId` 를 승인 경로에 보내면 `SIGNUP_REQUEST_ID_REQUIRED` 로 실패한다.
- 신청 상태가 `PENDING` 일 때만 승인 가능
- 승인 시 `users.status = ACTIVE`
- `approvedAt`, `approvedBy` 저장
- `user_approval_requests.request_status`, `processed_at`, `processed_by`, `process_note` 저장
- 로그 기록 대상이다

### 성공 응답
```json
{
  "success": true,
  "data": {
    "requestId": 10,
    "userId": 25,
    "requestStatus": "APPROVED",
    "userStatus": "ACTIVE"
  }
}
```

---

## 7.4 가입 신청 반려

### 목적
관리자가 가입 신청을 반려한다.

### 요청
- Method: `POST`
- Path: `/api/v1/admin/signup-requests/{requestId}/reject`
- Auth: 필요
- Role: `ADMIN`

```json
{
  "processNote": "소속 확인 필요"
}
```

### 처리 규칙
- 경로 변수는 반드시 `requestId` 기준이다.
- 신청 상태가 `PENDING` 일 때만 반려 가능
- 반려 시 `users.status = REJECTED`
- `user_approval_requests.request_status`, `processed_at`, `processed_by`, `process_note` 저장
- 로그 기록 대상이다

---

## 8. 사용자 관리 API

## 8.1 사용자 목록 조회

### 목적
관리자가 사용자 목록과 권한/상태를 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/admin/users`
- Auth: 필요
- Role: `ADMIN`

### 쿼리 파라미터
- `keyword` : 이름/아이디 검색
- `role`
- `status`
- `page`, `size`

### 응답 항목
- 사용자 ID
- 이름
- 아이디
- 연락처
- 역할
- 상태
- 승인일시
- 최근 로그인 일시

---

## 8.2 사용자 역할 변경

### 목적
관리자가 사용자 역할을 변경한다.

### 요청
- Method: `PATCH`
- Path: `/api/v1/admin/users/{userId}/role`
- Auth: 필요
- Role: `ADMIN`

```json
{
  "role": "ADMIN"
}
```

### 처리 규칙
- 허용 값은 `ADMIN`, `USER`
- 마지막 `ACTIVE` 관리자 1명을 일반 사용자로 변경하는 동작은 금지하는 것을 권장한다.
- 로그 기록 대상이다.

---

## 8.3 사용자 상태 변경

### 목적
관리자가 사용자 상태를 변경한다.

### 요청
- Method: `PATCH`
- Path: `/api/v1/admin/users/{userId}/status`
- Auth: 필요
- Role: `ADMIN`

```json
{
  "status": "INACTIVE"
}
```

### 처리 규칙
- 허용 값은 `ACTIVE`, `INACTIVE`
- `PENDING`, `REJECTED` 전환은 승인/반려 API를 통해 처리한다.
- 비활성화된 사용자의 기존 작성 데이터는 유지한다.
- 로그 기록 대상이다.

---

## 9. 대상자 관리 API

## 9.1 대상자 목록 조회

### 목적
대상자 목록 화면에 필요한 대상자 목록을 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/clients`
- Auth: 필요

### 쿼리 파라미터
- `name` : 이름 부분 검색
- `birthDate` : 생년월일 정확 검색
- `primaryWorkerId`
- `includeMisregistered` : 기본값 `false`
- `page`, `size`

### 처리 규칙
- 기본적으로 `status = ACTIVE`, `INACTIVE` 만 조회한다.
- `includeMisregistered = true` 인 경우:
  - 관리자는 모든 `MISREGISTERED` 대상자 조회 가능
  - 일반 사용자는 본인이 작성한 `MISREGISTERED` 대상자만 조회 가능
- 연락처는 목록 응답에 포함하지 않는다.
- 최근 검사일은 세션 집계값으로 반환한다.
- 목록 응답은 page wrapper(`items`, `page`, `size`, `totalItems`, `totalPages`)를 사용한다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 101,
        "clientNo": "CL-202603-0001",
        "name": "박OO",
        "birthDate": "1980-07-13",
        "gender": "MALE",
        "primaryWorker": {
          "id": 3,
          "name": "이담당"
        },
        "latestSessionDate": "2026-03-28",
        "status": "ACTIVE"
      }
    ],
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

---

## 9.2 대상자 중복 확인

### 목적
동일 이름 + 생년월일 대상자 존재 여부를 등록 전에 확인한다.

### 요청
- Method: `POST`
- Path: `/api/v1/clients/duplicate-check`
- Auth: 필요

```json
{
  "name": "박OO",
  "birthDate": "1980-07-13"
}
```

### 처리 규칙
- 중복이 있어도 등록을 막지 않는다.
- 후보 목록을 반환하여 화면에서 경고 메시지를 보여준다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "isDuplicate": true,
    "candidates": [
      {
        "id": 101,
        "clientNo": "CL-202603-0001",
        "name": "박OO",
        "birthDate": "1980-07-13",
        "gender": "MALE",
        "primaryWorkerName": "이담당",
        "status": "ACTIVE"
      }
    ]
  }
}
```

---

## 9.3 대상자 등록

### 목적
신규 대상자를 등록한다.

### 요청
- Method: `POST`
- Path: `/api/v1/clients`
- Auth: 필요

```json
{
  "name": "박OO",
  "gender": "MALE",
  "birthDate": "1980-07-13",
  "phone": "010-1234-1111",
  "primaryWorkerId": 3
}
```

### 처리 규칙
- `clientNo` 는 서버가 자동 생성한다.
- `createdBy` 는 현재 로그인 사용자로 기록한다.
- 동일 이름 + 생년월일 중복이 있어도 저장 가능하다.
- 로그 기록 대상이다.

### 성공 응답
```json
{
  "success": true,
  "data": {
    "id": 101,
    "clientNo": "CL-202603-0001"
  }
}
```

---

## 9.4 대상자 상세 조회

### 목적
대상자 상세 화면에 필요한 기본정보와 최근 세션 요약을 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/clients/{clientId}`
- Auth: 필요

### 처리 규칙
- 연락처는 이 API에서만 반환한다.
- 최근 세션은 최신순 10건을 반환한다.
- `MISREGISTERED` 대상자는 관리자 또는 작성자만 조회 가능하다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "id": 101,
    "clientNo": "CL-202603-0001",
    "name": "박OO",
    "gender": "MALE",
    "birthDate": "1980-07-13",
    "phone": "010-1234-1111",
    "registeredAt": "2026-03-20T09:10:00",
    "primaryWorker": {
      "id": 3,
      "name": "이담당"
    },
    "status": "ACTIVE",
    "recentSessions": [
      {
        "id": 501,
        "sessionNo": "AS-20260328-0001",
        "sessionCompletedAt": "2026-03-28T14:20:00",
        "performedByName": "이담당",
        "scaleCount": 3,
        "hasAlert": true,
        "status": "COMPLETED"
      }
    ]
  }
}
```

---

## 9.5 대상자 수정

### 목적
대상자 기본정보를 수정한다.

### 요청
- Method: `PATCH`
- Path: `/api/v1/clients/{clientId}`
- Auth: 필요

```json
{
  "name": "박OO",
  "gender": "MALE",
  "birthDate": "1980-07-13",
  "phone": "010-9999-8888",
  "primaryWorkerId": 4
}
```

### 처리 규칙
- 작성자 또는 관리자만 수정 가능하다.
- `clientNo` 는 수정 불가다.
- 변경 이력 상세 보관이 필요하면 추후 별도 이력 테이블을 확장할 수 있다.
- 로그 기록 대상이다.

---

## 9.6 대상자 오등록 처리

### 목적
잘못 등록된 대상자를 삭제하지 않고 `MISREGISTERED` 상태로 전환한다.

### 요청
- Method: `POST`
- Path: `/api/v1/clients/{clientId}/mark-misregistered`
- Auth: 필요

```json
{
  "reason": "중복 등록 확인"
}
```

### 처리 규칙
- 작성자 또는 관리자만 가능하다.
- 물리 삭제는 수행하지 않는다.
- 상태 변경 후 기본 목록에서 숨긴다.
- 로그 기록 대상이다.

---

## 10. 척도 정의 조회 API

## 10.1 지원 척도 목록 조회

### 목적
척도 선택 화면에서 사용할 지원 척도 목록을 반환한다.

### 요청
- Method: `GET`
- Path: `/api/v1/scales`
- Auth: 필요

### 처리 규칙
- 데이터 원본은 DB가 아니라 애플리케이션 내 척도 정의 파일이다.
- 시스템 고정 순서를 함께 반환한다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "scaleCode": "PHQ9",
        "scaleName": "PHQ-9",
        "displayOrder": 1,
        "questionCount": 9,
        "isActive": true
      },
      {
        "scaleCode": "GAD7",
        "scaleName": "GAD-7",
        "displayOrder": 2,
        "questionCount": 7,
        "isActive": true
      }
    ]
  }
}
```

---

## 10.2 척도 상세 정의 조회

### 목적
척도 입력 화면에서 사용할 문항, 응답 옵션, 표시용 안내 정보를 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/scales/{scaleCode}`
- Auth: 필요

### 처리 규칙
- 응답에는 문항 정의, 응답 옵션, 역채점 여부, 화면 표시용 메타정보를 포함할 수 있다.
- 판정 규칙 상세를 모두 노출할지 여부는 구현 선택사항이지만, 서버는 최종 저장 시 자체 계산을 다시 수행해야 한다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "scaleCode": "PHQ9",
    "scaleName": "PHQ-9",
    "displayOrder": 1,
    "questionCount": 9,
    "questions": [
      {
        "questionNo": 1,
        "questionKey": "phq9_q1",
        "questionText": "일 또는 여가 활동을 하는 데 흥미나 즐거움을 느끼지 못함",
        "options": [
          { "value": "0", "label": "전혀 아니다", "score": 0 },
          { "value": "1", "label": "여러 날 동안", "score": 1 },
          { "value": "2", "label": "7일 이상", "score": 2 },
          { "value": "3", "label": "거의 매일", "score": 3 }
        ]
      }
    ]
  }
}
```

---

## 11. 검사 세션 API

## 11.1 검사 세션 저장

### 목적
세션 전체 요약 화면에서 확정한 검사 결과를 한 번에 저장한다.

### 요청
- Method: `POST`
- Path: `/api/v1/assessment-sessions`
- Auth: 필요

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
        { "questionNo": 1, "answerValue": "2" },
        { "questionNo": 2, "answerValue": "1" }
      ]
    },
    {
      "scaleCode": "GAD7",
      "answers": [
        { "questionNo": 1, "answerValue": "3" },
        { "questionNo": 2, "answerValue": "2" }
      ]
    }
  ]
}
```

### 처리 규칙
- 저장은 반드시 **세션 단위 트랜잭션**으로 처리한다.
- 클라이언트는 답변만 전송하고, 서버가 최종 점수/판정/경고를 계산하는 것을 권장한다.
- 모든 선택 척도는 전 문항 응답 완료 상태여야 한다.
- 척도 중복 선택은 허용하지 않는다.
- 빈 세션 저장은 불가하다.
- 저장 성공 시 `assessment_sessions`, `session_scales`, `session_answers`, `session_alerts` 를 함께 생성한다.
- `performedBy`, `createdBy` 는 현재 로그인 사용자로 기록한다.
- 저장 후 세션 상세 화면 이동에 필요한 최소 식별/요약 데이터를 반환한다.
- 로그 기록 대상이다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "sessionId": 501,
    "sessionNo": "AS-20260328-0001",
    "clientId": 101,
    "status": "COMPLETED",
    "scaleCount": 2,
    "hasAlert": true
  },
  "message": "검사 세션이 저장되었습니다."
}
```

### 유효성 검증 예시
- `SESSION_EMPTY`
- `SCALE_DUPLICATED`
- `ANSWER_INCOMPLETE`
- `INVALID_SCALE_CODE`
- `CLIENT_NOT_FOUND`
- `CLIENT_NOT_ACTIVE`

---

## 11.2 세션 상세 조회

### 목적
세션 상세 화면에서 세션 전체 결과를 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/assessment-sessions/{sessionId}`
- Auth: 필요

### 쿼리 파라미터
- `highlightScaleCode` : 특정 척도를 강조 표시하기 위한 선택 파라미터

### 처리 규칙
- 기본적으로 `MISENTERED` 세션은 일반 조회에서 제외한다.
- 단, 관리자 또는 작성자는 해당 세션 상세 조회 가능하다.
- 세션 참고 메모는 이 API에서만 반환한다.

### 성공 응답 구조
- 세션 기본정보
- 대상자 요약정보
- 척도 결과 목록
- 문항 응답 목록
- 경고 목록
- 세션 메모
- 오입력 상태 정보

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "id": 501,
    "sessionNo": "AS-20260328-0001",
    "status": "COMPLETED",
    "sessionDate": "2026-03-28",
    "sessionStartedAt": "2026-03-28T13:50:00",
    "sessionCompletedAt": "2026-03-28T14:20:00",
    "performedBy": {
      "id": 3,
      "name": "이담당"
    },
    "client": {
      "id": 101,
      "clientNo": "CL-202603-0001",
      "name": "박OO",
      "birthDate": "1980-07-13",
      "gender": "MALE"
    },
    "memo": "상담 중 수면 문제 호소",
    "hasAlert": true,
    "scales": [
      {
        "sessionScaleId": 9001,
        "scaleCode": "PHQ9",
        "scaleName": "PHQ-9",
        "displayOrder": 1,
        "totalScore": 13,
        "resultLevel": "중등도",
        "hasAlert": true,
        "answers": [],
        "alerts": []
      }
    ],
    "alerts": [
      {
        "id": 301,
        "scaleCode": "PHQ9",
        "alertType": "HIGH_RISK",
        "alertCode": "PHQ9_ITEM9_RISK",
        "alertMessage": "자해 위험 문항 주의",
        "questionNo": 9
      }
    ]
  }
}
```

---

## 11.3 대상자별 세션 목록 조회

### 목적
대상자 상세 화면의 전체 기록 보기 또는 별도 이력 조회에 사용한다.

### 요청
- Method: `GET`
- Path: `/api/v1/clients/{clientId}/assessment-sessions`
- Auth: 필요

### 쿼리 파라미터
- `includeMisentered` : 기본값 `false`
- `page`, `size`

### 처리 규칙
- 기본 정렬은 `sessionCompletedAt` 내림차순
- 일반 사용자는 본인이 작성한 `MISENTERED` 세션만 포함 가능
- 관리자는 모든 `MISENTERED` 세션 포함 가능

---

## 11.4 세션 오입력 처리

### 목적
저장된 세션을 삭제하지 않고 `MISENTERED` 상태로 전환한다.

### 요청
- Method: `POST`
- Path: `/api/v1/assessment-sessions/{sessionId}/mark-misentered`
- Auth: 필요

```json
{
  "reason": "잘못된 대상자에게 입력함"
}
```

### 처리 규칙
- 작성자 또는 관리자만 가능하다.
- 세션 전체 단위로만 처리한다.
- 하위 `session_scales`, `session_answers`, `session_alerts` 는 삭제하지 않는다.
- 이후 기본 목록/통계에서 제외한다.
- 로그 기록 대상이다.

### 성공 응답
```json
{
  "success": true,
  "data": {
    "sessionId": 501,
    "status": "MISENTERED",
    "misenteredAt": "2026-03-29T09:05:00"
  }
}
```

---

## 11.5 세션 출력용 데이터 조회

### 목적
공식 문서형 출력물에 필요한 데이터를 반환한다.

### 요청
- Method: `GET`
- Path: `/api/v1/assessment-sessions/{sessionId}/print-data`
- Auth: 필요

### 처리 규칙
- 출력 기준은 항상 세션 단위다.
- 참고 메모는 응답에 포함하지 않는다.
- 오입력 세션은 관리자 또는 작성자만 출력 데이터 조회 가능하다.
- 출력 조회 시 activity log 를 남긴다.

### 응답 항목
- 기관명
- 팀명
- 담당자명
- 대상자 기본정보
- 검사일시
- 척도별 총점/판정/경고
- 세션 전체 요약

---

## 12. 검사기록 목록 API

## 12.1 검사기록 목록 조회

### 목적
검사기록 목록 화면에서 척도 결과 단위 목록을 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/assessment-records`
- Auth: 필요

### 쿼리 파라미터
- `dateFrom`
- `dateTo`
- `performedById`
- `clientName`
- `scaleCode`
- `includeMisentered` : 기본값 `false`
- `page`, `size`

### 처리 규칙
- 목록 1행은 `session_scales` 1건 기준이다.
- 응답에는 세션 이동에 필요한 `sessionId` 와 강조 표시용 `sessionScaleId` 또는 `scaleCode` 를 포함한다.
- 기본 정렬은 최신 검사일시 내림차순이다.
- 일반 사용자의 `includeMisentered = true` 는 본인 작성 세션에만 적용한다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "sessionId": 501,
        "sessionScaleId": 9001,
        "sessionNo": "AS-20260328-0001",
        "sessionCompletedAt": "2026-03-28T14:20:00",
        "clientId": 101,
        "clientName": "박OO",
        "performedByName": "이담당",
        "scaleCode": "PHQ9",
        "scaleName": "PHQ-9",
        "totalScore": 13,
        "resultLevel": "중등도",
        "hasAlert": true,
        "sessionStatus": "COMPLETED"
      }
    ],
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

---

## 13. 통계 API

## 13.1 통계 공통 원칙
- 기본 조회 기간은 이번 주다.
- 기본적으로 `MISENTERED` 세션은 제외한다.
- 일반 사용자와 관리자는 통계 조회 가능하다.
- 엑셀 내보내기는 관리자만 가능하다.

---

## 13.2 전체 현황 요약 조회

### 목적
통계 화면 첫 탭의 요약 지표를 반환한다.

### 요청
- Method: `GET`
- Path: `/api/v1/statistics/summary`
- Auth: 필요

### 쿼리 파라미터
- `dateFrom`
- `dateTo`

### 응답 항목
- 전체 검사 세션 건수
- 전체 척도 시행 건수
- 담당자별 검사 세션 건수
- 경고 발생 세션 수
- 경고 발생 척도 수

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "dateFrom": "2026-03-23",
    "dateTo": "2026-03-29",
    "totalSessionCount": 35,
    "totalScaleCount": 88,
    "alertSessionCount": 12,
    "alertScaleCount": 20,
    "performedByStats": [
      {
        "userId": 3,
        "userName": "이담당",
        "sessionCount": 14
      }
    ]
  }
}
```

---

## 13.3 척도별 비교 조회

### 목적
척도별 시행 건수 및 경고 건수를 비교한다.

### 요청
- Method: `GET`
- Path: `/api/v1/statistics/scales`
- Auth: 필요

### 쿼리 파라미터
- `dateFrom`
- `dateTo`

### 응답 항목
- 척도 코드
- 척도명
- 시행 건수
- 경고 건수
- `isActive`
- 평균 점수(선택)

### 응답 정책
- 현재 운영 중인 활성 척도는 집계 0건이어도 항상 응답에 포함한다.
- 과거 데이터가 존재하는 비활성 척도는 `isActive = false` 로 별도 노출한다.
- 과거 데이터가 없는 비활성 척도는 응답에 포함하지 않는다.

---

## 13.4 경고 기록 목록 조회

### 목적
경고 기록 모아보기 탭에서 경고 발생 기록을 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/statistics/alerts`
- Auth: 필요

### 쿼리 파라미터
- `dateFrom`
- `dateTo`
- `scaleCode`
- `alertType`
- `page`, `size`

### 응답 항목
- 경고 ID
- 대상자명
- 검사일시
- 담당자명
- 척도명
- 경고 유형
- 경고 메시지
- 세션 ID

---

## 13.5 통계 CSV 내보내기

### 목적
관리자가 통계 데이터를 CSV 파일로 다운로드한다.

### 요청
- Method: `GET`
- Path: `/api/v1/statistics/export`
- Auth: 필요
- Role: `ADMIN`

### 쿼리 파라미터
- `dateFrom`
- `dateTo`
- `type` : `SUMMARY`, `SCALE_COMPARE`, `ALERT_LIST`

### 처리 규칙
- 응답은 파일 다운로드 형식으로 처리한다.
- 기본적으로 오입력 세션은 제외한다.
- 다운로드 실행 로그를 activity log 로 남긴다.

---

## 14. 관리자 운영 API

## 14.1 활동 로그 조회

### 목적
관리자가 주요 기능 사용 이력을 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/admin/activity-logs`
- Auth: 필요
- Role: `ADMIN`

### 쿼리 파라미터
- `dateFrom`
- `dateTo`
- `userId`
- `actionType`
- `page`, `size`

### 응답 항목
- 로그 ID
- 사용자명
- 액션 유형
- 대상 유형
- 대상 ID
- 요약 설명
- IP 주소
- 생성 시각

---

## 14.2 백업 이력 조회

### 목적
관리자가 자동/수동 백업 이력을 조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/admin/backups`
- Auth: 필요
- Role: `ADMIN`

### 쿼리 파라미터
- `backupType`
- `status`
- `dateFrom`
- `dateTo`
- `page`, `size`

### 응답 항목
- 백업 ID
- 백업 유형
- 백업 방식 (`DB_DUMP` / `SNAPSHOT`)
- 상태
- 파일명
- 파일경로
- 파일크기
- 시작 시각
- 완료 시각
- 실행자
- 실패 사유

---

## 14.3 수동 백업 실행

### 목적
관리자가 수동 백업을 즉시 실행한다.

### 요청
- Method: `POST`
- Path: `/api/v1/admin/backups/run`
- Auth: 필요
- Role: `ADMIN`

```json
{
  "reason": "배포 전 수동 백업"
}
```

### 처리 규칙
- 실행 전 datasource 종류, backup 경로 writable 여부, dump command 사용 가능 여부를 preflight 로 점검한다.
- MariaDB/MySQL 은 가능한 경우 `DB_DUMP` 를 우선 사용한다.
- dump command 가 없으면 `SNAPSHOT` 으로 fallback 한다.
- 백업 실행 결과를 `backup_histories` 에 기록한다.
- 성공/실패 여부를 응답한다.
- 로그 기록 대상이다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "backupId": 41,
    "backupType": "MANUAL",
    "backupMethod": "DB_DUMP",
    "datasourceType": "MARIADB",
    "preflightSummary": "datasource=MARIADB, preferred=DB_DUMP, dumpCommand=mariadb-dump, dumpAvailable=true, fallback=-",
    "status": "SUCCESS",
    "fileName": "backup-20260329-090500-db-dump-full-v1.zip",
    "filePath": "D:/backup/backup-20260329-090500-db-dump-full-v1.zip"
  }
}
```

---

## 14.4 복원용 전체 백업 ZIP 업로드 및 검증

### 목적
관리자가 표준 전체 백업 ZIP v1 파일을 업로드하고, 서버가 ZIP/manifest/엔트리 무결성을 검증한 뒤 복원 후보 항목을 반환한다.

### 요청
- Method: `POST`
- Path: `/api/v1/admin/restores/upload`
- Auth: 필요
- Role: `ADMIN`
- Content-Type: `multipart/form-data`
- Part name: `file`

### 처리 규칙
- `.zip` 확장자와 실제 ZIP 열기 가능 여부를 함께 검증한다.
- 최대 업로드 크기는 500MB 이다.
- 암호화 ZIP 은 지원하지 않는다.
- 루트 `manifest.json` 이 반드시 있어야 한다.
- `manifest.json` 은 현재 표준 전체 백업 ZIP v1 생성 구조(`formatVersion`, `createdAt`, `datasourceType`, `appVersion`, `backupId`, `executedBy`, `profile`, `environment`, `summary`, `entries`)를 기준으로 검증한다.
- `entries[*].relativePath`, `size`, `sha256` 와 실제 ZIP 엔트리 내용을 대조한다.
- `config/application.yml`, `config/application-prod.yml`, `scales/**`, `metadata/summary.json` 이 빠지면 실패한다.
- `db/database.sql` 은 선택 항목이다.
- 검증 결과는 `restore_histories` 에 저장한다.
- 성공/실패 모두 activity log 적재 대상이다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "restoreId": 12,
    "status": "VALIDATED",
    "fileName": "backup-20260404-101500-snapshot-full-v1.zip",
    "validatedAt": "2026-04-04T10:16:02",
    "formatVersion": "FULL_BACKUP_ZIP_V1",
    "datasourceType": "H2",
    "backupId": 41,
    "detectedItems": [
      {
        "itemType": "CONFIG",
        "relativePaths": [
          "config/application-prod.yml",
          "config/application.yml"
        ]
      },
      {
        "itemType": "SCALES",
        "relativePaths": [
          "scales/common/scale-registry.json",
          "scales/phq9.json"
        ]
      },
      {
        "itemType": "METADATA",
        "relativePaths": [
          "metadata/summary.json"
        ]
      }
    ]
  }
}
```

### 실패 응답 예시
```json
{
  "success": false,
  "message": "manifest.json 파일이 없습니다.",
  "errorCode": "RESTORE_MANIFEST_INVALID"
}
```

---

## 14.5 복원 검증 이력 목록 조회

### 목적
관리자가 업로드된 복원 ZIP 검증 이력을 최신순으로 조회하고, 상세 조회 또는 다음 복원 단계로 이동할 대상을 선택한다.

### 요청
- Method: `GET`
- Path: `/api/v1/admin/restores`
- Auth: 필요
- Role: `ADMIN`

### 쿼리 파라미터
- `status` (optional, `UPLOADED` / `VALIDATED` / `PRE_BACKUP_RUNNING` / `PRE_BACKUP_FAILED` / `RESTORING` / `SUCCESS` / `FAILED`)
- `dateFrom` (optional, `uploadedAt` 기준)
- `dateTo` (optional, `uploadedAt` 기준)
- `page`, `size`

### 처리 규칙
- `restore_histories` 를 `uploadedAt DESC`, `id DESC` 로 조회한다.
- 날짜 필터는 `uploadedAt` 기준 날짜 단위 inclusive 조건으로 처리한다.
- `PageResponse` 패턴을 재사용한다.
- 목록 item 은 `restoreId`, `status`, `fileName`, `fileSizeBytes`, `uploadedAt`, `validatedAt`, `uploadedByName`, `formatVersion`, `datasourceType`, `backupId`, `failureReason` 을 포함한다.
- 목록 응답에는 `detectedItems` 를 넣지 않는다.
- 잘못된 `status`, `page`, `size`, `dateFrom > dateTo` 는 400 에러로 처리한다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "restoreId": 12,
        "status": "VALIDATED",
        "fileName": "backup-20260404-101500-snapshot-full-v1.zip",
        "fileSizeBytes": 248901,
        "uploadedAt": "2026-04-04 10:15:58",
        "validatedAt": "2026-04-04 10:16:02",
        "uploadedByName": "관리자A",
        "formatVersion": "FULL_BACKUP_ZIP_V1",
        "datasourceType": "H2",
        "backupId": 41,
        "failureReason": null
      }
    ],
    "page": 1,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

---

## 14.6 복원 검증 이력 상세 조회

### 목적
관리자가 이미 저장된 복원 검증 이력 1건을 다시 열어 메타데이터와 현재 저장 ZIP 기준 복원 가능 항목을 재조회한다.

### 요청
- Method: `GET`
- Path: `/api/v1/admin/restores/{restoreId}`
- Auth: 필요
- Role: `ADMIN`

### 처리 규칙
- `restore_histories` 기존 row 1건만 조회하며, 새 row 를 만들지 않는다.
- `formatVersion` 이 있는 이력은 서버 저장 ZIP 을 다시 읽고 기존 upload 검증과 동일한 기준으로 `detectedItems` 를 재계산한다.
- 업로드 검증 실패로 `formatVersion` 이 없는 `FAILED` 상태면 저장된 `failureReason` 을 반환하고 `detectedItems` 는 빈 배열이다.
- `UPLOADED` 상태면 아직 검증 완료 전이므로 `detectedItems` 는 빈 배열이다.
- `VALIDATED` / `PRE_BACKUP_FAILED` / `RESTORING` / `SUCCESS` / 실행 후 `FAILED` 상태인데 저장 ZIP 파일이 사라졌거나 열 수 없으면 실패한다.
- 상세 조회 때문에 상태값은 바꾸지 않는다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "restoreId": 12,
    "status": "VALIDATED",
    "fileName": "backup-20260404-101500-snapshot-full-v1.zip",
    "uploadedAt": "2026-04-04T10:15:58",
    "validatedAt": "2026-04-04T10:16:02",
    "executedAt": null,
    "uploadedByName": "관리자A",
    "formatVersion": "FULL_BACKUP_ZIP_V1",
    "datasourceType": "H2",
    "backupId": 41,
    "selectedItemTypes": [],
    "preBackupId": null,
    "preBackupFileName": null,
    "failureReason": null,
    "detectedItems": [
      {
        "itemType": "CONFIG",
        "relativePaths": [
          "config/application-prod.yml",
          "config/application.yml"
        ]
      },
      {
        "itemType": "SCALES",
        "relativePaths": [
          "scales/common/scale-registry.json",
          "scales/phq9.json"
        ]
      },
      {
        "itemType": "METADATA",
        "relativePaths": [
          "metadata/summary.json"
        ]
      }
    ]
  }
}
```

### 실패 응답 예시
```json
{
  "success": false,
  "message": "저장된 복원 ZIP 파일을 사용할 수 없습니다.",
  "errorCode": "RESTORE_ARCHIVE_UNAVAILABLE"
}
```

---

## 14.7 실제 복원 실행

### 목적
관리자가 `VALIDATED` 된 복원 검증 이력에 대해 서버 자동 백업 이후 `DATABASE` 복원을 실제 실행한다.

### 요청
- Method: `POST`
- Path: `/api/v1/admin/restores/{restoreId}/execute`
- Auth: 필요
- Role: `ADMIN`

### 요청 body 예시
```json
{
  "selectedItemTypes": ["DATABASE"],
  "confirmationText": "전체 복원을 실행합니다"
}
```

### 처리 규칙
- `VALIDATED` 상태의 이력만 실행할 수 있다.
- `selectedItemTypes` 는 비어 있으면 안 되며, v1 실제 실행 허용 범위는 `DATABASE` 만이다.
- 확인 문구는 `전체 복원을 실행합니다` 와 정확히 일치해야 한다.
- 서버는 저장 ZIP 접근 가능 여부와 manifest/detectedItems 를 다시 계산한 뒤 실행 대상 존재 여부를 확인한다.
- 실제 복원 전 서버가 기존 백업 서비스 흐름을 재사용해 pre-restore backup 을 수행한다.
- pre-backup 성공 시에만 `db/database.sql` 기반 DATABASE 복원을 실행한다.
- 현재 v1 실제 복원은 `MARIADB` / `MYSQL` datasource 에서만 지원한다.
- 실행 결과는 `restore_histories` 의 `status`, `executedAt`, `selectedItemTypes`, `preBackupId`, `preBackupFileName`, `failureReason` 에 반영한다.
- activity log 적재 대상이다.

### 성공 응답 예시
```json
{
  "success": true,
  "data": {
    "restoreId": 12,
    "status": "SUCCESS",
    "executedAt": "2026-04-04T10:21:10",
    "selectedItemTypes": ["DATABASE"],
    "preBackupId": 44,
    "preBackupFileName": "backup-20260404-102109-snapshot-full-v1.zip",
    "message": "복원 실행이 완료되었습니다.",
    "failureReason": null
  }
}
```

### 실패 응답 예시
```json
{
  "success": false,
  "message": "VALIDATED 상태의 복원 검증 이력만 실행할 수 있습니다.",
  "errorCode": "RESTORE_EXECUTE_INVALID_STATUS"
}
```

---

## 15. 화면별 API 매핑

## 15.1 로그인 화면
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## 15.2 회원가입 신청 화면
- `POST /api/v1/signup-requests`

## 15.3 대상자 목록 화면
- `GET /api/v1/clients`
- `POST /api/v1/clients/duplicate-check`
- `POST /api/v1/clients`

## 15.4 대상자 상세/수정 화면
- `GET /api/v1/clients/{clientId}`
- `PATCH /api/v1/clients/{clientId}`
- `GET /api/v1/clients/{clientId}/assessment-sessions`
- `POST /api/v1/clients/{clientId}/mark-misregistered`

## 15.5 척도 선택/입력 화면
- `GET /api/v1/scales`
- `GET /api/v1/scales/{scaleCode}`

## 15.6 세션 요약/상세 화면
- `POST /api/v1/assessment-sessions`
- `GET /api/v1/assessment-sessions/{sessionId}`
- `POST /api/v1/assessment-sessions/{sessionId}/mark-misentered`
- `GET /api/v1/assessment-sessions/{sessionId}/print-data`
- 세션 상세 화면의 print view 는 `print-data` 응답을 사용한다.

## 15.7 검사기록 목록 화면
- `GET /api/v1/assessment-records`

## 15.8 통계 화면
- `GET /api/v1/statistics/summary`
- `GET /api/v1/statistics/scales`
- `GET /api/v1/statistics/alerts`
- `GET /api/v1/statistics/export`

## 15.9 관리자 화면
- `GET /api/v1/admin/signup-requests`
- `POST /api/v1/admin/signup-requests/{requestId}/approve`
- `POST /api/v1/admin/signup-requests/{requestId}/reject`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{userId}/role`
- `PATCH /api/v1/admin/users/{userId}/status`
- `GET /api/v1/admin/activity-logs`
- `GET /api/v1/admin/backups`
- `POST /api/v1/admin/backups/run`
- `GET /api/v1/admin/restores`
- `POST /api/v1/admin/restores/upload`
- `GET /api/v1/admin/restores/{restoreId}`
- `POST /api/v1/admin/restores/{restoreId}/execute`

## 15.10 운영 점검
- `GET /api/v1/health`

---

## 16. 예외 처리 기준

## 16.1 공통 예외 코드 예시
- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `RESOURCE_NOT_FOUND`
- `CONFLICT`
- `INTERNAL_SERVER_ERROR`

## 16.2 업무 예외 코드 예시
- `LOGIN_FAILED`
- `USER_PENDING_APPROVAL`
- `USER_INACTIVE`
- `LOGIN_ID_DUPLICATED`
- `SIGNUP_REQUEST_ID_REQUIRED`
- `CLIENT_DUPLICATE_WARNING`
- `CLIENT_NOT_FOUND`
- `CLIENT_ALREADY_MISREGISTERED`
- `SESSION_NOT_FOUND`
- `SESSION_ALREADY_MISENTERED`
- `ANSWER_INCOMPLETE`
- `SCALE_DUPLICATED`
- `INVALID_SCALE_CODE`
- `PRINT_NOT_ALLOWED`
- `RESTORE_UPLOAD_FORBIDDEN`
- `RESTORE_FILE_INVALID`
- `RESTORE_MANIFEST_INVALID`
- `RESTORE_UPLOAD_FAILED`
- `RESTORE_DETAIL_FORBIDDEN`
- `RESTORE_HISTORY_NOT_FOUND`
- `RESTORE_ARCHIVE_UNAVAILABLE`
- `RESTORE_DETAIL_FAILED`
- `RESTORE_EXECUTE_FORBIDDEN`
- `RESTORE_EXECUTE_INVALID_STATUS`
- `RESTORE_CONFIRMATION_TEXT_MISMATCH`
- `RESTORE_ITEM_SELECTION_INVALID`
- `RESTORE_UNSUPPORTED_ITEM_TYPE`
- `RESTORE_UNSUPPORTED_DATASOURCE`

## 16.3 권한 예외 기준
- 대상자 수정: 작성자 또는 관리자만 가능
- 대상자 오등록 처리: 작성자 또는 관리자만 가능
- 세션 오입력 처리: 작성자 또는 관리자만 가능
- 오등록/오입력 포함 조회: 관리자 또는 작성자만 가능
- 사용자 관리/승인/로그/백업/복원 업로드 검증/복원 검증 이력 상세 조회/실제 복원 실행: 관리자만 가능
- 통계 CSV 내보내기: 관리자만 가능

---

## 17. 구현 시 주의사항

### 17.1 세션 저장 일관성
- 세션 저장은 반드시 단일 트랜잭션으로 처리해야 한다.
- 마스터 저장 후 하위 저장 중 실패하면 전체 롤백해야 한다.
- 저장 후 응답은 DB 저장값 기준으로 반환해야 한다.

### 17.2 서버 재계산 원칙
- 점수, 판정, 경고는 서버가 최종 계산해야 한다.
- 프론트엔드 실시간 계산 결과는 사용자 편의용으로만 사용한다.
- 저장 시 서버 계산 결과가 최종 진실값이 된다.

### 17.3 오입력 제외 기본값
- 목록 API, 통계 API, 출력 API는 기본적으로 오입력 세션을 제외한다.
- 대상자 목록 API는 기본적으로 오등록 대상자를 제외한다.

### 17.4 민감정보 최소 노출
- 목록 응답에는 대상자 연락처를 포함하지 않는다.
- 출력 API에는 세션 참고 메모를 포함하지 않는다.
- 필요한 화면에만 필요한 필드를 반환한다.

### 17.5 로그 기록 대상
아래 API 호출은 로그 적재를 기본 권장한다.
- 로그인
- 회원가입 신청/승인/반려
- 사용자 역할 변경 / 상태 변경
- 대상자 등록/수정/오등록 처리
- 검사 세션 저장
- 세션 오입력 처리
- 출력 데이터 조회
- 통계 엑셀 내보내기
- 수동 백업 실행
- 복원 ZIP 업로드 및 검증

---

## 18. 초안 기준 최종 권장 사항

- 인증은 세션 기반으로 설계한다.
- 검사기록은 수정 API 없이 생성/조회/오입력 처리 중심으로 설계한다.
- 세션 저장 API는 답변만 받고 서버가 최종 계산하는 구조를 권장한다.
- 목록 API와 상세 API의 필드 노출 범위를 분리한다.
- 오입력/오등록 데이터는 기본 조회에서 제외하고, 작성자/관리자만 예외 조회 가능하게 한다.
- 출력용 API는 일반 상세 API와 분리하여 메모 제외 정책을 명확히 한다.
- 통계와 검사기록 목록은 오입력 제외를 기본값으로 고정한다.

---

## 19. 연계 문서

본 문서와 직접 연결되는 구현/운영 문서는 아래와 같다.

1. `04-scale-json.md`
   - 척도 코드, 문항 정의, 응답 옵션, 점수 계산 규칙, 경고 조건, 결과 스냅샷 구조를 정의한다.
2. `07-validation-rules.md`
   - 요청값, 상태 전이, 화면 입력 검증 규칙을 정리한다.
3. `08-error-handling.md`
   - 오류 코드, 예외 응답, 화면 메시지 처리 기준을 정리한다.
4. `09-test-scenarios.md`
   - API와 주요 업무 흐름의 테스트 시나리오를 정리한다.
5. `10-dev-setup.md`
   - 로컬 개발/검증 환경과 실행 절차를 정리한다.
6. `11-deployment.md`
   - 배포 절차와 운영 반영 체크를 정리한다.
7. `12-release-readiness.md`
   - 릴리스 직전 판정 기준과 현재 검증 상태를 정리한다.
8. `13-pre-deploy-runbook.md`
   - 배포 직전 실행 순서와 확인 항목을 정리한다.
9. `14-deploy-result-template.md`
   - 배포 결과 기록 양식을 제공한다.
10. `15-go-live-checklist.md`
   - 오픈 직전 최종 점검 항목을 정리한다.

---

## 20. 결정사항 요약

- API 기본 경로는 `/api/v1` 이다.
- 인증은 세션 기반 로그인으로 설계한다.
- 저장된 검사기록은 수정하지 않는다.
- 검사 세션 저장은 세션 단위 단일 API로 처리한다.
- 세션 저장 시 서버가 점수/판정/경고를 최종 계산한다.
- 대상자 연락처는 상세 조회 API에서만 반환한다.
- 세션 참고 메모는 세션 상세 조회 API에서만 반환한다.
- 출력 API에는 참고 메모를 포함하지 않는다.
- 대상자/세션 삭제 API는 제공하지 않는다.
- 오입력/오등록은 상태 변경 API로 처리한다.
- 검사기록 목록은 척도 결과 단위로 조회한다.
- 세션 상세는 세션 전체 단위로 조회한다.
- 통계 엑셀 내보내기는 관리자 전용이다.
