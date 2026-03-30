# 다시서기 정신건강 평가관리 시스템 척도 및 채점 규칙 정의

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `01-screen-structure.md`, `02-db-design.md`, `03-api-spec.md`를 기준으로,  
다시서기 정신건강 평가관리 시스템에서 사용하는 척도 정의, 응답 구조, 채점 규칙, 판정 규칙, 경고 규칙, 결과 스냅샷 구조를 실제 구현 가능한 수준으로 정리한 문서이다.

이 문서는 다음 목적을 가진다.

- 척도 정의를 **서버 기준 단일 원본(Source of Truth)** 으로 관리한다.
- 프론트엔드와 백엔드가 동일한 문항 순서, 응답 옵션, 점수 계산 규칙을 사용하도록 한다.
- 검사 세션 저장 시 서버가 참조할 계산 규칙을 확정한다.
- `assessment_sessions`, `session_scales`, `session_answers`, `session_alerts`에 저장할 계산 결과 구조를 고정한다.
- 구현 단계에서 실제 JSON 파일(`scales/*.json`)을 만들 수 있는 설계 기준을 제공한다.

---

## 2. 설계 원칙

### 2.1 서버 최종 계산 원칙
- 프론트엔드는 사용자 편의를 위해 실시간 합계와 경고를 미리 보여줄 수 있다.
- 그러나 **최종 점수, 판정, 경고 생성은 서버가 다시 계산**한 값을 기준으로 한다.
- 저장 직전 클라이언트가 보낸 계산 결과는 신뢰하지 않는다.
- 서버는 척도 정의 JSON과 사용자가 보낸 원시 응답(raw answers)만으로 최종 결과를 재산출한다.

### 2.2 문항 텍스트 관리 원칙
- 본 문서는 **문항 텍스트 자체를 전부 복제하지 않는다.**
- 여러 정신건강 척도는 사용 허가, 번역본 사용 범위, 배포 형태에 제한이 있을 수 있으므로,  
  운영 시스템에서는 `questionKey`, `optionKey`, `textAssetKey` 중심으로 관리하는 것을 권장한다.
- 실제 서비스에 노출할 한국어 문항과 보기 텍스트는 아래 중 하나로 관리한다.
  - 기관 내부 전용 비공개 JSON 자산
  - 백엔드 리소스 번들
  - 허가된 번역본을 반영한 DB/설정 파일
- 이 문서는 **채점 규칙과 구조 정의 문서**이며, 전체 문항 원문집이 아니다.

### 2.3 판정과 경고의 분리 원칙
- `resultLevel` 은 점수 해석 결과를 표현한다.
- `screenFlag` 는 선별검사 기준 충족 여부를 표현한다.
- `alert` 는 즉시 주의가 필요한 응답 또는 점수 조건을 표현한다.
- 같은 척도라도 `resultLevel`, `screenFlag`, `alert` 는 서로 다른 기준으로 동시에 존재할 수 있다.

예시:
- PHQ-9 총점 13점 → `resultLevel=MODERATE`
- PHQ-9 총점 13점 → `screenFlag=SCREEN_POSITIVE`
- PHQ-9 9번 문항 1점 이상 → `alert=CRITICAL_ITEM`

### 2.4 진단명 자동표시 금지 원칙
- 본 시스템은 **진단 확정 시스템이 아니라 선별·평가 보조 시스템**으로 설계한다.
- 화면과 출력물에서는 가능하면 `우울 증상 중등도`, `불안 추가 평가 권고`, `외상후스트레스 고위험 의심`처럼  
  **점수 해석 또는 추가 평가 권고 표현**을 사용한다.
- `진단`, `확진`, `의학적 판정 완료`와 같은 표현은 자동 출력하지 않는다.

### 2.5 결과 재현성 원칙
- 세션 저장 시 척도 버전, 옵션 세트, 역채점 규칙, 계산 규칙 버전을 함께 스냅샷으로 저장한다.
- 추후 척도 정의 파일이 바뀌더라도, 과거 세션은 당시 계산 기준으로 재현 가능해야 한다.

---

## 3. 파일 배치 권장안

초기 버전은 아래와 같은 구조를 권장한다.

```text
/scales
  /common
    option-sets.json
    alert-types.json
    scale-registry.json
  phq9.json
  gad7.json
  mkpq16.json
  kmdq.json
  pss10.json
  isik.json
  auditk.json
  iesr.json
```

### 3.1 scale-registry.json 역할
- 활성 척도 목록
- 화면 표시 순서
- 척도명
- 지원 여부
- 응답 기간 안내 문구 키
- 출력 여부
- 통계 포함 여부

### 3.2 common option-sets 역할
척도마다 동일하게 반복되는 선택지를 공통 세트로 분리한다.

예시:
- `FREQ_4_LAST_2_WEEKS`
- `FREQ_5_LAST_MONTH`
- `BOOLEAN_YN`
- `LIKERT_0_TO_4_GENERIC`
- `AUDIT_Q9_Q10`
- `MDQ_IMPAIRMENT_4`
- `MKPQ_DISTRESS_4`

---

## 4. 공통 JSON 스키마 권장안

아래는 척도 정의 JSON의 공통 구조 예시이다.

```json
{
  "scaleCode": "PHQ9",
  "scaleName": "PHQ-9",
  "version": "1.0.0",
  "locale": "ko-KR",
  "isActive": true,
  "displayOrder": 1,
  "responseWindow": {
    "type": "LAST_2_WEEKS",
    "labelKey": "LAST_2_WEEKS"
  },
  "questionCount": 9,
  "questionTextPolicy": "TEXT_ASSET_REFERENCE",
  "items": [],
  "scoring": {},
  "interpretationRules": [],
  "screeningRules": [],
  "alertRules": [],
  "resultSnapshotSchema": {}
}
```

