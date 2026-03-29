# 다시서기 정신건강 평가관리 시스템 백엔드 구조 설계

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `01-screen-structure.md`, `02-db-design.md`, `03-api-spec.md`, `04-scale-json.md`를 기준으로,
다시서기 정신건강 평가관리 시스템의 **백엔드 구현 구조**를 실제 개발 가능한 수준으로 정의한 문서이다.

본 문서의 목적은 다음과 같다.

- API 명세를 실제 서버 코드 구조로 연결한다.
- 인증, 권한, 대상자 관리, 검사 세션 저장, 통계, 운영 기능의 구현 기준을 통일한다.
- 척도 JSON 기반 계산 구조와 세션 단위 트랜잭션 처리 기준을 확정한다.
- 바이브 코딩 과정에서 폴더 구조, 클래스 책임, 서비스 경계, 공통 처리 방식을 빠르게 고정한다.

---

## 2. 백엔드 설계 목표

### 2.1 핵심 목표
- 내부망 환경에서 안정적으로 동작하는 업무형 서버를 구축한다.
- 정신건강 척도 계산 로직을 API 계층과 분리하여 유지보수 가능하게 만든다.
- 세션 저장, 오입력 처리, 통계 집계, 로그 기록을 일관된 서비스 계층으로 관리한다.
- 화면/DB/API/척도 규칙 문서와 충돌하지 않는 구현 구조를 만든다.

### 2.2 구현 우선순위
1. 인증/권한
2. 대상자 관리
3. 척도 정의 로딩
4. 검사 세션 저장
5. 검사기록 조회
6. 통계
7. 관리자 기능
8. 운영 보조 기능(백업, 로그)

---

## 3. 기술 방향 권장안

초기 버전은 **과도한 복잡성보다 빠른 구현과 안정성**을 우선한다.

### 3.1 권장 기술 스택
- Language: Java 21
- Framework: Spring Boot
- Build: Gradle
- ORM: Spring Data JPA
- DB: MariaDB 또는 MySQL
- Validation: Jakarta Validation
- JSON 처리: Jackson
- 인증: HttpSession 기반 로그인
- 문서/환경 설정: YAML

### 3.2 선택 이유
- 세션 기반 인증과 내부망 운영에 적합하다.
- CRUD + 트랜잭션 + 권한 제어 + 통계용 쿼리 구현이 안정적이다.
- 척도 JSON 로더와 계산기를 모듈화하기 쉽다.
- 바이브 코딩 시 생성되는 코드의 구조를 표준화하기 쉽다.

---

## 4. 전체 백엔드 구조 원칙

### 4.1 레이어 구조
백엔드는 아래 6개 레이어로 분리한다.

1. **Controller**
   - HTTP 요청/응답 처리
   - 요청 파라미터 검증 진입점
   - 인증 사용자 정보 확인
   - DTO 입출력 변환

2. **Application Service**
   - 화면/API 단위 유스케이스 처리
   - 트랜잭션 경계 관리
   - 여러 도메인 서비스와 리포지토리 조합

3. **Domain Service**
   - 척도 계산, 권한 판정, 세션 저장 규칙 등 업무 규칙 처리
   - 특정 엔터티 하나에 갇히지 않는 핵심 비즈니스 로직 담당

4. **Repository**
   - DB 접근
   - 엔터티 조회/저장/검색
   - 통계 쿼리 및 목록 쿼리 담당

5. **Infrastructure**
   - 척도 JSON 로더
   - 파일 백업
   - 로그 적재 보조
   - 공통 시간/ID 생성기

6. **Common**
   - 예외
   - 응답 포맷
   - 상수
   - 보안/세션 처리
   - 공통 유틸

### 4.2 의존 방향 원칙
- Controller → Application Service → Domain Service / Repository
- Domain Service → Repository 또는 Infrastructure 사용 가능
- Repository → Entity 중심
- Infrastructure는 다른 레이어에 서비스 제공하지만, 상위 업무 흐름을 직접 알지 않는다.
- Entity는 Controller DTO를 직접 참조하지 않는다.

### 4.3 금지 원칙
- Controller에서 Repository 직접 호출 금지
- Controller에서 척도 계산 직접 수행 금지
- 프론트가 계산한 점수/판정을 그대로 신뢰하는 구조 금지
- 세션 저장 중 부분 저장 허용 금지
- 오입력 처리 시 하위 데이터 삭제 금지

