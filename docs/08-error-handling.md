# 다시서기 정신건강 평가관리 시스템 에러 처리 기준

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `03-api-spec.md`, `05-backend-architecture.md`, `06-frontend-architecture.md`, `07-validation-rules.md`를 기준으로,  
다시서기 정신건강 평가관리 시스템에서 사용하는 **예외 분류, HTTP 상태 코드 매핑, 공통 에러 응답 구조, 사용자 메시지 정책, 로그 정책, 프론트엔드 에러 노출 방식**을 실제 구현 가능한 수준으로 정의한 문서이다.

본 문서의 목적은 다음과 같다.

- 백엔드와 프론트엔드가 동일한 에러 처리 기준을 사용하도록 한다.
- 검증 실패, 권한 실패, 상태 충돌, 시스템 오류를 서로 다른 유형으로 구분한다.
- 사용자에게 보여줄 메시지와 서버 로그에 남길 메시지를 분리한다.
- API 명세와 검증 규칙 문서에 흩어져 있는 에러 코드를 하나의 운영 기준으로 정리한다.
- 바이브 코딩 과정에서 예외 처리 방식이 엔드포인트마다 제각각이 되지 않도록 통일한다.

---

## 2. 에러 처리 설계 원칙

### 2.1 사용자 보호 원칙
- 사용자는 **무엇이 잘못되었는지**, **무엇을 다시 하면 되는지**를 이해할 수 있어야 한다.
- 내부 예외 클래스명, SQL 오류, 스택트레이스, 파일 경로는 사용자에게 노출하지 않는다.
- 가능한 경우 사용자가 바로 수정 가능한 메시지를 우선 제공한다.

### 2.2 서버 중심 원칙
- 프론트엔드는 에러를 해석하고 표시할 수 있지만, 에러의 최종 의미는 서버 응답의 `errorCode` 와 HTTP 상태 코드를 기준으로 판단한다.
- 프론트는 문구를 임의로 추측하지 않고, 공통 에러 정책에 맞는 화면 표현만 담당한다.

### 2.3 일관성 원칙
- 같은 유형의 실패는 항상 같은 HTTP 상태 코드와 `errorCode` 를 사용한다.
- 예:
  - 권한 부족이면 항상 `403`
  - 리소스 없음이면 항상 `404`
  - 상태 충돌이면 항상 `409`

### 2.4 구조화 원칙
에러는 아래 5단계로 처리한다.

1. 예외 발생
2. 예외 분류
3. HTTP 상태 코드 결정
4. 공통 에러 응답 생성
5. 프론트 화면 정책에 맞게 표시

### 2.5 상세도 분리 원칙
- 사용자 메시지: 간결하고 행동 지향적
- 로그 메시지: 원인 추적 가능해야 함
- 개발/운영 로그: stack trace 포함 가능
- API 응답: 표준화된 최소 정보만 포함

### 2.6 복구 가능성 우선 원칙
에러는 아래처럼 분류해 표현한다.

- 즉시 수정 가능
  - 필수값 누락
  - 형식 오류
  - 중복 선택
- 다시 시도 가능
  - 일시적 처리 실패
  - 세션 만료
- 권한/상태 문제
  - 승인 대기
  - 작성자 아님
  - 이미 오입력 처리됨
- 운영자 확인 필요
  - 백업 경로 쓰기 실패
  - 척도 JSON 로딩 실패
  - 예상하지 못한 내부 오류

---

## 3. 에러 분류 체계

## 3.1 대분류

### 1) Authentication Error
로그인이 안 되어 있거나 세션이 만료된 경우

예:
- `UNAUTHORIZED`
- `SESSION_EXPIRED`

### 2) Authorization Error
로그인은 되어 있으나 해당 작업 권한이 없는 경우

예:
- `FORBIDDEN`
- `CLIENT_UPDATE_FORBIDDEN`
- `SESSION_MARK_MISENTERED_FORBIDDEN`

### 3) Validation Error
입력 형식 또는 구조가 잘못된 경우

예:
- `VALIDATION_ERROR`
- `ANSWER_INCOMPLETE`
- `INVALID_DATE_RANGE`

