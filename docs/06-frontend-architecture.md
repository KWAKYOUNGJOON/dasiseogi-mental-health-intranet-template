# 다시서기 정신건강 평가관리 시스템 프론트엔드 구조 설계

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `01-screen-structure.md`, `03-api-spec.md`, `04-scale-json.md`, `05-backend-architecture.md`를 기준으로,
다시서기 정신건강 평가관리 시스템의 **프론트엔드 구현 구조**를 실제 개발 가능한 수준으로 정의한 문서이다.

본 문서의 목적은 다음과 같다.

- 화면 구조 문서를 실제 화면 코드 구조로 연결한다.
- 페이지, 컴포넌트, 상태관리, API 호출 방식의 기준을 통일한다.
- 대상자 중심 업무 흐름과 척도 입력 흐름이 꼬이지 않도록 라우팅과 상태 경계를 확정한다.
- 바이브 코딩 과정에서 폴더 구조, 공통 레이아웃, 폼 처리 방식, 화면 책임 분리를 빠르게 고정한다.

---

## 2. 프론트엔드 설계 목표

### 2.1 핵심 목표
- 내부망 데스크톱 환경에 맞는 빠르고 단순한 업무형 UI를 제공한다.
- 대상자 검색 → 상세 → 검사 시작 → 척도 입력 → 저장 흐름을 가장 짧고 안정적으로 만든다.
- 목록 화면, 상세 화면, 입력 화면의 책임을 분리해 유지보수 가능한 구조를 만든다.
- API 명세, 권한 정책, 민감정보 노출 원칙을 화면 레벨에서 일관되게 적용한다.
- 척도 입력 중 사용자의 실수를 줄이는 방향으로 상태 관리와 검증 구조를 설계한다.

### 2.2 구현 우선순위
1. 로그인/권한 분기
2. 공통 레이아웃 및 라우팅
3. 대상자 목록/상세/등록/수정
4. 척도 선택 및 척도 입력 흐름
5. 세션 요약/상세
6. 검사기록 목록
7. 통계 화면
8. 관리자 화면

---

## 3. 기술 방향 권장안

초기 버전은 **빠른 구현, 상태 명확성, 유지보수성**을 우선한다.

### 3.1 권장 기술 스택
- Language: TypeScript
- Framework: React
- Build Tool: Vite
- Router: React Router
- Server State: TanStack Query
- Client/UI State: Zustand
- Form: React Hook Form
- Validation Helper: Zod
- HTTP Client: Axios
- UI Styling: Tailwind CSS
- Table: TanStack Table 또는 단순 공통 테이블 컴포넌트
- Chart: Recharts

### 3.2 선택 이유
- TypeScript 기반으로 DTO와 화면 상태를 명확하게 맞출 수 있다.
- TanStack Query로 목록/상세/통계 데이터의 캐시와 재조회 제어가 쉽다.
- Zustand는 세션 입력 같은 로컬 UI 상태를 가볍게 관리하기 좋다.
- React Hook Form은 대상자 등록/수정, 로그인, 관리자 처리 폼에 적합하다.
- Tailwind CSS는 내부망 업무형 화면을 빠르게 고정하기 좋다.
- 척도 입력처럼 상태가 많은 화면도 컴포넌트 조합으로 나누기 쉽다.

### 3.3 구현 원칙
- 프론트는 사용자 경험을 위해 점수/판정을 임시 계산할 수 있으나, **최종 진실값은 서버 응답**으로 본다.
- 민감정보는 필요한 화면에서만 요청/노출한다.
- 세션 저장 직전까지는 프론트의 임시 상태로 관리하고, 저장 성공 후 서버 데이터 기준으로 상세 화면으로 이동한다.
- 화면 로직과 API 호출 로직을 분리한다.

---

## 4. 전체 프론트엔드 구조 원칙

### 4.1 구조 분리 기준
프론트엔드는 아래 6개 층위로 나눈다.

1. **app**
   - 앱 진입점
   - 전역 Provider
   - 라우터 구성
   - 전역 레이아웃

2. **pages**
   - 실제 URL 단위 화면
   - 페이지 조합과 데이터 호출 orchestration

3. **features**
   - 기능 단위 UI, 훅, 상태, API 모듈
   - 예: auth, clients, assessment, statistics, admin