### 4.1 공통 필드 설명
- `scaleCode`
  - 시스템 내부 식별 코드
- `scaleName`
  - 화면 표시용 이름
- `version`
  - 채점 규칙 버전
- `locale`
  - 기본 언어 코드
- `displayOrder`
  - 척도 선택/입력 기본 순서
- `responseWindow`
  - 문항 안내 시 사용할 기준 기간
- `questionTextPolicy`
  - 문항 텍스트 저장 방식
- `items`
  - 문항 배열
- `scoring`
  - 합계 및 보조 점수 계산 규칙
- `interpretationRules`
  - 점수 구간 또는 조건별 해석
- `screeningRules`
  - 선별 기준 충족 여부
- `alertRules`
  - 실시간 경고 생성 규칙
- `resultSnapshotSchema`
  - 세션 저장 시 `raw_result_snapshot` 에 넣을 구조

---

## 5. 공통 문항 객체 권장안

```json
{
  "questionNo": 1,
  "questionKey": "phq9_q1",
  "textAssetKey": "scale.phq9.q1",
  "answerType": "SINGLE_CHOICE",
  "optionSetRef": "FREQ_4_LAST_2_WEEKS",
  "scoreSource": "OPTION_SCORE",
  "reverseScored": false,
  "required": true,
  "tags": []
}
```

### 5.1 자주 쓰는 추가 필드
- `subscaleCode`
  - 하위요인 점수 계산에 사용할 그룹
- `conditionalRequired`
  - 특정 응답일 때만 추가 입력 요구
- `alertTags`
  - 특정 문항 자체가 고위험 문항인 경우 태그 부여
- `extraAnswerFields`
  - mKPQ-16처럼 `presence + distress` 2단 구조가 필요한 경우 사용

---

## 6. 공통 옵션 세트 권장안

## 6.1 FREQ_4_LAST_2_WEEKS
PHQ-9, GAD-7에 사용한다.

```json
{
  "optionSetCode": "FREQ_4_LAST_2_WEEKS",
  "options": [
    { "value": "0", "labelKey": "NOT_AT_ALL", "score": 0 },
    { "value": "1", "labelKey": "SEVERAL_DAYS", "score": 1 },
    { "value": "2", "labelKey": "MORE_THAN_HALF_DAYS", "score": 2 },
    { "value": "3", "labelKey": "NEARLY_EVERY_DAY", "score": 3 }
  ]
}
```

## 6.2 FREQ_5_LAST_MONTH
PSS-10에 사용한다.

```json
{
  "optionSetCode": "FREQ_5_LAST_MONTH",
  "options": [
    { "value": "0", "labelKey": "NEVER", "score": 0 },
    { "value": "1", "labelKey": "ALMOST_NEVER", "score": 1 },
    { "value": "2", "labelKey": "SOMETIMES", "score": 2 },
    { "value": "3", "labelKey": "FAIRLY_OFTEN", "score": 3 },
    { "value": "4", "labelKey": "VERY_OFTEN", "score": 4 }
  ]
}
```

## 6.3 BOOLEAN_YN
K-MDQ, mKPQ-16의 증상 존재 응답에 사용한다.

```json
{
  "optionSetCode": "BOOLEAN_YN",
  "options": [
    { "value": "N", "labelKey": "NO", "score": 0 },
    { "value": "Y", "labelKey": "YES", "score": 1 }
  ]
}
```

## 6.4 LIKERT_0_TO_4_GENERIC
IES-R, ISI-K 일부 문항에 공통적으로 적용 가능한 0~4점형 선택지 세트다.

```json
{
  "optionSetCode": "LIKERT_0_TO_4_GENERIC",
  "options": [
    { "value": "0", "labelKey": "LEVEL_0", "score": 0 },
    { "value": "1", "labelKey": "LEVEL_1", "score": 1 },
    { "value": "2", "labelKey": "LEVEL_2", "score": 2 },
    { "value": "3", "labelKey": "LEVEL_3", "score": 3 },
    { "value": "4", "labelKey": "LEVEL_4", "score": 4 }
  ]
}
```

## 6.5 AUDIT_Q9_Q10
AUDIT 9, 10번 문항은 0/2/4 점수 체계를 사용한다.

```json
{
  "optionSetCode": "AUDIT_Q9_Q10",
  "options": [
    { "value": "0", "labelKey": "NO", "score": 0 },
    { "value": "2", "labelKey": "YES_NOT_LAST_YEAR", "score": 2 },
    { "value": "4", "labelKey": "YES_DURING_LAST_YEAR", "score": 4 }
  ]
}
```

## 6.6 MDQ_IMPAIRMENT_4
K-MDQ 마지막 기능손상 문항에 사용한다.

```json
{
  "optionSetCode": "MDQ_IMPAIRMENT_4",
  "options": [
    { "value": "NONE", "labelKey": "NO_PROBLEM", "score": 0 },
    { "value": "MINOR", "labelKey": "MINOR_PROBLEM", "score": 1 },
    { "value": "MODERATE", "labelKey": "MODERATE_PROBLEM", "score": 2 },
    { "value": "SERIOUS", "labelKey": "SERIOUS_PROBLEM", "score": 3 }
  ]
}
```