---

## 5. 권장 패키지 구조

```text
src/main/java/com/dasisuhgi/mentalhealth/
├── MentalHealthApplication.java
├── common/
│   ├── api/
│   ├── config/
│   ├── error/
│   ├── response/
│   ├── security/
│   ├── session/
│   └── util/
├── auth/
│   ├── controller/
│   ├── service/
│   ├── dto/
│   └── domain/
├── user/
│   ├── controller/
│   ├── service/
│   ├── dto/
│   ├── entity/
│   ├── repository/
│   └── mapper/
├── client/
│   ├── controller/
│   ├── service/
│   ├── dto/
│   ├── entity/
│   ├── repository/
│   └── mapper/
├── assessment/
│   ├── controller/
│   ├── service/
│   ├── dto/
│   ├── entity/
│   ├── repository/
│   ├── mapper/
│   ├── domain/
│   └── query/
├── scale/
│   ├── controller/
│   ├── service/
│   ├── dto/
│   ├── domain/
│   ├── loader/
│   ├── evaluator/
│   └── registry/
├── statistics/
│   ├── controller/
│   ├── service/
│   ├── dto/
│   ├── query/
│   └── repository/
├── admin/
│   ├── controller/
│   ├── service/
│   ├── dto/
│   └── query/
├── audit/
│   ├── entity/
│   ├── repository/
│   └── service/
└── backup/
    ├── controller/
    ├── service/
    ├── entity/
    ├── repository/
    └── infra/
```

### 5.1 패키지 구조 원칙
- 기능 기준(feature-first)으로 나눈다.
- 공통 기능만 `common`으로 올린다.
- `assessment` 와 `scale` 은 분리한다.
  - `assessment`: 검사 세션 저장/조회
  - `scale`: 척도 정의와 계산 규칙
- 관리자 API라도 실제 책임이 사용자/백업/로그에 있으면 관련 모듈 서비스와 연결하되, 관리자 전용 유스케이스 조합은 `admin`에서 조정한다.

---

## 6. 모듈별 책임 정의

## 6.1 auth 모듈
### 책임
- 로그인
- 로그아웃
- 현재 사용자 조회
- 세션 생성/만료

### 주요 구성
- `AuthController`
- `AuthService`
- `SessionUser`
- `LoginRequest`, `LoginResponse`

### 주의사항
- 비밀번호는 해시 비교만 수행한다.
- `PENDING`, `INACTIVE`, `REJECTED` 상태는 로그인 차단한다.
- 로그인 성공 시 `users.last_login_at` 갱신
- 로그인/실패 로그는 별도 기록 가능

---

## 6.2 user 모듈
### 책임
- 회원가입 신청
- 승인/반려
- 사용자 목록 조회
- 역할/상태 변경

### 주요 구성
- `SignupRequestService`
- `UserAdminService`
- `UserRepository`
- `UserApprovalRequestRepository`

### 구현 포인트
- 회원가입 신청은 `users` 와 `user_approval_requests` 동시 생성
- 승인/반려는 `PENDING` 상태에서만 가능
- 마지막 활성 관리자 강등 방지 검증 포함 권장

---

## 6.3 client 모듈
### 책임
- 대상자 목록 조회
- 중복 확인
- 대상자 등록
- 대상자 상세 조회
- 대상자 수정
- 대상자 오등록 처리

### 주요 구성
- `ClientQueryService`
- `ClientCommandService`
- `ClientPermissionService`
- `ClientRepository`

### 구현 포인트
- 목록 응답에는 연락처 미포함
- 상세 응답에만 연락처 포함
- 동일 이름 + 생년월일은 경고 대상이지 저장 차단 대상이 아님
- `MISREGISTERED` 조회는 작성자/관리자만 허용

---

## 6.4 scale 모듈
### 책임
- 척도 JSON 로딩
- 척도 레지스트리 관리
- 문항 정의 조회
- 응답 옵션 해석
- 점수 계산 / 판정 / 경고 평가

### 주요 구성
- `ScaleRegistry`
- `ScaleDefinitionLoader`
- `ScaleDefinitionService`
- `ScaleScoringEngine`
- `ScaleAlertEvaluator`
- `ScaleResultBuilder`

### 구현 포인트
- 서버 시작 시 모든 척도 JSON preload 권장
- 로딩 실패 시 애플리케이션 기동 실패 처리 권장
- 화면 조회용 정의와 저장용 계산 로직이 같은 원본을 참조해야 함