4. **entities**
   - 공통 도메인 타입과 표시용 작은 UI 조각
   - 예: ClientSummaryCard, SessionBadge

5. **widgets**
   - 여러 화면에서 재사용하는 중간 단위 블록
   - 예: 검색 필터 바, 상단 정보 패널, 결과 요약 테이블

6. **shared**
   - 공통 컴포넌트, API 클라이언트, 유틸, 상수, 레이아웃

### 4.2 의존 방향 원칙
- pages → features / widgets / entities / shared
- features → entities / shared
- widgets → entities / shared
- entities → shared
- shared는 다른 계층을 참조하지 않는다.

### 4.3 금지 원칙
- 페이지 컴포넌트 안에 직접 Axios 호출 코드 작성 금지
- 여러 화면이 공유하는 필터/테이블/모달을 각 페이지에서 중복 구현 금지
- 세션 입력 상태를 URL query만으로 관리하는 방식 금지
- 서버 응답 DTO를 가공 없이 컴포넌트 트리에 흩뿌리는 방식 금지
- 목록 화면과 상세 화면의 민감정보 노출 기준 혼합 금지

---

## 5. 권장 폴더 구조

```text
src/
├── app/
│   ├── providers/
│   ├── router/
│   ├── layouts/
│   └── App.tsx
├── pages/
│   ├── auth/
│   ├── clients/
│   ├── assessment/
│   ├── records/
│   ├── statistics/
│   ├── admin/
│   └── not-found/
├── features/
│   ├── auth/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── components/
│   │   └── types/
│   ├── clients/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/
│   │   ├── forms/
│   │   └── types/
│   ├── assessment/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── evaluator/
│   │   ├── components/
│   │   ├── forms/
│   │   └── types/
│   ├── records/
│   ├── statistics/
│   ├── admin/
│   └── backup/
├── widgets/
│   ├── app-shell/
│   ├── filters/
│   ├── tables/
│   ├── summaries/
│   └── modals/
├── entities/
│   ├── client/
│   ├── session/
│   ├── scale/
│   ├── user/
│   └── alert/
├── shared/
│   ├── api/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── utils/
└── main.tsx
```

### 5.1 구조 원칙
- 페이지는 URL 책임만 가진다.
- API 호출, 상태, 폼 로직은 가능한 `features` 아래에 둔다.
- 화면 재사용성이 높아지면 pages에서 widgets로 끌어올린다.
- 척도 입력 전용 상태는 `features/assessment/store` 에 격리한다.

---

## 6. 라우팅 구조

## 6.1 기본 라우트 맵

```text
/
├── /login
├── /signup
├── /clients
│   ├── /new
│   ├── /:clientId
│   ├── /:clientId/edit
│   └── /:clientId/sessions
├── /assessments
│   ├── /start/:clientId
│   ├── /start/:clientId/scales
│   ├── /start/:clientId/input
│   ├── /start/:clientId/summary
│   └── /sessions/:sessionId
├── /records
├── /statistics
└── /admin
    ├── /signup-requests
    ├── /users
    ├── /logs
    └── /backups
```

### 6.2 라우팅 원칙
- 로그인 후 기본 진입은 `/clients` 로 한다.
- 새 검사 흐름은 항상 대상자 기반 URL에서 시작한다.
- 세션 저장 전 흐름은 `/assessments/start/:clientId/*` 하위로 묶는다.
- 관리자 라우트는 공통 레이아웃 안에 두되, 메뉴 노출과 접근 가드는 역할 기반으로 제어한다.

### 6.3 권장 라우트 가드
- `GuestOnlyRoute`: 로그인/회원가입 화면 보호
- `ProtectedRoute`: 로그인 필수
- `AdminRoute`: 관리자 전용
- `OwnerOrAdminGuard` 는 라우트보다는 버튼 노출 및 API 결과 처리에서 사용하는 것을 권장한다.

---

## 7. 레이아웃 구조

## 7.1 공통 앱 레이아웃
- 좌측 사이드 메뉴
- 상단 바(현재 사용자, 로그아웃)
- 본문 컨텐츠 영역
- 공통 알림/토스트 영역
- 공통 모달 루트