### 4) Business Rule Error
형식은 맞지만 현재 업무 정책상 허용되지 않는 경우

예:
- `USER_PENDING_APPROVAL`
- `CLIENT_NOT_ACTIVE`
- `LAST_ACTIVE_ADMIN_REQUIRED`

### 5) Not Found Error
대상이 존재하지 않는 경우

예:
- `CLIENT_NOT_FOUND`
- `SESSION_NOT_FOUND`
- `SIGNUP_REQUEST_NOT_FOUND`

### 6) Conflict Error
현재 상태와 요청이 충돌하는 경우

예:
- `SESSION_ALREADY_MISENTERED`
- `CLIENT_ALREADY_MISREGISTERED`
- `LOGIN_ID_DUPLICATED`

### 7) Infrastructure / System Error
예상하지 못한 내부 오류 또는 파일/DB/설정 문제

예:
- `INTERNAL_SERVER_ERROR`
- `BACKUP_PATH_NOT_WRITABLE`
- `SCALE_DEFINITION_LOAD_FAILED`

---

## 4. HTTP 상태 코드 매핑 원칙

## 4.1 기본 매핑
- `200 OK`
  - 조회/처리 성공
- `201 Created`
  - 생성 성공
- `400 Bad Request`
  - 형식 오류, 구조 오류, 잘못된 파라미터
- `401 Unauthorized`
  - 로그인 필요, 세션 만료
- `403 Forbidden`
  - 권한 없음
- `404 Not Found`
  - 대상 없음
- `409 Conflict`
  - 상태 충돌, 중복, 이미 처리된 상태
- `422 Unprocessable Entity`
  - 선택사항
  - 초기 버전은 사용하지 않고 `400` 으로 통일 권장
- `500 Internal Server Error`
  - 예상하지 못한 내부 오류
- `503 Service Unavailable`
  - 선택사항
  - 유지보수/일시적 외부 자원 문제 시 확장 가능

## 4.2 상태 코드 사용 기준 상세

### 400
- 잘못된 필드 값
- 날짜 범위 오류
- 허용되지 않은 scaleCode
- 문항 응답 구조 오류

### 401
- 비로그인 상태
- 세션 만료
- 세션 사용자 정보 없음

### 403
- 관리자 전용 기능 접근
- 작성자/관리자만 가능한 작업에 일반 사용자가 접근
- 오등록/오입력 포함 조회 권한 없음

### 404
- 존재하지 않는 대상자, 세션, 신청서, 사용자

### 409
- 이미 오입력 처리된 세션
- 이미 오등록 처리된 대상자
- 중복 loginId
- 마지막 활성 관리자 강등/비활성화 시도

### 500
- NullPointerException 등 예상치 못한 서버 오류
- DB 연결 이상
- 템플릿/직렬화 오류
- 공통 예외 처리기 밖으로 새어 나온 오류

---

## 5. 공통 에러 응답 스키마