## 6.7 MKPQ_DISTRESS_4
mKPQ-16 **향후 확장 버전**에서 증상 존재 시 선택적으로 추가 수집하는 distress 점수에 사용한다. 현재 v1 저장 API에서는 사용하지 않는다.

```json
{
  "optionSetCode": "MKPQ_DISTRESS_4",
  "options": [
    { "value": "0", "labelKey": "NO_DISTRESS", "score": 0 },
    { "value": "1", "labelKey": "MILD_DISTRESS", "score": 1 },
    { "value": "2", "labelKey": "MODERATE_DISTRESS", "score": 2 },
    { "value": "3", "labelKey": "HIGH_DISTRESS", "score": 3 }
  ]
}
```

---

## 7. 공통 결과 스냅샷 구조 권장안

`session_scales.raw_result_snapshot` 에 아래 구조를 저장하는 것을 권장한다.

```json
{
  "scaleCode": "PHQ9",
  "scaleName": "PHQ-9",
  "scaleVersion": "1.0.0",
  "responseWindow": "LAST_2_WEEKS",
  "questionCount": 9,
  "rawAnswers": [
    {
      "questionNo": 1,
      "questionKey": "phq9_q1",
      "answerValue": "2",
      "scoreValue": 2
    }
  ],
  "computed": {
    "totalScore": 13,
    "subScores": {},
    "derivedFlags": [
      {
        "code": "SCREEN_POSITIVE",
        "label": "추가 평가 권고",
        "value": true
      }
    ],
    "resultLevel": {
      "code": "MODERATE",
      "label": "중등도"
    },
    "alerts": [
      {
        "alertCode": "PHQ9_ITEM9_ANY",
        "alertType": "CRITICAL_ITEM",
        "message": "자해·자살사고 관련 추가 평가 필요"
      }
    ]
  }
}
```

### 7.1 스냅샷 최소 포함 필드
- `scaleCode`
- `scaleVersion`
- `rawAnswers`
- `computed.totalScore`
- `computed.resultLevel`
- `computed.derivedFlags`
- `computed.alerts`

---

## 8. 척도별 정의

## 8.1 PHQ-9

### 기본 정보
- `scaleCode`: `PHQ9`
- `scaleName`: `PHQ-9`
- `displayOrder`: `1`
- `questionCount`: `9`
- `responseWindow`: `LAST_2_WEEKS`
- `optionSetRef`: `FREQ_4_LAST_2_WEEKS`
- `scoreRange`: `0 ~ 27`

### 문항 키
- `phq9_q1` ~ `phq9_q9`

### 점수 계산
- 모든 문항 점수를 단순 합산한다.
- 역채점 문항은 없다.

```json
{
  "scoring": {
    "type": "SUM",
    "scoreField": "score",
    "target": "totalScore",
    "range": { "min": 0, "max": 27 }
  }
}
```

### 해석 구간
- `0 ~ 4` : `MINIMAL`
- `5 ~ 9` : `MILD`
- `10 ~ 14` : `MODERATE`
- `15 ~ 19` : `MODERATELY_SEVERE`
- `20 ~ 27` : `SEVERE`

### 선별 규칙
- `totalScore >= 10` → `SCREEN_POSITIVE`
- 의미: 우울 증상에 대한 **추가 평가 권고**

### 경고 규칙
- `phq9_q9 >= 1` → `CRITICAL_ITEM`
- 의미: 자해·자살사고 관련 추가 평가 필요

### 권장 화면 표시
- 총점
- 해석 구간
- `추가 평가 권고` 여부
- 9번 문항 경고 배너

### 권장 JSON 예시
```json
{
  "scaleCode": "PHQ9",
  "questionCount": 9,
  "items": [
    { "questionNo": 1, "questionKey": "phq9_q1", "optionSetRef": "FREQ_4_LAST_2_WEEKS", "reverseScored": false },
    { "questionNo": 9, "questionKey": "phq9_q9", "optionSetRef": "FREQ_4_LAST_2_WEEKS", "reverseScored": false, "tags": ["SUICIDE_RISK_ITEM"] }
  ],
  "interpretationRules": [
    { "min": 0, "max": 4, "code": "MINIMAL", "label": "최소" },
    { "min": 5, "max": 9, "code": "MILD", "label": "경도" },
    { "min": 10, "max": 14, "code": "MODERATE", "label": "중등도" },
    { "min": 15, "max": 19, "code": "MODERATELY_SEVERE", "label": "중등도-중증" },
    { "min": 20, "max": 27, "code": "SEVERE", "label": "중증" }
  ],
  "screeningRules": [
    { "code": "PHQ9_SCREEN_10", "condition": "totalScore >= 10", "label": "추가 평가 권고" }
  ],
  "alertRules": [
    { "code": "PHQ9_ITEM9_ANY", "condition": "answer(phq9_q9) >= 1", "alertType": "CRITICAL_ITEM", "message": "자해·자살사고 관련 추가 평가 필요" }
  ]
}
```

---

## 8.2 GAD-7

### 기본 정보
- `scaleCode`: `GAD7`
- `scaleName`: `GAD-7`
- `displayOrder`: `2`
- `questionCount`: `7`
- `responseWindow`: `LAST_2_WEEKS`
- `optionSetRef`: `FREQ_4_LAST_2_WEEKS`
- `scoreRange`: `0 ~ 21`

### 문항 키
- `gad7_q1` ~ `gad7_q7`

### 점수 계산
- 모든 문항 점수를 단순 합산한다.
- 역채점 문항은 없다.