### 7.2 공통 메뉴 구성
- 대상자
- 검사기록
- 통계
- 관리자 전용: 회원가입 승인 / 사용자 관리 / 로그 확인 / 백업 관리

### 7.3 레이아웃 설계 원칙
- 데스크톱 업무 환경에 맞춰 좌우 여백이 과도하게 넓지 않은 고정형 레이아웃을 사용한다.
- 목록 화면은 넓은 본문과 테이블 중심 배치로 구성한다.
- 입력 화면은 정보 밀도를 낮추고 집중형 레이아웃으로 전환한다.
- 위험/주의/오입력 버튼은 시각적으로 명확히 구분한다.

---

## 8. 상태 관리 전략

## 8.1 상태 종류 구분

### 1) 서버 상태
- 대상자 목록
- 대상자 상세
- 세션 상세
- 검사기록 목록
- 통계 데이터
- 사용자 목록
- 승인 대기 목록

관리 도구
- TanStack Query

### 2) 화면 UI 상태
- 필터 패널 열림 여부
- 모달 열림 여부
- 현재 활성 탭
- 선택된 테이블 행
- 토스트/다이얼로그 상태

관리 도구
- 로컬 state 또는 작은 Zustand store

### 3) 입력 폼 상태
- 로그인 입력
- 회원가입 입력
- 대상자 등록/수정
- 관리자 승인/반려 사유

관리 도구
- React Hook Form

### 4) 세션 작성 상태
- 선택한 척도 목록
- 현재 진행 중인 척도 인덱스
- 척도별 답변
- 임시 계산 점수/경고
- 요약 메모
- 저장 가능 여부

관리 도구
- Zustand

## 8.2 세션 작성 상태를 별도 store로 분리하는 이유
- 척도 선택 → 입력 → 요약 화면이 여러 페이지 단계로 나뉜다.
- 브라우저 내 이동 시 상태를 안전하게 유지해야 한다.
- 여러 척도 응답을 한 번에 저장 payload로 조합해야 한다.
- 이전/다음 이동과 완료 여부 판단 로직이 복잡하다.

## 8.3 세션 작성 store 예시 구조
```ts
interface AssessmentDraftState {
  clientId: number | null;
  selectedScaleCodes: string[];
  currentScaleCode: string | null;
  answersByScale: Record<string, Record<number, string>>;
  previewByScale: Record<string, ScalePreviewResult>;
  memo: string;
  startedAt: string | null;
  completedAt: string | null;
  actions: {
    startDraft: (clientId: number, scaleCodes: string[]) => void;
    setAnswer: (scaleCode: string, questionNo: number, value: string) => void;
    setMemo: (memo: string) => void;
    goNextScale: () => void;
    goPrevScale: () => void;
    resetDraft: () => void;
  };
}
```

### 8.4 세션 작성 상태 원칙
- 임시저장 기능은 제공하지 않으므로, store는 메모리 상태를 기본으로 한다.
- 저장 완료 또는 취소 시 반드시 reset 한다.
- 새 검사 시작 시 기존 draft가 있으면 사용자에게 명확히 경고한다.
- 브라우저 새로고침 복원은 초기 버전에서 선택사항으로 두되, 우선순위는 낮다.

---

## 9. API 호출 구조

## 9.1 공통 API 레이어
- `shared/api/http.ts`: Axios 인스턴스
- `shared/api/interceptors.ts`: 공통 에러 처리, 401 처리
- `features/*/api/*.ts`: 기능별 API 함수

### 9.2 Axios 인스턴스 원칙
- `baseURL = /api/v1`
- 세션 쿠키 전송을 위한 `withCredentials` 설정
- 401 발생 시 로그인 화면으로 이동 또는 세션 만료 알림 표시
- 서버 표준 응답 포맷을 공통 해석

### 9.3 Query Key 원칙
```ts
queryKeys = {
  auth: ['auth'],
  clients: ['clients'],
  clientDetail: (id: number) => ['clients', id],
  clientSessions: (id: number) => ['clients', id, 'sessions'],
  scales: ['scales'],
  scaleDetail: (code: string) => ['scales', code],
  sessionDetail: (id: number) => ['assessment-sessions', id],
  assessmentRecords: ['assessment-records'],
  statisticsSummary: (params) => ['statistics', 'summary', params],
};
```

