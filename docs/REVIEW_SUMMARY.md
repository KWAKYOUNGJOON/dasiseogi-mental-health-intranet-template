# 문서 점검 요약

## 점검 범위
- 업로드된 Markdown 문서 12종
- README 1종
- 실제 구현 소스코드(Java / TypeScript / SQL 등)는 업로드 범위에 없음

## 핵심 수정 사항
1. **문서 참조 파일명 정리**
   - `project-overview.md` → `00-project-overview.md`
   - `01_screen_structure.md` → `01-screen-structure.md` 로 통일 권장

2. **용어 정리**
   - 대상자 상태는 **오등록(MISREGISTERED)**
   - 세션/검사기록 상태는 **오입력(MISENTERED)**
   - 일부 문서에서 대상자에도 `오입력` 표현이 섞여 있던 부분 수정

3. **README 최신화**
   - 예전 “향후 확장 예정” 상태에서 현재 문서 세트 기준의 index 문서로 재작성
   - 현재 업로드 범위에 실제 구현 코드가 없다는 점 명시

4. **mKPQ-16 범위 정리**
   - `04-scale-json.md` 에서 distress 보조 입력이 현재 v1 API와 충돌하던 부분 정리
   - 현재 구현 범위는 `Y/N` 단일값 저장으로 명확화
   - distress는 향후 확장 항목으로 분리

5. **로그 설계 보강**
   - 사용자 역할/상태 변경
   - 통계 export
   - signup request target_type
   위 항목이 DB / API / 백엔드 / 테스트 문서에 반영되도록 정리

6. **오탈자 수정**
   - `동일 날짜라도 세션은 생성 시각 기준으로 별도로 구분한다.` 등

7. **API 응답 원칙 미세 정리**
   - `03-api-spec.md`에서 세션 참고 메모 반환 범위를 세션 상세 조회 API 중심으로 정리
   - 세션 저장 응답은 상세 이동에 필요한 최소 식별/요약 정보 반환으로 표현 보정

8. **권한 문구 세부 정리**
   - `07-validation-rules.md`, `08-error-handling.md`의 포함 조회 권한 표현을
     `오등록/오입력 포함 조회`로 통일

## 삭제/치환 권장
- 기존 `01_screen_structure.md` 는 삭제하거나 보관용으로 두고,
  실사용 문서명은 `01-screen-structure.md` 로 통일하는 것을 권장한다.