### 해석 구간
- `0 ~ 4` : `MINIMAL`
- `5 ~ 9` : `MILD`
- `10 ~ 14` : `MODERATE`
- `15 ~ 21` : `SEVERE`

### 선별 규칙
- `totalScore >= 10` → `SCREEN_POSITIVE`
- 의미: 불안 증상 **추가 평가 권고**

### 경고 규칙
- 기본 경고 규칙은 `totalScore >= 10` 경고 1단계, `totalScore >= 15` 경고 2단계를 권장한다.
- 개별 문항 단독 경고는 기본값으로 사용하지 않는다.

### 권장 JSON 예시
```json
{
  "scaleCode": "GAD7",
  "questionCount": 7,
  "interpretationRules": [
    { "min": 0, "max": 4, "code": "MINIMAL", "label": "최소" },
    { "min": 5, "max": 9, "code": "MILD", "label": "경도" },
    { "min": 10, "max": 14, "code": "MODERATE", "label": "중등도" },
    { "min": 15, "max": 21, "code": "SEVERE", "label": "중증" }
  ],
  "screeningRules": [
    { "code": "GAD7_SCREEN_10", "condition": "totalScore >= 10", "label": "추가 평가 권고" }
  ],
  "alertRules": [
    { "code": "GAD7_TOTAL_10", "condition": "totalScore >= 10", "alertType": "CAUTION", "message": "불안 증상 추가 평가 권고" },
    { "code": "GAD7_TOTAL_15", "condition": "totalScore >= 15", "alertType": "HIGH_RISK", "message": "불안 증상 고도 수준" }
  ]
}
```

---

## 8.3 mKPQ-16

### 기본 정보
- `scaleCode`: `MKPQ16`
- `scaleName`: `mKPQ-16`
- `displayOrder`: `3`
- `responseWindow`: `INSTRUMENT_SPECIFIC`
- `answerMode`: `BOOLEAN_SINGLE_VALUE`
- `scoreRange`: `0 ~ 19` (총 증상 체크 수 기준)

### 중요한 구현 메모
- 이름은 `mKPQ-16` 이지만, 검증 연구에서는 **수정 한국판 19문항 구조**로 다뤄진다.
- 따라서 시스템 구현 시 `questionCount=19` 로 관리하는 것을 권장한다.
- **현재 v1 저장 API와 DB 구조는 문항 1개당 `answerValue` 1개만 허용**한다.
- 따라서 현재 버전에서는 각 문항을 `Y/N` 단일 선택값으로 저장한다.
- `distress` 보조 입력은 추후 API/DB 확장 이후 별도 버전에서 도입한다.

### 문항 키
- `mkpq16_q1` ~ `mkpq16_q19`

### 현재 버전 입력 구조 권장안
```json
{
  "questionNo": 1,
  "questionKey": "mkpq16_q1",
  "answerType": "SINGLE_CHOICE",
  "optionSetRef": "BOOLEAN_YN",
  "required": true
}
```

### 현재 버전 점수 계산
- `endorsementCount`
  - `answerValue == 'Y'` 인 문항 수의 합
- 기본 화면 판정은 `endorsementCount` 기준으로 한다.
- 현재 버전에서는 `distressScore` 를 계산하지 않는다.

### 선별 규칙
- `endorsementCount >= 7` → `SCREEN_POSITIVE`

### 해석 규칙
- `endorsementCount < 7` : `NEGATIVE`
- `endorsementCount >= 7` : `POSITIVE_SCREEN`

### 경고 규칙
- `endorsementCount >= 7` → `CAUTION`
- 본 척도는 **중증도 단계형 해석보다 양성/음성 선별 중심**으로 처리한다.

### 현재 버전 권장 JSON 예시
```json
{
  "scaleCode": "MKPQ16",
  "questionCount": 19,
  "scoring": {
    "primary": {
      "target": "endorsementCount",
      "type": "COUNT_MATCH",
      "source": "answerValue",
      "matchValue": "Y",
      "range": { "min": 0, "max": 19 }
    }
  },
  "interpretationRules": [
    { "condition": "endorsementCount < 7", "code": "NEGATIVE", "label": "음성" },
    { "condition": "endorsementCount >= 7", "code": "POSITIVE_SCREEN", "label": "양성 의심" }
  ],
  "screeningRules": [
    { "code": "MKPQ16_SCREEN_7", "condition": "endorsementCount >= 7", "label": "정신병 위험군 추가 평가 권고" }
  ],
  "alertRules": [
    { "code": "MKPQ16_POSITIVE", "condition": "endorsementCount >= 7", "alertType": "CAUTION", "message": "정신병 위험군 선별 양성 의심" }
  ]
}
```

### 확장 옵션 (향후 버전)
- `distressScore` 는 API와 DB가 object형 응답을 지원할 때만 도입한다.
- 이 경우 `MKPQ_DISTRESS_4` option set과 `BOOLEAN_WITH_OPTIONAL_DISTRESS` answer mode를 별도 버전으로 분리하는 것을 권장한다.
- 현재 v1 문서 기준 구현 범위에는 포함하지 않는다.

---

## 8.4 K-MDQ

### 기본 정보
- `scaleCode`: `KMDQ`
- `scaleName`: `K-MDQ`
- `displayOrder`: `4`
- `responseWindow`: `LIFETIME_EPISODIC`
- `scoreRange`: `0 ~ 13` (증상 yes 개수 기준)