### 9.4 Mutation 이후 처리 원칙
- 대상자 등록 후 `clientDetail` 이동
- 대상자 수정 후 상세 캐시 invalidation
- 세션 저장 후 draft reset + 세션 상세 이동
- 오입력 처리 후 목록/상세/통계 관련 캐시 invalidation

---

## 10. 타입 구조 원칙

## 10.1 타입 분리 기준
- `ApiResponse<T>`: 서버 공통 응답
- `Request DTO`: 폼 제출용
- `Response DTO`: 서버 응답 원형
- `View Model`: 화면 렌더링용 가공 타입

### 10.2 타입 관리 원칙
- 서버 응답 타입과 화면 가공 타입을 분리한다.
- 날짜 문자열은 API boundary에서만 원문 유지하고, 화면 내부에서는 formatter를 거친다.
- `enum` 대신 문자열 union 타입을 우선 사용해 백엔드 코드값과 맞춘다.

예시
```ts
export type UserRole = 'ADMIN' | 'USER';
export type SessionStatus = 'COMPLETED' | 'MISENTERED';
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'MISREGISTERED';
```

---

## 11. 화면별 구현 구조

## 11.1 로그인 화면
### 책임
- 로그인 입력
- 로그인 요청
- 승인 대기/비활성/반려 상태 메시지 처리

### 구성
- `LoginPage`
- `LoginForm`
- `useLoginMutation`

### 규칙
- 성공 시 `/clients` 이동
- 실패 메시지는 폼 상단 고정 위치에 표시

---

## 11.2 회원가입 신청 화면
### 책임
- 계정 신청 입력
- 신청 성공 안내

### 구성
- `SignupRequestPage`
- `SignupRequestForm`

---

## 11.3 대상자 목록 화면
### 책임
- 이름 검색
- 생년월일 보조 필터
- 오등록 포함 여부
- 대상자 테이블 표시

### 구성
- `ClientListPage`
- `ClientSearchFilter`
- `ClientTable`
- `ClientListToolbar`

### 규칙
- 목록 응답에는 연락처를 노출하지 않는다.
- 이름 클릭 또는 상세보기 버튼으로만 상세 이동한다.
- 오등록 포함 옵션은 권한에 따라 노출한다.

---

## 11.4 대상자 등록/수정 화면
### 책임
- 대상자 기본정보 입력
- 중복 확인 경고
- 저장/수정 요청

### 구성
- `ClientCreatePage`
- `ClientEditPage`
- `ClientForm`
- `DuplicateCheckPanel`

### 규칙
- 사례번호는 입력 필드에 두지 않는다.
- 중복 경고는 저장 차단이 아니라 참고용으로 표시한다.

---

## 11.5 대상자 상세 화면
### 책임
- 대상자 기본정보 표시
- 연락처 표시
- 최근 세션 10건 표시
- 검사 시작 진입

### 구성
- `ClientDetailPage`
- `ClientHeaderCard`
- `RecentSessionList`
- `ClientActionBar`

### 규칙
- 연락처는 이 화면에서만 노출한다.
- 수정 버튼은 작성자/관리자에게만 노출한다.

---

## 11.6 척도 선택 화면
### 책임
- 지원 척도 목록 조회
- 복수 선택
- 고정 순서 정렬
- draft 시작

### 구성
- `AssessmentScaleSelectPage`
- `ScaleSelectionList`
- `SelectedScaleSummary`

### 규칙
- 추천 묶음 버튼은 초기 버전에 넣지 않는다.
- 사용자가 체크한 척도만 선택하되, 내부 정렬은 시스템 고정 순서를 따른다.

---

## 11.7 척도 입력 화면
### 책임
- 현재 척도 문항 표시
- 문항 응답 기록
- 실시간 총점/판정/경고 preview 표시
- 이전/다음 이동

### 구성
- `AssessmentInputPage`
- `AssessmentStepper`
- `ScaleQuestionForm`
- `ScalePreviewPanel`
- `AssessmentProgressHeader`

### 규칙
- 한 번에 한 척도만 입력한다.
- 전 문항 응답 전에는 다음 완료 처리 또는 저장 진행이 불가하다.
- 마지막 척도 완료 시 요약 화면으로 이동한다.
- 이전 척도 복귀 시 기존 응답을 유지한다.