---

## 6.5 assessment 모듈
### 책임
- 검사 세션 저장
- 세션 상세 조회
- 대상자별 세션 목록 조회
- 세션 오입력 처리
- 출력용 데이터 조회
- 검사기록 목록 조회

### 주요 구성
- `AssessmentSessionCommandService`
- `AssessmentSessionQueryService`
- `AssessmentRecordQueryService`
- `AssessmentPermissionService`
- `AssessmentSessionRepository`
- `SessionScaleRepository`
- `SessionAnswerRepository`
- `SessionAlertRepository`

### 구현 포인트
- 저장은 단일 트랜잭션
- 프론트는 답변만 보내고 서버가 계산
- 세션 상태가 `MISENTERED` 이면 기본 조회/통계 제외
- 출력용 조회는 일반 상세 조회와 별도 서비스 분리 권장

---

## 6.6 statistics 모듈
### 책임
- 전체 현황 요약
- 척도별 비교
- 경고 기록 목록
- 엑셀 내보내기용 조회

### 주요 구성
- `StatisticsQueryService`
- `StatisticsExportService`
- `StatisticsQueryRepository`

### 구현 포인트
- 오입력 세션 기본 제외
- 조인과 집계가 많으므로 JPA 기본 메서드보다 QueryDSL / JPQL / Native Query 혼합 허용
- 응답 DTO 전용 조회 최적화 권장

---

## 6.7 audit 모듈
### 책임
- 활동 로그 적재
- 로그 조회 지원

### 주요 구성
- `ActivityLogService`
- `ActivityLogRepository`
- `ActivityLogWriter`

### 구현 포인트
- 비즈니스 성공 후 적재 기본
- 실패 로그까지 남길지 여부는 단계적으로 확장
- 핵심 행위는 서비스 내부 명시 호출 방식으로 시작하는 것을 권장

---

## 6.8 backup 모듈
### 책임
- 수동 백업 실행
- 자동 백업 스케줄링
- 백업 이력 저장

### 주요 구성
- `BackupService`
- `BackupHistoryRepository`
- `BackupExecutor`
- `BackupScheduler`

### 구현 포인트
- 내부망 서버 경로 기반 파일 저장
- 백업 실행 자체와 이력 적재를 분리
- 실패 사유 기록 필수

---

## 7. 엔터티 구조 원칙

### 7.1 엔터티와 DTO 분리
- Entity는 DB 저장 구조 표현에 집중한다.
- Request/Response는 DTO로 분리한다.
- Entity를 그대로 응답으로 내보내지 않는다.

### 7.2 엔터티 설계 원칙
- 모든 주요 엔터티는 `createdAt`, `updatedAt` 기준 통일
- 상태값은 문자열 enum 사용
- 외부 표시용 번호는 별도 필드 사용 (`clientNo`, `sessionNo`)
- 논리 삭제 대신 상태값 사용

### 7.3 권장 공통 베이스
```text
BaseTimeEntity
- createdAt
- updatedAt

BaseAuditEntity
- createdBy
- updatedBy
- createdAt
- updatedAt
```

### 7.4 엔터티 간 참조 원칙
- 다대일 참조는 JPA 연관관계 허용
- 양방향은 꼭 필요한 경우만 사용
- 목록/통계 쿼리는 DTO projection 우선

---

## 8. DTO 구조 원칙

### 8.1 분리 기준
- Request DTO
- Response DTO
- Summary DTO
- Detail DTO
- Query Filter DTO

### 8.2 네이밍 규칙 예시
- `CreateClientRequest`
- `ClientListItemResponse`
- `ClientDetailResponse`
- `SaveAssessmentSessionRequest`
- `AssessmentSessionDetailResponse`
- `AssessmentRecordSearchCondition`

### 8.3 금지 규칙
- 하나의 DTO를 등록/수정/상세/목록에 공용으로 쓰지 않는다.
- 프론트 요구에 끌려 Entity 필드를 그대로 노출하지 않는다.

---

## 9. 척도 JSON 처리 구조

## 9.1 기본 원칙
- 척도 정의 원본은 DB가 아니라 JSON 파일이다.
- 서버는 시작 시 JSON을 읽어 메모리 레지스트리에 올린다.
- 세션 저장 시 레지스트리 기준으로 점수/판정/경고를 계산한다.