### 문항 구성
- 증상 문항 13개: `kmdq_symptom_1` ~ `kmdq_symptom_13`
- 동시성 문항 1개: `kmdq_same_period`
- 기능손상 문항 1개: `kmdq_impairment`

### 입력 구조
- 1~13번: `BOOLEAN_YN`
- 동시성 문항: `BOOLEAN_YN`
- 기능손상 문항: `MDQ_IMPAIRMENT_4`

### 기본 점수 계산
- `symptomYesCount`
  - 13개 증상 문항에서 `Y` 개수의 합
- `samePeriod`
  - 별도 보조 필드
- `impairmentLevel`
  - 별도 보조 필드

### 기본 운영 규칙(권장)
본 시스템 기본 운영 규칙은 **한국판 검증 연구 기준**으로 설정한다.

- `symptomYesCount >= 7` → `SCREEN_POSITIVE`
- `samePeriod`, `impairmentLevel` 은 저장은 하되 **기본 양성 판정 계산에서는 제외**한다.

### 선택 운영 규칙(옵션)
원본 MDQ 기준을 함께 계산하고 싶다면 아래 보조 플래그를 추가할 수 있다.

- `symptomYesCount >= 7`
- `samePeriod == Y`
- `impairmentLevel in (MODERATE, SERIOUS)`

위 세 조건을 모두 충족하면 `ORIGINAL_MDQ_POSITIVE = true`

### 해석 규칙
- `symptomYesCount < 7` : `NEGATIVE`
- `symptomYesCount >= 7` : `POSITIVE_SCREEN`

### 경고 규칙
- `symptomYesCount >= 7` → `CAUTION`

### 권장 JSON 예시
```json
{
  "scaleCode": "KMDQ",
  "questionCount": 15,
  "scoring": {
    "primary": {
      "target": "symptomYesCount",
      "type": "COUNT_TRUE",
      "sourceQuestions": [
        "kmdq_symptom_1",
        "kmdq_symptom_2",
        "kmdq_symptom_3",
        "kmdq_symptom_4",
        "kmdq_symptom_5",
        "kmdq_symptom_6",
        "kmdq_symptom_7",
        "kmdq_symptom_8",
        "kmdq_symptom_9",
        "kmdq_symptom_10",
        "kmdq_symptom_11",
        "kmdq_symptom_12",
        "kmdq_symptom_13"
      ],
      "range": { "min": 0, "max": 13 }
    }
  },
  "screeningRules": [
    {
      "code": "KMDQ_MODIFIED_KOREAN",
      "condition": "symptomYesCount >= 7",
      "label": "양극성 장애 선별 양성 의심",
      "isDefault": true
    },
    {
      "code": "KMDQ_ORIGINAL_MDQ",
      "condition": "symptomYesCount >= 7 && answer(kmdq_same_period) == 'Y' && answer(kmdq_impairment) in ['MODERATE','SERIOUS']",
      "label": "원본 MDQ 기준 양성",
      "enabledByDefault": false
    }
  ],
  "interpretationRules": [
    { "condition": "symptomYesCount < 7", "code": "NEGATIVE", "label": "음성" },
    { "condition": "symptomYesCount >= 7", "code": "POSITIVE_SCREEN", "label": "양성 의심" }
  ],
  "alertRules": [
    { "code": "KMDQ_POSITIVE", "condition": "symptomYesCount >= 7", "alertType": "CAUTION", "message": "양극성 장애 선별 양성 의심" }
  ]
}
```

---

## 8.5 PSS-10

### 기본 정보
- `scaleCode`: `PSS10`
- `scaleName`: `PSS-10`
- `displayOrder`: `5`
- `questionCount`: `10`
- `responseWindow`: `LAST_MONTH`
- `optionSetRef`: `FREQ_5_LAST_MONTH`
- `scoreRange`: `0 ~ 40`

### 문항 키
- `pss10_q1` ~ `pss10_q10`

### 역채점 문항
- `pss10_q4`
- `pss10_q5`
- `pss10_q7`
- `pss10_q8`

### 점수 계산
- 역채점 규칙:
  - 원점수 0 → 4
  - 원점수 1 → 3
  - 원점수 2 → 2
  - 원점수 3 → 1
  - 원점수 4 → 0
- 나머지 문항은 원점수 그대로 사용
- 최종 점수는 10문항 합산

### 중요한 운영 결정
- 원 개발자 기준으로 **PSS는 진단 도구가 아니며 공식 절단점(cutoff)이 없다.**
- 따라서 본 시스템 기본값에서는 `resultLevel` 을 강제 단계화하지 않는다.
- 화면에 반드시 판정 텍스트가 필요하면 아래 중 하나를 사용한다.
  1. `공식 절단점 없음`
  2. `비교용 점수`
  3. `기관 내부 기준 미적용`

### 기본 경고 규칙
- 없음

### 선택 확장 규칙
- 추후 기관 내부 누적 데이터가 쌓이면 다음 중 하나를 별도 활성화할 수 있다.
  - 분위수(percentile) 기준
  - 내부 평균±표준편차 기준
  - 보고용 3단계 운영구간
- 단, 이는 **공식 판정이 아니라 기관 내부 운영구간**으로 명시해야 한다.

### 권장 JSON 예시
```json
{
  "scaleCode": "PSS10",
  "questionCount": 10,
  "reverseScoredQuestions": ["pss10_q4", "pss10_q5", "pss10_q7", "pss10_q8"],
  "scoring": {
    "type": "SUM_WITH_REVERSE",
    "range": { "min": 0, "max": 40 }
  },
  "interpretationRules": [
    {
      "condition": "true",
      "code": "NO_OFFICIAL_CUTOFF",
      "label": "공식 절단점 없음"
    }
  ],
  "screeningRules": [],
  "alertRules": []
}
```

