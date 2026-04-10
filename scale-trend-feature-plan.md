# 척도 추세 기능 정리

이 문서는 기능 구현 완료 보고서가 아니라, 현재까지 확정된 요구사항/구현 단위 정리 문서이다.
현재 대화에서 확인된 사실만 정리하며, 확정되지 않은 백엔드 클래스명, 엔드포인트 경로, 컴포넌트 파일명은 임의로 만들지 않는다.

## 문서 상태

- 문서 성격: 구현 완료 보고서가 아닌 요구사항/구현 단위 정리 문서
- 정리 범위: 현재까지 확정된 사실만 반영
- 작업 범위: 코드 구현이 아니라 문서 파일 1개 추가

## 저장소

- 저장소: `KWAKYOUNGJOON/dasiseogi-mental-health-intranet-template`
- 문서 위치: 저장소 루트 `scale-trend-feature-plan.md`

## 기능 목표

- 대상자 상세 페이지 내부에 새 "척도 추세" 섹션을 추가한다.
- 대상자 1명 기준으로 척도 1개씩 선택해 line chart로 추세를 표시한다.
- 별도 통계 페이지로 분리하지 않는다.
- 이번 범위에서는 다중 척도 비교를 포함하지 않는다.

## 현재 확인된 구조

- 프론트엔드
- `frontend/src/pages/clients/ClientDetailPage.tsx`
  대상자 기본정보, 상태, 오등록 정보, 최근 검사 세션을 표시한다. 새 "척도 추세" 섹션 추가 예정 위치다.
- `frontend/src/features/clients/api/clientApi.ts`
  `fetchClientDetail(clientId)`가 현재 client detail과 `recentSessions`를 다룬다. 추세 데이터는 아직 포함되지 않는다.
- `frontend/src/features/assessment/api/assessmentApi.ts`
  `fetchScales()`가 존재한다.
  `ScaleListItem`에는 `scaleCode`, `scaleName`, `displayOrder`, `isActive`, `implemented`가 있다.
  `SessionDetail.scales`에는 `sessionScaleId`, `scaleCode`, `scaleName`, `totalScore`, `resultLevel`, `alerts`가 있다.
- `frontend/src/pages/assessment/AssessmentSessionDetailPage.tsx`
  세션 상세 화면이 존재한다. 추후 그래프 점 클릭 시 연결 후보 화면이다.
- `frontend/tests/client-detail-page.test.tsx`
  기존 대상자 상세 페이지 테스트 파일이다.
- `frontend/tests/assessment-session-detail-page.test.tsx`
  기존 세션 상세 테스트 파일이다.
- `frontend/package.json`
  현재 `recharts`, `chart.js`, `nivo` 같은 차트 라이브러리는 없다. 차트 라이브러리 선택은 아직 확정되지 않았다.

- 백엔드
- `backend/build.gradle`
  Spring Boot `3.5.13`, Java `21`, JPA, Validation, Web 구성이 확인되며 DB는 H2와 MariaDB 구성이다.

## 확정된 요구사항

- 범위
- 대상자 1명 기준이다.
- 척도는 1개씩만 조회한다.
- 다중 척도 비교는 이번 범위에서 제외한다.

- 척도 선택
- 드롭다운으로 척도를 선택한다.
- 드롭다운에는 현재 운영 중인 척도 전체를 표시한다.
- 선택 척도 기록이 없으면 "기록 없음" empty state를 표시한다.

- 기본 선택값
- 원칙은 그 대상자에게 가장 최근 기록이 있는 척도다.
- 기록이 전혀 없어도 화면이 깨지면 안 된다.

- 그래프 위치
- `frontend/src/pages/clients/ClientDetailPage.tsx` 내부 새 섹션에 둔다.
- 별도 통계 페이지로 분리하지 않는다.

- 그래프 형태
- line chart를 사용한다.
- 데이터가 1건이면 선 없이 점 1개만 표시한다.
- 우선 점수선만 구현한다.

- 정렬 기준
- `assessedAt` 날짜+시간 기준 오름차순이다.
- 동률이면 `createdAt`을 보조 정렬로 사용한다.

- 오입력 처리 정책
- `MISENTERED` 세션은 기본 제외한다.

- 날짜 표시 정책
- x축은 연-월-일 형식이다.
- tooltip은 연-월-일 시:분 형식이다.