### 구현 포인트
- scale detail API를 통해 문항과 옵션을 불러온다.
- UX용 preview는 프론트에서 계산 가능하다.
- 저장 시 서버가 최종 계산하므로 preview와 서버 결과가 다를 가능성을 허용한다.

---

## 11.8 세션 전체 요약 화면
### 책임
- 선택 척도 전체 결과 요약
- 메모 입력
- 저장 실행

### 구성
- `AssessmentSummaryPage`
- `AssessmentSummaryTable`
- `AssessmentMemoField`
- `SubmitAssessmentButton`

### 규칙
- 메모는 화면과 상세보기에서만 사용한다.
- 저장 버튼 클릭 시 중복 제출 방지 처리를 한다.
- 저장 성공 후 세션 상세 화면으로 이동한다.

---

## 11.9 세션 상세 화면
### 책임
- 세션 전체 결과 조회
- 척도별 상세 결과 표시
- 경고/메모/출력 버튼 표시
- 오입력 처리

### 구성
- `AssessmentSessionDetailPage`
- `SessionSummaryHeader`
- `ScaleResultAccordion`
- `SessionAlertPanel`
- `SessionMemoPanel`
- `SessionActionBar`

### 규칙
- 검사기록 목록에서 들어온 경우 특정 척도를 강조 표시한다.
- 오입력 버튼은 작성자/관리자만 표시한다.
- 출력 버튼은 이 화면에서만 제공한다.

---

## 11.10 검사기록 목록 화면
### 책임
- 척도 결과 단위 목록 조회
- 날짜/담당자/대상자명/오입력 필터
- 세션 상세 이동

### 구성
- `AssessmentRecordListPage`
- `AssessmentRecordFilterBar`
- `AssessmentRecordTable`

### 규칙
- 목록 1행은 척도 결과 1건이다.
- 상세 이동 시 `sessionId` 와 `highlightScaleCode` 를 함께 넘긴다.

---

## 11.11 통계 화면
### 책임
- 전체 현황 요약
- 척도별 비교
- 경고 기록 모아보기
- 관리자 전용 엑셀 내보내기

### 구성
- `StatisticsPage`
- `StatisticsSummaryTab`
- `StatisticsScaleTab`
- `StatisticsAlertTab`
- `StatisticsFilterBar`

### 규칙
- 기본 기간은 이번 주다.
- 관리자만 export 버튼을 본다.
- 차트와 숫자 카드를 함께 제공한다.

---

## 11.12 관리자 화면
### 책임
- 가입 승인/반려
- 사용자 관리
- 로그 조회
- 백업 조회/수동 실행

### 구성
- `SignupRequestAdminPage`
- `UserManagementPage`
- `ActivityLogPage`
- `BackupManagementPage`

### 규칙
- 관리자 메뉴는 역할 기반 노출
- 처리 버튼은 항상 확인 모달을 거친다.

---

## 12. 척도 입력 UI 구조 상세

## 12.1 입력 화면 구성 원칙
- 상단: 대상자/진행 상태
- 중앙: 현재 척도 문항 목록
- 우측 또는 하단: 현재 점수/판정/경고 preview
- 하단: 이전/다음 버튼

## 12.2 공통 질문 렌더링 구조
```text
ScaleQuestionForm
├── ScaleQuestionItem
│   ├── QuestionText
│   └── OptionGroup
├── ScaleQuestionItem
└── ...
```

## 12.3 옵션 렌더링 원칙
- 척도별 option set은 서버 정의를 신뢰한다.
- UI는 라디오/예-아니오/빈도형 옵션을 공통 컴포넌트로 처리한다.
- 특정 척도 전용 보조 설명은 scale meta에서 받아 표시한다.

## 12.4 진행 제어 원칙
- 현재 척도 완료 여부는 `answersByScale[scaleCode]` 와 문항 수 비교로 판단한다.
- 진행 중 이탈 시 확인 모달을 띄운다.
- 저장 전까지는 언제든 이전 척도로 이동 가능하다.

---

## 13. 권한 및 노출 제어 원칙

## 13.1 버튼 노출 기준
- 대상자 수정: 작성자 또는 관리자
- 대상자 오등록 처리: 작성자 또는 관리자
- 세션 오입력 처리: 작성자 또는 관리자
- 대상자 목록의 `오등록 포함` 토글: 작성자 또는 관리자
- 검사기록 목록의 `오입력 포함` 토글: 작성자 또는 관리자
- 통계 엑셀 내보내기: 관리자
- 관리자 메뉴: 관리자