---

## 8.6 ISI-K

### 기본 정보
- `scaleCode`: `ISIK`
- `scaleName`: `ISI-K`
- `displayOrder`: `6`
- `questionCount`: `7`
- `responseWindow`: `LAST_2_WEEKS`
- `scoreRange`: `0 ~ 28`

### 문항 키
- `isik_q1` ~ `isik_q7`

### 옵션 세트 적용 권장안
ISI는 모든 문항이 0~4점이지만, 질문 유형에 따라 라벨이 다르다.  
따라서 문항별 `optionSetRef` 를 분리하는 것을 권장한다.

예시:
- `ISI_SEVERITY_0_4` : q1~q3
- `ISI_SATISFACTION_0_4` : q4
- `ISI_NOTICEABILITY_0_4` : q5
- `ISI_INTERFERENCE_0_4` : q6
- `ISI_DISTRESS_0_4` : q7

### 점수 계산
- 7문항 합산
- 역채점 없음

### 해석 구간
- `0 ~ 7` : `NO_CLINICALLY_SIGNIFICANT`
- `8 ~ 14` : `SUBTHRESHOLD`
- `15 ~ 21` : `MODERATE`
- `22 ~ 28` : `SEVERE`

### 선별 규칙
- 한국판 검증 연구 최적 절단점 15.5를 반영하여 정수 운영 규칙은 `totalScore >= 16` 을 권장한다.
- 다만 임상적 해석 구간은 기존 ISI 분류 구간(15~21, 22~28)을 그대로 유지한다.

### 경고 규칙
- `totalScore >= 16` → `CAUTION`
- `totalScore >= 22` → `HIGH_RISK`

### 권장 JSON 예시
```json
{
  "scaleCode": "ISIK",
  "questionCount": 7,
  "scoring": {
    "type": "SUM",
    "range": { "min": 0, "max": 28 }
  },
  "interpretationRules": [
    { "min": 0, "max": 7, "code": "NO_CLINICALLY_SIGNIFICANT", "label": "임상적으로 유의한 불면 없음" },
    { "min": 8, "max": 14, "code": "SUBTHRESHOLD", "label": "역치하 불면" },
    { "min": 15, "max": 21, "code": "MODERATE", "label": "중등도 불면" },
    { "min": 22, "max": 28, "code": "SEVERE", "label": "중증 불면" }
  ],
  "screeningRules": [
    { "code": "ISIK_SCREEN_16", "condition": "totalScore >= 16", "label": "임상적 불면 추가 평가 권고" }
  ],
  "alertRules": [
    { "code": "ISIK_TOTAL_16", "condition": "totalScore >= 16", "alertType": "CAUTION", "message": "임상적 불면 추가 평가 권고" },
    { "code": "ISIK_TOTAL_22", "condition": "totalScore >= 22", "alertType": "HIGH_RISK", "message": "불면 중증 수준" }
  ]
}
```

---

## 8.7 AUDIT-K

### 기본 정보
- `scaleCode`: `AUDITK`
- `scaleName`: `AUDIT-K`
- `displayOrder`: `7`
- `questionCount`: `10`
- `responseWindow`: `PAST_YEAR`
- `scoreRange`: `0 ~ 40`

### 문항 키
- `auditk_q1` ~ `auditk_q10`

### 옵션 세트 적용 권장안
- `auditk_q1` ~ `auditk_q8` : 0~4점 체계
- `auditk_q9`, `auditk_q10` : `AUDIT_Q9_Q10`

### 점수 계산
- 10문항 점수 합산
- 역채점 없음

### 해석 구간(WHO 운영 권장안)
- `0 ~ 7` : `LOW_RISK`
- `8 ~ 15` : `HAZARDOUS`
- `16 ~ 19` : `HARMFUL`
- `20 ~ 40` : `POSSIBLE_DEPENDENCE`

### 기본 선별 규칙
- `totalScore >= 8` → `SCREEN_POSITIVE`

### 기본 경고 규칙
- `totalScore >= 16` → `CAUTION`
- `totalScore >= 20` → `HIGH_RISK`
- `q4, q5, q6 중 하나라도 >= 2` → `DEPENDENCE_SYMPTOM_ALERT`
- `q9 또는 q10 == 4` → `HARM_CONSEQUENCE_ALERT`

### 한국 수정판(AUDIT-KR) 관련 운영 메모
- 한국 수정판 문항을 실제로 채택하는 경우, 별도 보조 플래그를 둘 수 있다.
- 예시:
  - 남성 `>= 10`
  - 여성 `>= 5`
- 단, 이 규칙은 **문항 문구와 표준잔 기준이 AUDIT-KR과 일치할 때만** 활성화하는 것을 권장한다.
- 기본값은 WHO AUDIT 총점 운영 규칙으로 둔다.