- y축 / cutoff 정책
- 척도별 `maxScore`를 반영한다.
- cutoff 기준선을 표시한다.
- cutoff 라벨에는 숫자와 단계명을 함께 표시한다.

- tooltip 표시 항목
- 날짜/시간
- 총점
- `resultLevel`
- 경고유형 / 경고메시지
- 경고가 여러 개면 모두 표시한다.

- 판정 기준
- 저장 당시 판정 결과를 우선 사용한다.
- 프론트에서 재계산하지 않는다.

- 권한 정책
- 기존 대상자 조회 권한과 동일하다.
- 새 권한 체계를 만들지 않는다.

## 추천 확정안

- 기록이 전혀 없는 대상자의 기본 선택값은 `fetchScales()` 결과 중 `isActive === true`, `implemented === true`, `displayOrder` 오름차순 조건을 만족하는 첫 척도로 잡는다.
- "가장 최근 기록 척도"와 "현재 운영 중 척도 목록"이 충돌하면 기본 선택 후보는 현재 운영 중 척도 안에서만 잡는다.
- inactive 척도는 드롭다운과 기본 선택에서 제외한다.
- 선택 척도 기록이 없을 때 API는 `200 OK`와 scale meta를 포함하고 `points: []`로 응답한다.

## API 방향

- 조회 기준은 `clientId + scaleCode` 단일 척도 조합이다.
- 응답은 확장 가능한 메타정보를 포함하는 방향으로 정리한다.
- 응답 예시 필드 수준은 `scaleCode`, `scaleName`, `maxScore`, `cutoffs`, `points[]`다.
- `points[]`의 point 필드 수준은 `sessionId`, `sessionScaleId`, `assessedAt`, `createdAt`, `totalScore`, `resultLevel`, `alerts[]`다.
- `alerts[]`는 tooltip에 필요한 경고유형 / 경고메시지 표현이 가능해야 한다.
- 정책은 `MISENTERED` 제외, `assessedAt ASC`, 동률 시 `createdAt ASC`, 기록이 없으면 `points: []`다.

## 구현 작업 단위 분해

- 단일 척도 추세 API 응답 계약 확정
- 백엔드 point 조회 로직 추가
- 백엔드 scale meta / cutoff 조합
- 프론트 API 타입/호출 추가
- `frontend/src/pages/clients/ClientDetailPage.tsx`에 섹션 틀 추가
- 기본 선택값 처리
- 그래프 렌더링 구현
- 테스트 보완

## 변경 가능성이 높은 파일 후보

- 프론트
- `frontend/src/pages/clients/ClientDetailPage.tsx`
- `frontend/src/features/clients/api/clientApi.ts`
- `frontend/src/features/assessment/api/assessmentApi.ts`
- `frontend/tests/client-detail-page.test.tsx`
- `frontend/package.json`
- `frontend/src/pages/assessment/AssessmentSessionDetailPage.tsx`
- `frontend/tests/assessment-session-detail-page.test.tsx`

- 백엔드
- 대상자 조회 권한을 타는 controller / service / DTO 계층
- 세션 또는 세션 척도 추세 조회용 repository / query 로직
- scale meta / cutoff 응답 조합 DTO 또는 service

- 참고 확인 파일
- `backend/build.gradle`

## 최소 주의사항

- 점수 계산과 판정 계산은 서버 기준을 유지한다.
- 판정 결과는 저장 당시 값을 우선 사용하고 프론트에서 재계산하지 않는다.
- 세션 단위 저장 구조를 유지한다.
- 물리 삭제 대신 상태값 처리 원칙을 유지한다.
- 권한 분리 원칙은 유지하되, 이번 기능에는 새 권한 체계를 만들지 않고 기존 대상자 조회 권한을 그대로 따른다.
- `MISENTERED` 세션은 기본 제외 정책을 유지한다.
- 차트 라이브러리 선택은 아직 확정되지 않았으며, `frontend/package.json` 기준 현재 `recharts`, `chart.js`, `nivo` 같은 의존성은 없다.
- 문서에 없는 백엔드 클래스명, 엔드포인트 경로, 컴포넌트 파일명은 임의로 확정하지 않는다.

## 다음 1단계 작업

- 단일 척도 추세 API 응답 계약을 먼저 확정한다.
- 그 계약 기준으로 백엔드 point 조회와 scale meta / cutoff 조합 범위를 정리한다.