## 13.2 민감정보 노출 기준
- 대상자 연락처: 상세 화면만
- 세션 메모: 요약 화면 입력, 상세 화면 표시
- 출력 화면/출력용 데이터: 메모 제외
- 목록 화면: 최소 정보만 노출

## 13.3 프론트에서의 권한 처리 원칙
- 버튼/메뉴 숨김은 UX 보조일 뿐이다.
- 실제 권한 판정은 항상 서버 응답 기준으로 처리한다.
- 403 발생 시 공통 권한 오류 토스트 또는 안내 화면을 제공한다.

---

## 14. 에러/로딩 처리 원칙

## 14.1 로딩 처리
- 전체 페이지 초기 로딩: skeleton 또는 페이지 스피너
- 목록 필터 변경 재조회: 테이블 영역만 로딩 표시
- 저장/처리 버튼: 버튼 단위 로딩 상태 표시

## 14.2 에러 처리
- 폼 검증 에러: 필드 하단 메시지
- 서버 업무 에러: 폼 상단 또는 액션 영역 메시지
- 세션 만료: 로그인 재유도
- 치명적 페이지 에러: 공통 에러 블록 + 재시도 버튼

## 14.3 공통 에러 UX 원칙
- 사용자가 해야 할 행동이 있는 메시지를 우선한다.
- 내부 예외 문구를 그대로 노출하지 않는다.
- 위험 작업은 실패/성공 결과를 토스트와 화면 상태로 함께 보여준다.

---

## 15. 공통 컴포넌트 권장 목록

### 15.1 기본 공통 컴포넌트
- `PageHeader`
- `SectionCard`
- `SearchToolbar`
- `DataTable`
- `Pagination`
- `EmptyState`
- `LoadingBlock`
- `ConfirmDialog`
- `StatusBadge`
- `AlertBanner`
- `PermissionGuard`

### 15.2 업무형 공통 컴포넌트
- `ClientSummaryCard`
- `SessionSummaryCard`
- `ScaleResultBadge`
- `AlertCountBadge`
- `DateRangeFilter`
- `WorkerSelectFilter`

---

## 16. 화면-API 연결 기준

## 16.1 auth
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## 16.2 clients
- `GET /clients`
- `POST /clients/duplicate-check`
- `POST /clients`
- `GET /clients/{clientId}`
- `PATCH /clients/{clientId}`
- `POST /clients/{clientId}/mark-misregistered`
- `GET /clients/{clientId}/assessment-sessions`

## 16.3 assessment
- `GET /scales`
- `GET /scales/{scaleCode}`
- `POST /assessment-sessions`
- `GET /assessment-sessions/{sessionId}`
- `POST /assessment-sessions/{sessionId}/mark-misentered`
- `GET /assessment-sessions/{sessionId}/print-data`

## 16.4 records / statistics / admin
- `GET /assessment-records`
- `GET /statistics/summary`
- `GET /statistics/scales`
- `GET /statistics/alerts`
- `GET /statistics/export`
- `GET /admin/signup-requests`
- `POST /admin/signup-requests/{requestId}/approve`
- `POST /admin/signup-requests/{requestId}/reject`
- `GET /admin/users`
- `PATCH /admin/users/{userId}/role`
- `PATCH /admin/users/{userId}/status`
- `GET /admin/activity-logs`
- `GET /admin/backups`
- `POST /admin/backups/run`

---

## 17. 구현 우선순위 상세

### 17.1 1차 구현
- 로그인
- 앱 레이아웃
- 대상자 목록/상세/등록
- 척도 선택/입력/요약
- 세션 상세

### 17.2 2차 구현
- 대상자 수정
- 검사기록 목록
- 통계 요약
- 관리자 승인/사용자 관리

### 17.3 3차 구현
- 통계 차트 고도화
- 로그/백업 화면
- 출력 UX 개선
- 권한/오입력 예외 UX 보강

---

## 18. 바이브 코딩 시 적용할 구현 규칙