### 권장 JSON 예시
```json
{
  "scaleCode": "AUDITK",
  "questionCount": 10,
  "scoring": {
    "type": "SUM",
    "range": { "min": 0, "max": 40 }
  },
  "interpretationRules": [
    { "min": 0, "max": 7, "code": "LOW_RISK", "label": "저위험" },
    { "min": 8, "max": 15, "code": "HAZARDOUS", "label": "위험 음주" },
    { "min": 16, "max": 19, "code": "HARMFUL", "label": "해로운 음주" },
    { "min": 20, "max": 40, "code": "POSSIBLE_DEPENDENCE", "label": "알코올 의존 의심" }
  ],
  "screeningRules": [
    { "code": "AUDITK_SCREEN_8", "condition": "totalScore >= 8", "label": "위험 음주 추가 평가 권고" }
  ],
  "alertRules": [
    { "code": "AUDITK_TOTAL_16", "condition": "totalScore >= 16", "alertType": "CAUTION", "message": "해로운 음주 수준 가능성" },
    { "code": "AUDITK_TOTAL_20", "condition": "totalScore >= 20", "alertType": "HIGH_RISK", "message": "알코올 의존 가능성 높음" },
    { "code": "AUDITK_DEPENDENCE_ITEMS", "condition": "answer(auditk_q4) >= 2 || answer(auditk_q5) >= 2 || answer(auditk_q6) >= 2", "alertType": "CAUTION", "message": "의존 증상 문항 주의" },
    { "code": "AUDITK_HARM_ITEMS", "condition": "answer(auditk_q9) == 4 || answer(auditk_q10) == 4", "alertType": "HIGH_RISK", "message": "음주 관련 해로운 결과 문항 주의" }
  ]
}
```

---

## 8.8 IES-R

### 기본 정보
- `scaleCode`: `IESR`
- `scaleName`: `IES-R`
- `displayOrder`: `8`
- `questionCount`: `22`
- `responseWindow`: `PAST_7_DAYS_WITH_RESPECT_TO_EVENT`
- `optionSetRef`: `LIKERT_0_TO_4_GENERIC`
- `scoreRange`: `0 ~ 88`

### 문항 키
- `iesr_q1` ~ `iesr_q22`

### 점수 계산
- 22문항 합산
- 역채점 없음

### 해석 구간(한국 운영 권장안)
- `0 ~ 17` : `NORMAL_RANGE`
- `18 ~ 24` : `AT_RISK`
- `25 ~ 88` : `HIGH_RISK`

### 경고 규칙
- `totalScore >= 18` → `CAUTION`
- `totalScore >= 25` → `HIGH_RISK`

### 하위요인(선택 구현)
하위요인 점수를 별도로 보고 싶으면 아래 그룹을 추가 저장할 수 있다.
- `INTRUSION`
- `AVOIDANCE`
- `HYPERAROUSAL`
- `SLEEP_NUMBNESS`

초기 버전에서는 총점만 구현해도 충분하다.

### 권장 JSON 예시
```json
{
  "scaleCode": "IESR",
  "questionCount": 22,
  "scoring": {
    "type": "SUM",
    "range": { "min": 0, "max": 88 }
  },
  "interpretationRules": [
    { "min": 0, "max": 17, "code": "NORMAL_RANGE", "label": "정상 범위" },
    { "min": 18, "max": 24, "code": "AT_RISK", "label": "주의 필요" },
    { "min": 25, "max": 88, "code": "HIGH_RISK", "label": "고위험 의심" }
  ],
  "screeningRules": [
    { "code": "IESR_SCREEN_18", "condition": "totalScore >= 18", "label": "외상후스트레스 추가 평가 권고" }
  ],
  "alertRules": [
    { "code": "IESR_TOTAL_18", "condition": "totalScore >= 18", "alertType": "CAUTION", "message": "외상후스트레스 주의 구간" },
    { "code": "IESR_TOTAL_25", "condition": "totalScore >= 25", "alertType": "HIGH_RISK", "message": "외상후스트레스 고위험 의심" }
  ]
}
```

---

## 9. scale-registry.json 권장 예시

```json
{
  "items": [
    { "scaleCode": "PHQ9", "scaleName": "PHQ-9", "displayOrder": 1, "isActive": true },
    { "scaleCode": "GAD7", "scaleName": "GAD-7", "displayOrder": 2, "isActive": true },
    { "scaleCode": "MKPQ16", "scaleName": "mKPQ-16", "displayOrder": 3, "isActive": true },
    { "scaleCode": "KMDQ", "scaleName": "K-MDQ", "displayOrder": 4, "isActive": true },
    { "scaleCode": "PSS10", "scaleName": "PSS-10", "displayOrder": 5, "isActive": true },
    { "scaleCode": "ISIK", "scaleName": "ISI-K", "displayOrder": 6, "isActive": true },
    { "scaleCode": "AUDITK", "scaleName": "AUDIT-K", "displayOrder": 7, "isActive": true },
    { "scaleCode": "IESR", "scaleName": "IES-R", "displayOrder": 8, "isActive": true }
  ]
}
```

---

## 10. 서버 계산 의사코드 권장안

```text
1. scaleCode로 척도 정의 JSON 조회
2. 요청 본문 answers 유효성 검사
3. 필수 문항 누락 여부 검사
4. 문항별 점수 계산
5. totalScore / subScore / derivedFlag 계산
6. interpretationRules 순회 → resultLevel 결정
7. screeningRules 순회 → screenFlag 배열 생성
8. alertRules 순회 → alert 배열 생성
9. session_scales 저장
10. session_answers 저장
11. alert 존재 시 session_alerts 저장
12. raw_result_snapshot 저장
```

---

## 11. API / DB 연결 기준

## 11.1 `GET /api/v1/scales`
- `scale-registry.json` 기준으로 목록 반환

## 11.2 `GET /api/v1/scales/{scaleCode}`
- 해당 척도 정의 JSON 반환
- 문항 텍스트는 `textAssetKey` 또는 실제 텍스트 포함 방식 중 택1