## 5.1 표준 구조

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
  ],
  "timestamp": "2026-03-29T06:00:00",
  "path": "/api/v1/clients"
}
```

## 5.2 필드 설명
- `success`
  - 항상 `false`
- `message`
  - 사용자 표시용 대표 메시지
- `errorCode`
  - 프론트가 분기 처리할 수 있는 안정적인 코드
- `fieldErrors`
  - 필드 단위 오류 목록
- `timestamp`
  - 서버 생성 시각
- `path`
  - 요청 API 경로

## 5.3 fieldErrors 사용 기준
`fieldErrors` 는 아래 경우에 사용한다.

- 폼 필드와 직접 연결되는 오류
- 한 번에 여러 개 반환 가능한 오류
- 프론트에서 입력란 하단 메시지에 연결할 수 있는 오류

예:
- 이름 누락
- 생년월일 형식 오류
- 메모 길이 초과

## 5.4 fieldErrors 를 비우는 경우
아래는 대표 `errorCode` 만으로 충분하다.

- `FORBIDDEN`
- `SESSION_NOT_FOUND`
- `CLIENT_NOT_ACTIVE`
- `SESSION_ALREADY_MISENTERED`

---

## 6. 사용자 메시지 정책

## 6.1 작성 원칙
- 기술 용어보다 행동 중심 문장을 사용한다.
- “왜 안 되는지”와 “어떻게 해야 하는지”를 짧게 전달한다.
- 내부 구현 세부사항은 숨긴다.

## 6.2 좋은 메시지 예시
- `생년월일 형식을 다시 확인해주세요.`
- `이 세션은 이미 오입력 처리되었습니다.`
- `권한이 없어 해당 작업을 수행할 수 없습니다.`
- `로그인 세션이 만료되었습니다. 다시 로그인해주세요.`

## 6.3 피해야 할 메시지 예시
- `ConstraintViolationException 발생`
- `users_login_id_key 위반`
- `ScaleDefinitionLoader null`
- `403 forbidden`

## 6.4 화면별 메시지 톤
- 로그인/폼 화면: 수정 유도형
- 권한 오류: 명확하고 짧게
- 위험 작업 오류: 현재 상태 설명 중심
- 내부 오류: 사과 + 재시도/관리자 문의 유도

---

## 7. 로그 메시지 정책

## 7.1 로그는 더 자세해야 한다
운영 로그에는 아래 정보를 포함할 수 있다.

- 예외 클래스
- 내부 원인 메시지
- 요청 사용자 ID
- 대상 리소스 ID
- API path
- 파라미터 일부
- stack trace

## 7.2 민감정보 로그 금지
아래는 로그에 남기지 않는다.

- 비밀번호 원문
- 세션 쿠키 값
- 전체 개인정보 덤프
- 전체 응답 본문
- 전체 문항 응답 원문 전체를 무분별하게 로그로 남기는 행위

## 7.3 권장 로그 레벨
- `INFO`
  - 정상 로그인
  - 승인/반려
  - 세션 저장
  - 오입력 처리
  - 백업 성공
- `WARN`
  - 권한 오류
  - 검증 실패
  - 상태 충돌
  - 세션 만료
- `ERROR`
  - 예기치 못한 내부 오류
  - DB/파일 시스템 실패
  - 척도 정의 로딩 실패
  - 백업 실행 실패

---

## 8. 백엔드 예외 클래스 구조 권장안

## 8.1 기본 구조
초기 버전은 아래 계층을 권장한다.

```text
BaseApiException
├── ValidationException
├── AuthenticationException
├── AuthorizationException
├── ResourceNotFoundException
├── ConflictException
├── BusinessException
└── InfrastructureException
```

## 8.2 공통 필드 권장안
각 예외는 아래를 포함할 수 있다.

- `errorCode`
- `message`
- `httpStatus`
- `fieldErrors` (선택)
- `logMessage` (선택)

## 8.3 ValidationException
사용 예:
- 필수값 누락
- 잘못된 enum
- answerValue 허용값 오류
- page/size 오류

## 8.4 BusinessException
사용 예:
- `CLIENT_NOT_ACTIVE`
- `USER_PENDING_APPROVAL`
- `LAST_ACTIVE_ADMIN_REQUIRED`

## 8.5 ConflictException
사용 예:
- `SESSION_ALREADY_MISENTERED`
- `CLIENT_ALREADY_MISREGISTERED`
- `LOGIN_ID_DUPLICATED`

## 8.6 InfrastructureException
사용 예:
- 백업 파일 생성 실패
- 척도 JSON 읽기 실패
- 외부 자원 접근 실패

---

## 9. Global Exception Handler 기준

## 9.1 역할
- 예외를 공통 응답 형식으로 변환
- HTTP 상태 코드 일관성 보장
- 로그 레벨 분기
- 필드 오류 정규화

## 9.2 처리 순서 권장
1. 도메인/비즈니스 커스텀 예외
2. Validation 관련 프레임워크 예외
3. 인증/권한 예외
4. 예상 못한 Exception fallback

## 9.3 프레임워크 예외 매핑 예시
- `MethodArgumentNotValidException` → `400`, `VALIDATION_ERROR`
- `BindException` → `400`, `VALIDATION_ERROR`
- `HttpMessageNotReadableException` → `400`, `REQUEST_BODY_INVALID`
- `MethodArgumentTypeMismatchException` → `400`, `REQUEST_PARAM_INVALID`
- 그 외 `Exception` → `500`, `INTERNAL_SERVER_ERROR`

## 9.4 fallback 메시지 원칙
예상 못한 오류의 사용자 메시지는 아래처럼 통일한다.

- `처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`

운영 로그에는 내부 예외 상세를 남긴다.

---

## 10. 필드 오류 처리 기준

## 10.1 필드명 규칙
프론트 폼에 바로 연결할 수 있게 요청 DTO 필드명과 가능하면 동일하게 맞춘다.

예:
- `loginId`
- `birthDate`
- `selectedScales[0].answers`
- `memo`

## 10.2 배열/중첩 필드 표현
복잡한 세션 저장 요청은 아래 형태를 권장한다.

- `selectedScales[0].scaleCode`
- `selectedScales[0].answers`
- `selectedScales[0].answers[2].answerValue`

## 10.3 대표 메시지와 fieldErrors 동시 사용
예:
- `message`: `입력한 검사 응답을 다시 확인해주세요.`
- `fieldErrors`: 개별 문항 누락 목록

---

## 11. 인증/세션 관련 에러 처리

## 11.1 401 처리 원칙
- 세션 없음
- 세션 만료
- 인증 필요 API 접근

### 권장 errorCode
- `UNAUTHORIZED`
- `SESSION_EXPIRED`

### 프론트 처리
- 현재 페이지 유지 가능한 경우 토스트 후 로그인 이동
- 저장 중이었다면 “세션이 만료되어 저장되지 않았습니다” 같은 문구 제공 가능

## 11.2 승인 대기/비활성/반려 로그인 처리
이 경우는 인증 실패가 아니라 **업무 상태 기반 로그인 차단**이다.

### 권장 상태 코드
- `403` 또는 `409`
- 초기 버전은 `403` 권장

### 권장 errorCode
- `USER_PENDING_APPROVAL`
- `USER_INACTIVE`
- `USER_REJECTED`

### 이유
- 아이디/비밀번호는 맞지만 상태상 사용 불가이기 때문이다.

---

## 12. 권한 에러 처리 기준

## 12.1 권한 에러의 공통 정책
- 상태 코드: `403`
- 공통 대표 코드: `FORBIDDEN`
- 세부 코드: 기능별 세분화 가능

## 12.2 세부 권한 코드 예시
- `CLIENT_UPDATE_FORBIDDEN`
- `CLIENT_MARK_MISREGISTERED_FORBIDDEN`
- `SESSION_MARK_MISENTERED_FORBIDDEN`
- `STATISTICS_EXPORT_FORBIDDEN`
- `BACKUP_RUN_FORBIDDEN`

## 12.3 프론트 처리 원칙
- 버튼 숨김은 UX 보조일 뿐
- 실제 403 응답을 반드시 처리
- 폼 화면에서는 상단 메시지
- 일반 액션은 토스트 또는 경고 배너
- 관리자 화면 접근은 전용 안내 화면 또는 `/clients` 리다이렉트 권장

---

## 13. 상태 충돌 에러 처리 기준

## 13.1 409 Conflict 대상
- 이미 처리 완료된 상태를 다시 처리하려는 경우
- UNIQUE 충돌
- 업무적으로 동시에 성립할 수 없는 상태

## 13.2 대표 예시
- `LOGIN_ID_DUPLICATED`
- `CLIENT_ALREADY_MISREGISTERED`
- `SESSION_ALREADY_MISENTERED`
- `SIGNUP_REQUEST_ALREADY_PROCESSED`
- `USER_STATUS_ALREADY_SET`
- `LAST_ACTIVE_ADMIN_REQUIRED`

## 13.3 사용자 메시지 예시
- `이미 처리된 대상입니다. 현재 상태를 새로고침 후 확인해주세요.`
- `이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.`
- `이 세션은 이미 오입력 처리되었습니다.`

---

## 14. 리소스 없음 에러 처리 기준

## 14.1 공통 원칙
- 상태 코드: `404`
- 존재하지 않는 ID 또는 접근 가능한 범위 밖에 없는 리소스일 때 사용

## 14.2 대표 코드
- `CLIENT_NOT_FOUND`
- `SESSION_NOT_FOUND`
- `USER_NOT_FOUND`
- `SIGNUP_REQUEST_NOT_FOUND`
- `SCALE_NOT_FOUND`

## 14.3 보안 고려
민감 리소스의 경우, 존재하지만 접근 권한이 없는 상황에서 `404` 로 위장할지 `403` 으로 명확히 줄지는 정책 선택 사항이다.  
초기 버전은 **권한 부족은 403, 진짜 없음은 404** 로 분리하는 것을 권장한다.

---

## 15. 검증 실패 에러 처리 기준

## 15.1 공통 원칙
- 상태 코드: `400`
- `errorCode`: `VALIDATION_ERROR` 또는 더 구체적 코드
- `fieldErrors` 적극 활용

## 15.2 대표 코드
- `REQUEST_BODY_INVALID`
- `REQUEST_PARAM_INVALID`
- `INVALID_DATE_RANGE`
- `INVALID_SCALE_CODE`
- `ANSWER_INCOMPLETE`
- `ANSWER_VALUE_INVALID`
- `ANSWER_STRUCTURE_INVALID`
- `QUESTION_NO_INVALID`

## 15.3 세션 저장 특화 메시지
- `선택한 척도 응답이 모두 입력되지 않았습니다.`
- `허용되지 않은 응답값이 포함되어 있습니다.`
- `세션 시작/종료 시간을 다시 확인해주세요.`

---

## 16. 인프라/시스템 에러 처리 기준

## 16.1 대표 대상
- DB 연결 실패
- 백업 경로 쓰기 실패
- 척도 JSON 로딩 실패
- 파일 생성 실패
- 직렬화 실패

## 16.2 상태 코드
- 기본: `500`
- 운영 필요 시 일부를 `503` 으로 확장 가능

## 16.3 대표 코드
- `INTERNAL_SERVER_ERROR`
- `BACKUP_PATH_NOT_WRITABLE`
- `BACKUP_RUN_FAILED`
- `SCALE_DEFINITION_LOAD_FAILED`
- `DATABASE_ACCESS_ERROR`

## 16.4 화면 메시지
일반 사용자:
- `처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`

관리자 화면:
- `백업 실행 중 오류가 발생했습니다. 저장 경로와 서버 상태를 확인해주세요.`

---

## 17. API 영역별 권장 에러 코드 정리

## 17.1 auth
- `LOGIN_FAILED`
- `USER_PENDING_APPROVAL`
- `USER_INACTIVE`
- `USER_REJECTED`
- `UNAUTHORIZED`
- `SESSION_EXPIRED`

## 17.2 signup / users
- `LOGIN_ID_DUPLICATED`
- `SIGNUP_REQUEST_NOT_FOUND`
- `SIGNUP_REQUEST_ALREADY_PROCESSED`
- `INVALID_ROLE`
- `INVALID_USER_STATUS`
- `LAST_ACTIVE_ADMIN_REQUIRED`

## 17.3 clients
- `CLIENT_NOT_FOUND`
- `CLIENT_NOT_ACTIVE`
- `CLIENT_UPDATE_FORBIDDEN`
- `CLIENT_ALREADY_MISREGISTERED`
- `MISREGISTERED_REASON_REQUIRED`
- `PRIMARY_WORKER_NOT_FOUND`
- `PRIMARY_WORKER_NOT_ACTIVE`

## 17.4 scales / assessment
- `INVALID_SCALE_CODE`
- `SCALE_NOT_FOUND`
- `SCALE_NOT_ACTIVE`
- `SESSION_EMPTY`
- `ANSWER_REQUIRED`
- `ANSWER_INCOMPLETE`
- `ANSWER_DUPLICATED`
- `ANSWER_VALUE_INVALID`
- `ANSWER_STRUCTURE_INVALID`
- `QUESTION_NO_INVALID`
- `INVALID_SESSION_TIME_RANGE`
- `SESSION_NOT_FOUND`
- `SESSION_ALREADY_MISENTERED`
- `SESSION_MARK_MISENTERED_FORBIDDEN`
- `PRINT_NOT_ALLOWED`

## 17.5 statistics / admin / backup
- `INVALID_DATE_RANGE`
- `DATE_RANGE_TOO_LARGE`
- `INVALID_EXPORT_TYPE`
- `STATISTICS_EXPORT_FORBIDDEN`
- `BACKUP_RUN_FORBIDDEN`
- `BACKUP_ALREADY_RUNNING`
- `BACKUP_PATH_NOT_WRITABLE`
- `BACKUP_RUN_FAILED`

---

## 18. 프론트엔드 에러 표시 기준

## 18.1 폼 화면
대상:
- 로그인
- 회원가입 신청
- 대상자 등록/수정
- 관리자 승인/반려
- 세션 요약 저장

표시 방식:
- fieldErrors → 각 필드 하단
- 대표 메시지 → 폼 상단

## 18.2 목록 화면
대상:
- 대상자 목록
- 검사기록 목록
- 로그 목록
- 백업 이력
- 통계 목록

표시 방식:
- 필터 오류 → 필터 영역 메시지
- 조회 실패 → 테이블 위 에러 블록 + 재시도 버튼

## 18.3 상세 화면
대상:
- 대상자 상세
- 세션 상세

표시 방식:
- 404 → 빈 상태 + 목록으로 이동
- 403 → 권한 안내 메시지
- 500 → 재시도 버튼 포함 에러 블록

## 18.4 위험 작업 액션
대상:
- 오입력 처리
- 오등록 처리
- 승인/반려
- 백업 실행

표시 방식:
- 실행 전 확인 모달
- 성공/실패 토스트
- 실패 시 필요하면 상세 문구 추가

---

## 19. 프론트 Axios / Query 처리 규칙

## 19.1 Axios 인터셉터
- 401: 로그인 페이지 이동 또는 세션 만료 안내
- 403: 공통 권한 오류 메시지
- 500: 공통 서버 오류 메시지
- 응답의 `errorCode` 를 함께 전달

## 19.2 TanStack Query 처리
- 조회 실패는 `isError` 기반으로 화면 분기
- 자동 재시도는 조회 API에만 제한적으로 사용
- 승인/저장/오입력 같은 mutation 실패는 자동 재시도 금지

## 19.3 세션 저장 mutation
- `ANSWER_INCOMPLETE`, `ANSWER_VALUE_INVALID` 등은 요약 화면 상단 메시지 + 필요한 경우 해당 척도 이동 유도
- `SESSION_EXPIRED` 는 draft 유지 여부를 신중히 처리
- 저장 성공 전에는 draft reset 금지

---

## 20. 에러 코드 명명 규칙

## 20.1 기본 형식
- 모두 대문자 snake case
- 의미가 모호한 범용 코드 남용 금지

좋은 예:
- `CLIENT_NOT_FOUND`
- `SESSION_ALREADY_MISENTERED`
- `BACKUP_PATH_NOT_WRITABLE`

나쁜 예:
- `ERROR_001`
- `FAIL`
- `INVALID`

## 20.2 명명 패턴
- 리소스 없음: `*_NOT_FOUND`
- 상태 충돌: `*_ALREADY_*`
- 권한 부족: `*_FORBIDDEN`
- 필수 누락: `*_REQUIRED`
- 형식 오류: `INVALID_*`
- 처리 실패: `*_FAILED`

---

## 21. 운영 로그와 DB 활동 로그의 구분

## 21.1 운영 로그
용도:
- 장애 분석
- stack trace 확인
- 서버 상태 추적

## 21.2 DB 활동 로그
용도:
- 관리자 화면 조회
- 누가 무엇을 했는지 확인

## 21.3 구분 원칙
- 검증 실패 전체를 activity log 에 다 적재할 필요는 없다.
- 성공한 중요 행위 중심으로 적재한다.
- 필요 시 권한 위반/중요 실패만 별도 보강할 수 있다.

---

## 22. 구현 우선순위 권장

### 1단계
- 공통 `ErrorResponse`
- 공통 `ErrorCode` enum 또는 상수
- `BaseApiException`
- `GlobalExceptionHandler`

### 2단계
- 인증/권한/검증/리소스 없음/충돌 예외 분리
- 프론트 Axios 공통 에러 처리
- 폼 화면 fieldErrors 연결

### 3단계
- 관리자/백업/출력 등 세부 코드 확장
- 공통 에러 배너/토스트 정책 정리
- 로그 레벨 및 운영 로그 포맷 고정

---

## 23. 바이브 코딩 시 반드시 지켜야 할 규칙

1. `throw new RuntimeException()` 을 업무 로직 전반에 흩뿌리지 않는다.
2. 예외를 잡고 아무 메시지 없이 `false` 반환하는 구조를 만들지 않는다.
3. 같은 실패 상황에 엔드포인트마다 다른 `errorCode` 를 쓰지 않는다.
4. DB 오류 메시지를 그대로 사용자에게 노출하지 않는다.
5. 403/404/409 를 전부 400으로 뭉개지 않는다.
6. 프론트는 `message` 만 보지 말고 `errorCode` 기준 분기를 함께 둔다.
7. fieldErrors 와 상단 메시지의 역할을 구분한다.
8. 예상 못한 오류는 반드시 fallback handler 에서 잡아 500 응답으로 정규화한다.

---

## 24. 초안 기준 최종 권장 사항

- 에러는 인증, 권한, 검증, 업무 규칙, 리소스 없음, 상태 충돌, 시스템 오류로 분리한다.
- HTTP 상태 코드는 400/401/403/404/409/500 중심으로 단순하고 일관되게 운영한다.
- 공통 에러 응답에는 `message`, `errorCode`, `fieldErrors`, `timestamp`, `path` 를 포함한다.
- 사용자 메시지와 로그 메시지는 분리한다.
- 세션 저장과 같은 복합 요청은 `fieldErrors` 를 적극 활용한다.
- 권한 오류와 리소스 없음은 명확히 구분한다.
- 내부 예외 세부사항은 운영 로그에만 남기고 API 응답에는 노출하지 않는다.
- 프론트는 Axios 인터셉터 + Query 에러 분기 + 폼 필드 매핑 구조로 처리한다.

---

## 25. 다음 단계 연계

본 문서까지 작성되면, 바이브 코딩 직전의 핵심 구현 기준 문서는 아래 수준까지 갖춰진다.

1. `00-project-overview.md`
2. `01-screen-structure.md`
3. `02-db-design.md`
4. `03-api-spec.md`
5. `04-scale-json.md`
6. `05-backend-architecture.md`
7. `06-frontend-architecture.md`
8. `07-validation-rules.md`
9. `08-error-handling.md`

다음 추천 문서는 아래 중 하나다.

1. `09-test-scenarios.md`
   - 핵심 기능 테스트 케이스
   - 정상 흐름 / 예외 흐름 / 경계값 검증

2. `10-dev-setup.md`
   - 로컬 개발환경
   - DB 초기화
   - 더미 데이터
   - 척도 JSON 배치 규칙

---

## 26. 결정사항 요약

- 에러는 인증/권한/검증/업무/리소스 없음/충돌/시스템 오류로 분리한다.
- HTTP 상태 코드는 400, 401, 403, 404, 409, 500을 기본으로 사용한다.
- 공통 에러 응답에는 `message`, `errorCode`, `fieldErrors`, `timestamp`, `path`를 포함한다.
- 사용자 메시지와 로그 메시지는 분리한다.
- 내부 예외 상세는 사용자에게 노출하지 않는다.
- fieldErrors 는 폼 입력 오류에, errorCode 는 업무/권한/상태 오류에 우선 사용한다.
- 401은 세션 없음/만료, 403은 권한 부족, 404는 대상 없음, 409는 상태 충돌에 사용한다.
- 프론트는 Axios 인터셉터와 공통 화면 정책으로 에러를 처리한다.