### 18.1 페이지 작성 규칙
- 페이지는 200줄 내외를 목표로 유지한다.
- 데이터 조회와 화면 블록 배치를 담당하고, 상세 UI는 하위 컴포넌트로 분리한다.

### 18.2 기능 모듈 규칙
- API 함수, query hook, mutation hook, form schema, types를 기능별 폴더에 묶는다.
- 같은 기능의 파일이 여러 폴더로 흩어지지 않게 한다.

### 18.3 세션 입력 규칙
- 척도 입력 로직은 반드시 공통 상태 store를 사용한다.
- 척도 전환, preview 계산, 완료 여부 판단 로직을 컴포넌트 내부에 흩뿌리지 않는다.
- 저장 payload 조립은 `buildAssessmentPayload()` 같은 전용 유틸에서 처리한다.

### 18.4 캐시 처리 규칙
- 상세 화면 저장/수정 후 관련 목록 쿼리를 함께 invalidate 한다.
- 통계/기록 목록은 오입력 처리 이후 반드시 재조회한다.

---

## 19. 권장 파일 예시

```text
features/assessment/
├── api/
│   ├── getScales.ts
│   ├── getScaleDetail.ts
│   ├── createAssessmentSession.ts
│   ├── getAssessmentSessionDetail.ts
│   └── markAssessmentMisentered.ts
├── hooks/
│   ├── useScales.ts
│   ├── useScaleDetail.ts
│   ├── useAssessmentDraftGuard.ts
│   ├── useCreateAssessmentSession.ts
│   └── useAssessmentSessionDetail.ts
├── store/
│   └── assessmentDraftStore.ts
├── evaluator/
│   ├── previewScoreCalculator.ts
│   └── previewAlertEvaluator.ts
├── components/
│   ├── AssessmentProgressHeader.tsx
│   ├── ScaleSelectionList.tsx
│   ├── ScaleQuestionForm.tsx
│   ├── ScalePreviewPanel.tsx
│   ├── AssessmentSummaryTable.tsx
│   └── SessionAlertPanel.tsx
└── types/
    ├── assessment.ts
    └── scale.ts
```

---

## 20. 초안 기준 최종 권장 사항

- 프론트엔드는 React + TypeScript + Vite 조합을 기준으로 한다.
- 라우팅은 대상자 중심 흐름과 세션 작성 흐름을 분리해 구성한다.
- 서버 상태는 TanStack Query, 세션 작성 상태는 Zustand로 분리한다.
- 척도 입력은 한 척도씩 진행하는 단계형 화면으로 구현한다.
- 실시간 점수/판정 표시를 위해 프론트 preview 계산을 둘 수 있으나, 최종 결과는 서버 응답을 따른다.
- 목록/상세/입력/관리 화면의 책임을 분리한다.
- 민감정보 노출은 API 정책과 동일하게 화면에서도 제한한다.
- 오입력/권한/세션만료 예외를 공통 UX로 처리한다.

---

## 21. 다음 단계 연계

본 문서 다음 단계에서는 아래 문서를 작성하는 것을 권장한다.

1. `07-validation-rules.md`
   - 대상자 입력 검증
   - 세션 저장 검증
   - 척도 응답 검증
   - 공통 에러 코드 연결

2. `08-error-handling.md`
   - 프론트/백엔드 공통 에러 처리 체계
   - 사용자 메시지 기준
   - 화면별 에러 노출 규칙

---

## 22. 결정사항 요약

- 프론트엔드는 React + TypeScript + Vite 기준으로 설계한다.
- 로그인 후 기본 진입은 대상자 목록 화면이다.
- 라우팅은 대상자 흐름과 세션 작성 흐름을 명확히 분리한다.
- 서버 상태와 세션 작성 상태를 서로 다른 관리 도구로 분리한다.
- 세션 작성 상태는 전용 store에서 관리한다.
- 척도 입력은 한 번에 한 척도씩 진행한다.
- 실시간 계산 결과는 UX용 preview이며, 최종 결과는 서버를 기준으로 한다.
- 대상자 연락처는 상세 화면에서만 노출한다.
- 세션 메모는 요약/상세 화면에서만 다룬다.
- 관리자 메뉴와 버튼은 역할 기반으로 제어한다.
- 페이지는 URL 책임, features는 기능 책임, shared는 공통 책임으로 분리한다.