## 9.2 권장 파일 위치
```text
src/main/resources/scales/
├── common/
│   ├── scale-registry.json
│   ├── option-sets.json
│   ├── alert-types.json
│   └── result-snapshot-schema.json
├── phq9.json
├── gad7.json
├── mkpq16.json
├── kmdq.json
├── pss10.json
├── isik.json
├── auditk.json
└── iesr.json
```

## 9.3 로딩 흐름
1. `scale-registry.json` 로 지원 척도 목록 확인
2. 각 척도 파일 로딩
3. JSON 스키마/필수 필드 검증
4. `ScaleDefinition` 객체로 변환
5. `ScaleRegistry`에 등록

## 9.4 핵심 인터페이스 예시
```text
ScaleDefinitionLoader
- loadAll(): Map<String, ScaleDefinition>

ScaleRegistry
- getAll(): List<ScaleDefinition>
- get(scaleCode): ScaleDefinition
- exists(scaleCode): boolean

ScaleScoringEngine
- calculate(scaleDefinition, answers): CalculatedScaleResult
```

## 9.5 계산 결과 구조 권장
```text
CalculatedScaleResult
- scaleCode
- scaleName
- totalScore
- resultLevel
- hasAlert
- answerResults[]
- alerts[]
- rawResultSnapshot
```

---

## 10. 검사 세션 저장 아키텍처

## 10.1 핵심 원칙
- 저장 단위는 세션 전체다.
- 저장은 반드시 하나의 트랜잭션으로 처리한다.
- 점수/판정/경고는 서버가 최종 계산한다.

## 10.2 저장 처리 흐름
1. 요청 기본 형식 검증
2. 대상자 존재/상태 확인
3. 선택 척도 중복 확인
4. 척도 정의 조회
5. 각 척도 전 문항 응답 완료 여부 확인
6. 각 척도별 점수/판정/경고 계산
7. 세션 마스터 생성
8. 척도 결과 생성
9. 문항 응답 생성
10. 경고 생성
11. 로그 기록
12. 저장 결과 응답 반환

## 10.3 권장 서비스 구조
```text
AssessmentSessionCommandService
 ├─ validateSaveRequest()
 ├─ loadClient()
 ├─ calculateScaleResults()
 ├─ createSession()
 ├─ createSessionScales()
 ├─ createSessionAnswers()
 ├─ createSessionAlerts()
 └─ buildSaveResponse()
```

## 10.4 트랜잭션 기준
- `saveAssessmentSession()` 에 `@Transactional` 적용
- 하위 저장 실패 시 전체 롤백
- 로그는 같은 트랜잭션 또는 after-commit 중 택1
- 초기 버전은 같은 트랜잭션 적재 가능

## 10.5 저장 시 신뢰 원칙
- 클라이언트의 총점 전달값은 무시 가능
- 클라이언트의 판정/경고 전달값은 저장 근거로 사용하지 않음
- 서버는 answerValue만 신뢰하고 나머지는 재계산

---

## 11. 권한 처리 구조

## 11.1 권한 원칙
- 인증은 세션 사용자 존재 여부로 확인
- 인가는 역할 + 작성자 여부로 판단
- 서비스 계층에서 최종 권한 체크 수행

## 11.2 권장 방식
### 1안. 서비스 내부 명시 체크 (초기 버전 추천)
- `permissionService.canEditClient(user, client)`
- `permissionService.canMarkMisentered(user, session)`

### 2안. 커스텀 어노테이션/메서드 시큐리티
- 프로젝트가 커질 때 확장

초기 버전은 1안이 더 단순하고 추적이 쉽다.

## 11.3 권한 서비스 예시
```text
ClientPermissionService
- canViewMisregistered(user, client)
- canEdit(user, client)
- canMarkMisregistered(user, client)

AssessmentPermissionService
- canViewMisentered(user, session)
- canMarkMisentered(user, session)
- canPrint(user, session)
```

---

## 12. 인증 및 세션 처리 구조

## 12.1 인증 방식
- HttpSession 기반 인증
- 로그인 성공 시 `SessionUser` 저장
- 모든 인증 필요 API에서 세션 사용자 조회

## 12.2 세션 사용자 객체 권장 필드
```text
SessionUser
- userId
- loginId
- name
- role
- status
```