## 11.3 `POST /api/v1/assessment-sessions`
- 클라이언트는 원시 응답만 전송
- 서버는 척도 정의 JSON으로 재계산 후 DB 저장

## 11.4 `session_scales`
저장 권장 필드
- `scale_code`
- `scale_name`
- `display_order`
- `total_score`
- `result_level`
- `has_alert`
- `raw_result_snapshot`

## 11.5 `session_answers`
저장 권장 필드
- `question_no`
- `question_key`
- `answer_value`
- `score_value`
- `question_text_snapshot`
- `answer_label_snapshot`

---

## 12. 초기 버전 구현 우선순위

### 12.1 즉시 구현
- PHQ-9
- GAD-7
- PSS-10
- ISI-K
- AUDIT-K
- IES-R
- K-MDQ
- mKPQ-16

### 12.2 즉시 구현 규칙
- 총점 계산
- 해석 구간 계산
- 선별 플래그 계산
- 경고 생성
- 결과 스냅샷 저장

### 12.3 2차 확장
- 하위요인 점수
- 기관 내부 운영구간
- PDF 출력용 문구 템플릿
- 다국어 텍스트 자산
- 버전별 이력 관리

---

## 13. 구현 시 주의사항

### 13.1 PSS-10
- 공식 절단점이 없으므로 임의의 고위험 판정 문구를 기본값으로 출력하지 않는다.

### 13.2 K-MDQ
- 원본 MDQ와 한국판 수정 기준이 다르므로 두 규칙을 섞지 않는다.
- 기본값은 한국판 검증 연구 기준(`symptomYesCount >= 7`)을 사용한다.

### 13.3 mKPQ-16
- 이름과 실제 문항 수가 다를 수 있으므로 `questionCount`를 코드에 하드코딩하지 않는다.
- 정의 파일 기준으로 동작하게 만든다.

### 13.4 AUDIT-K
- 실제 문항이 AUDIT-KR인지 WHO 원판 기반인지에 따라 화면 문구와 일부 절단점 운영이 달라질 수 있다.
- 기본 구현은 WHO 총점 해석 기준으로 두고, 한국 수정판 규칙은 선택 기능으로 분리한다.

### 13.5 PHQ-9
- 9번 문항 경고는 총점과 별개로 독립적으로 처리해야 한다.
- 총점이 낮아도 9번 문항 응답이 있으면 경고를 띄워야 한다.

---

## 14. 초안 기준 최종 권장 사항

- 척도 정의는 DB가 아니라 JSON 파일로 관리한다.
- 서버가 최종 점수/판정/경고를 계산한다.
- 문항 텍스트는 전체 원문 복제가 아니라 `textAssetKey` 방식으로 관리한다.
- `resultLevel`, `screenFlag`, `alert`를 분리 저장한다.
- PHQ-9, GAD-7, ISI-K, AUDIT-K, IES-R은 구간 기반 판정을 사용한다.
- K-MDQ, mKPQ-16은 **양성/음성 선별 중심**으로 처리한다.
- 현재 v1 범위에서 mKPQ-16은 `Y/N` 단일 응답만 사용하고 distress 보조 입력은 사용하지 않는다.
- PSS-10은 공식 절단점이 없으므로 기본값에서는 점수만 해석하고 경고를 생성하지 않는다.
- PHQ-9 9번 문항은 별도 고위험 경고로 처리한다.
- AUDIT-K 4~6번, 9~10번 문항은 총점 외 보조 경고 규칙을 둔다.
- 세션 저장 시 척도 버전과 결과 스냅샷을 함께 저장한다.

---

## 15. 연계 문서

현재 저장소에서 본 문서와 직접 연결되는 문서는 아래와 같다.

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
13. `12-release-readiness.md`
14. `13-pre-deploy-runbook.md`
15. `14-deploy-result-template.md`
16. `15-go-live-checklist.md`

본 문서를 바탕으로 구현/검증을 진행할 때는 아래 순서를 참고할 수 있다.

1. `scale-registry.json`
2. `common option-sets.json`
3. 8개 척도 개별 JSON 파일 초안
4. 서버 계산 모듈 구현
5. 프론트 입력 UI 연결
6. 테스트 케이스 작성

---

## 16. 결정사항 요약

- 척도 정의 원본은 JSON 파일이다.
- 서버가 최종 계산한다.
- 문항 텍스트는 별도 텍스트 자산 방식으로 관리한다.
- PHQ-9는 총점 구간 + 9번 문항 경고를 사용한다.
- GAD-7은 총점 구간 + 10점 이상 추가 평가 권고를 사용한다.
- mKPQ-16은 19문항 구조와 양성/음성 선별 중심으로 설계한다.
- 현재 v1 API에서는 mKPQ-16을 `Y/N` 단일값 구조로 저장하고, distress 보조 입력은 확장 항목으로 분리한다.
- K-MDQ는 한국판 기준으로 증상 13문항 yes 개수 7 이상을 기본 양성 기준으로 사용한다.
- PSS-10은 공식 절단점이 없으므로 기본값에서는 점수 비교용으로만 사용한다.
- ISI-K는 총점 구간을 사용하고 운영상 16점 이상을 추가 평가 권고 기준으로 둔다.
- AUDIT-K는 WHO 총점 구간을 기본으로 하고 보조 문항 경고를 함께 사용한다.
- IES-R은 18점 이상 주의, 25점 이상 고위험 의심 기준을 사용한다.