## 12.3 인터셉터/리졸버 권장 구성
- `LoginCheckInterceptor`
- `AdminCheckInterceptor` 또는 서비스 체크
- `CurrentUserArgumentResolver`

## 12.4 권장 적용 방식
- 인증 필요 경로: `/api/v1/**`
- 예외 경로: 로그인, 회원가입 신청
- 관리자 전용 경로: `/api/v1/admin/**`

---

## 13. Repository 설계 기준

## 13.1 분리 원칙
- 단순 CRUD: Spring Data JPA Repository
- 복잡 검색/집계: Custom Query Repository

## 13.2 권장 예시
```text
ClientRepository
ClientQueryRepository
AssessmentSessionRepository
AssessmentRecordQueryRepository
StatisticsQueryRepository
```

## 13.3 조회 전략
- 목록/통계는 DTO projection 우선
- 상세 조회는 필요한 경우 fetch join 사용
- N+1 방지 우선

## 13.4 통계 쿼리 원칙
- 오입력 제외 조건을 기본 where 절에 포함
- 날짜 범위 필터는 세션 완료 시각 기준 통일 권장

---

## 14. 예외 처리 구조

## 14.1 예외 분류
- `BusinessException`
- `ValidationException`
- `AuthorizationException`
- `AuthenticationException`
- `ResourceNotFoundException`

## 14.2 에러 응답 표준
```json
{
  "success": false,
  "message": "세션 저장에 실패했습니다.",
  "errorCode": "ANSWER_INCOMPLETE",
  "fieldErrors": []
}
```

## 14.3 전역 처리
- `GlobalExceptionHandler` 에서 공통 변환
- 내부 예외 메시지를 그대로 사용자에게 노출하지 않는다.
- 로그 메시지와 사용자 메시지를 구분한다.

---

## 15. 로깅 구조

## 15.1 애플리케이션 로그
- 요청 시작/종료
- 주요 예외
- 백업 실행 결과
- 척도 JSON 로딩 실패

## 15.2 업무 로그
다음 행위는 `activity_logs` 적재 기본 권장 대상이다.
- 로그인
- 회원가입 신청
- 승인/반려
- 사용자 역할 변경 / 상태 변경
- 대상자 등록/수정/오등록 처리
- 세션 저장
- 세션 오입력 처리
- 출력 실행
- 통계 export 실행
- 수동 백업 실행

## 15.3 분리 원칙
- 파일 로그: 시스템 운영용
- DB 활동 로그: 관리자 조회용

---

## 16. 백업 및 스케줄링 구조

## 16.1 자동 백업
- Spring Scheduler 사용
- 매일 지정 시간 실행
- 백업 결과는 `backup_histories` 저장

## 16.2 수동 백업
- 관리자 API 호출로 실행
- 실행 결과와 실패 사유 저장

## 16.3 권장 구조
```text
BackupService
 ├─ runManualBackup(reason, user)
 ├─ runScheduledBackup()
 ├─ createBackupFile()
 └─ saveBackupHistory()
```

---

## 17. Mapper 구조 원칙

### 17.1 역할
- Entity → Response DTO 변환
- Request DTO → Entity 생성 보조
- Summary/Detail 응답 조립

### 17.2 권장 방식
- 초기 버전은 수동 Mapper 권장
- MapStruct는 프로젝트 안정화 후 도입 가능

### 17.3 이유
- 응답 필드가 화면 정책에 따라 자주 달라질 수 있다.
- 수동 매핑이 디버깅과 변경 추적에 유리하다.

---

## 18. 공통 설정 구조

## 18.1 config 패키지 권장 구성
- `WebConfig`
- `SessionConfig`
- `JacksonConfig`
- `JpaConfig`
- `SchedulingConfig`
- `BackupProperties`
- `ScaleProperties`

## 18.2 application.yml 권장 항목
- datasource
- jpa
- session timeout
- backup path
- scale json path
- logging path

---

## 19. 환경별 프로필 권장

### 19.1 기본 프로필
- `local`
- `dev`
- `prod`

### 19.2 권장 차이
- local: 로컬 DB, 테스트 데이터 허용
- dev: 내부 테스트 서버
- prod: 실제 내부망 운영 서버

### 19.3 주의사항
- 운영 환경 백업 경로는 외부 하드코딩 금지
- 운영 비밀번호/경로는 환경 변수 또는 별도 설정 파일 사용

---

## 20. 화면/API와 서비스 매핑 기준

### 20.1 로그인 화면
- `AuthController` → `AuthService`

### 20.2 회원가입 신청/승인 화면
- `SignupRequestController` → `SignupRequestService`
- `AdminUserController` → `UserAdminService`

### 20.3 대상자 목록/상세/수정 화면
- `ClientController` → `ClientQueryService`, `ClientCommandService`

### 20.4 척도 선택/입력 화면
- `ScaleController` → `ScaleDefinitionService`

### 20.5 세션 요약/상세 화면
- `AssessmentSessionController` → `AssessmentSessionCommandService`, `AssessmentSessionQueryService`

### 20.6 검사기록 목록 화면
- `AssessmentRecordController` → `AssessmentRecordQueryService`

### 20.7 통계 화면
- `StatisticsController` → `StatisticsQueryService`, `StatisticsExportService`

### 20.8 관리자 운영 화면
- `AdminAuditController` → `ActivityLogService`
- `AdminBackupController` → `BackupService`

---

## 21. 개발 시작 순서 권장

### 1단계
- 공통 응답/예외 구조
- 인증/세션 구조
- 사용자/대상자 엔터티 및 리포지토리

### 2단계
- 척도 JSON 로더
- 척도 정의 조회 API
- 대상자 관리 API

### 3단계
- 세션 저장 계산 엔진
- 세션 저장 API
- 세션 상세 API

### 4단계
- 검사기록 목록
- 통계 API
- 관리자 로그/백업 API

### 5단계
- 자동 백업
- 출력용 데이터 조회
- 성능 점검 및 인덱스 튜닝

---

## 22. 바이브 코딩 시 반드시 지켜야 할 구현 규칙

1. 세션 저장 API는 무조건 서버 재계산 구조로 만든다.
2. 세션 저장은 무조건 단일 트랜잭션으로 만든다.
3. 오입력/오등록은 삭제가 아니라 상태 변경으로 구현한다.
4. 목록 응답과 상세 응답의 필드 범위를 섞지 않는다.
5. 척도 정의는 DB가 아니라 JSON 원본을 기준으로 한다.
6. Controller는 얇게, Service는 명확하게 유지한다.
7. 통계/목록 쿼리는 엔터티 반환보다 DTO 조회를 우선한다.
8. 권한 체크는 서비스 계층에서 최종 보장한다.
9. 민감정보는 필요한 API에서만 내려준다.
10. 로그는 운영 로그와 업무 로그를 구분한다.

---

## 23. 현재 버전 최종 권장 구조

초기 구현은 아래 조합을 권장한다.

- Spring Boot + Session Auth + JPA
- 기능 기준 패키지 구조
- JSON 기반 척도 레지스트리
- 서비스 계층 중심 권한 체크
- 세션 저장 전용 계산 엔진 분리
- 통계/목록 전용 Query Repository 분리
- 관리자 기능은 기존 모듈을 조합하는 얇은 서비스 구조

이 구조면 현재 프로젝트 범위에서 과하지 않으면서도,
실제 개발 착수와 이후 유지보수 둘 다 대응 가능하다.

---

## 24. 다음 단계 연계

본 문서 다음 단계로는 아래 순서를 권장한다.

1. `06-frontend-architecture.md`
   - 화면 구현 구조
   - 라우팅
   - 상태관리
   - 폼 처리 방식

2. `07-validation-rules.md`
   - 입력 검증 규칙 통합
   - 세션 저장 검증 규칙
   - 에러 코드 세분화

3. `08-error-handling.md`
   - 전역 예외 처리 기준
   - 사용자 메시지 정책
   - 로깅 정책 정리

---

## 25. 결정사항 요약

- 백엔드는 기능 기준 패키지 구조로 나눈다.
- Controller / Service / Repository / Infrastructure 레이어를 분리한다.
- 인증은 HttpSession 기반으로 구현한다.
- 권한 체크는 서비스 계층에서 최종 보장한다.
- 척도 정의는 JSON 파일에서 로딩한다.
- 점수/판정/경고는 서버가 최종 계산한다.
- 검사 세션 저장은 세션 단위 단일 트랜잭션으로 처리한다.
- 통계와 목록 조회는 DTO projection 중심으로 구현한다.
- 오입력/오등록은 상태값 변경 방식으로 구현한다.
- 활동 로그와 시스템 로그를 분리한다.
