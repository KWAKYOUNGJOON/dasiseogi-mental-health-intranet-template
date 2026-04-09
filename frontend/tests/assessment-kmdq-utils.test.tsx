import { describe, expect, it } from 'vitest'
import { type ScaleDetail } from '../src/features/assessment/api/assessmentApi'
import {
  calculateAssessmentScalePreviewTotalScore,
  canPreviewAssessmentScaleAlert,
  canPreviewAssessmentScaleResult,
  getAssessmentPreviewAlertMessages,
  getAssessmentPreviewResultLevel,
  getAssessmentRenderableQuestions,
  getAssessmentRequiredQuestions,
  getAssessmentScaleFormNotice,
} from '../src/features/assessment/utils/assessmentScaleUiRules'
import {
  calculateKmdqPreviewTotalScore,
  getKmdqRenderableQuestions,
  getKmdqRequiredQuestions,
} from '../src/features/assessment/utils/kmdq'

function createKmdqScaleDetail(): ScaleDetail {
  return {
    scaleCode: 'KMDQ',
    scaleName: 'K-MDQ',
    displayOrder: 4,
    questionCount: 15,
    screeningThreshold: 7,
    metadata: {
      ui: {
        kmdq: {
          impairmentQuestionNo: 15,
        },
      },
    },
    questions: [
      ...Array.from({ length: 13 }, (_, index) => ({
        questionNo: index + 1,
        questionKey: `kmdq_symptom_${index + 1}`,
        questionText: `증상 문항 ${index + 1}`,
        reverseScored: false,
        options: [
          { value: 'N', label: '아니오', score: 0 },
          { value: 'Y', label: '예', score: 1 },
        ],
      })),
      {
        questionNo: 14,
        questionKey: 'kmdq_same_period',
        questionText: '같은 시기에 벌어진 적이 있었습니까?',
        reverseScored: false,
        conditionalRequired: {
          sourceQuestionNos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
          minScoreSum: 2,
        },
        options: [
          { value: 'N', label: '아니오', score: 0 },
          { value: 'Y', label: '예', score: 0 },
        ],
      },
      {
        questionNo: 15,
        questionKey: 'kmdq_impairment',
        questionText: '이러한 일들로 인해서 문제가 발생했습니까?',
        reverseScored: false,
        options: [
          { value: 'NONE', label: '문제 없었다', score: 0 },
          { value: 'MINOR', label: '경미한 문제', score: 0 },
          { value: 'MODERATE', label: '중등도의 문제', score: 0 },
          { value: 'SERIOUS', label: '심각한 문제', score: 0 },
        ],
      },
    ],
  }
}

function createKmdqScaleDetailWithExtendedSymptomQuestion(): ScaleDetail {
  const scale = createKmdqScaleDetail()

  return {
    ...scale,
    questionCount: 16,
    questions: [
      ...scale.questions,
      {
        questionNo: 16,
        questionKey: 'kmdq_symptom_16',
        questionText: '증상 문항 16',
        reverseScored: false,
        options: [
          { value: 'N', label: '아니오', score: 0 },
          { value: 'Y', label: '예', score: 1 },
        ],
      },
    ],
  }
}

function createIesrScaleDetail(): ScaleDetail {
  const options = [
    { value: '0', label: '전혀 아니다', score: 0 },
    { value: '1', label: '약간 그렇다', score: 1 },
    { value: '2', label: '그런 편이다', score: 2 },
    { value: '3', label: '꽤 그렇다', score: 3 },
    { value: '4', label: '매우 그렇다', score: 4 },
  ]

  return {
    scaleCode: 'IESR',
    scaleName: 'IES-R',
    displayOrder: 8,
    questionCount: 22,
    screeningThreshold: 18,
    metadata: {
      ui: {
        formNotice: {
          title: '기간 안내',
          description:
            'IES-R는 "지난 일주일 동안" 어떠셨는지를 기준으로 응답합니다.',
        },
        preview: {
          showResultLevel: true,
          showAlertMessages: true,
        },
      },
    },
    interpretationRules: [
      { min: 0, max: 24, label: '정상' },
      { min: 25, max: 39, label: '약간 충격' },
      { min: 40, max: 59, label: '심한 충격' },
      { min: 60, max: 88, label: '매우 심한 충격' },
    ],
    alertRules: [
      { minTotalScore: 18, message: '주의 필요' },
      { minTotalScore: 25, message: '상담 권고 또는 고위험 경고' },
    ],
    questions: Array.from({ length: 22 }, (_, index) => ({
      questionNo: index + 1,
      questionKey: `iesr_q${index + 1}`,
      questionText: `IES-R 문항 ${index + 1}`,
      reverseScored: false,
      options,
    })),
  }
}

function createCriScaleDetail(): ScaleDetail {
  return {
    scaleCode: 'CRI',
    scaleName: '정신과적 위기 분류 평정척도 (CRI)',
    displayOrder: 9,
    questionCount: 23,
    screeningThreshold: null,
    metadata: {
      resultLevelLabels: {
        A: '극도의 위기',
        B: '위기',
        C: '고위험',
        D: '주의',
        E: '위기상황 아님',
      },
    },
    questions: Array.from({ length: 23 }, (_, index) => ({
      questionNo: index + 1,
      questionKey: `cri_q${index + 1}`,
      questionText: `CRI 문항 ${index + 1}`,
      reverseScored: false,
      options: [
        { value: '0', label: '없다', score: 0 },
        { value: '1', label: '있다', score: 1 },
      ],
    })),
  }
}

describe('K-MDQ UI rules', () => {
  it('renders question 14 when the conditionalRequired score threshold is met', () => {
    const scale = createKmdqScaleDetail()
    const answers = {
      1: 'Y',
      2: 'Y',
      3: 'N',
      4: 'N',
      5: 'N',
      6: 'N',
      7: 'N',
      8: 'N',
      9: 'N',
      10: 'N',
      11: 'N',
      12: 'N',
      13: 'N',
    }

    const renderableQuestions = getKmdqRenderableQuestions(scale, answers)

    expect(
      renderableQuestions.map((question) => question.questionNo),
    ).toContain(14)
    expect(
      getAssessmentRenderableQuestions(scale, answers).map(
        (question) => question.questionNo,
      ),
    ).toContain(14)
  })

  it('hides question 14 when the conditionalRequired score threshold is not met', () => {
    const scale = createKmdqScaleDetail()
    const answers = {
      1: 'Y',
      2: 'N',
      3: 'N',
      4: 'N',
      5: 'N',
      6: 'N',
      7: 'N',
      8: 'N',
      9: 'N',
      10: 'N',
      11: 'N',
      12: 'N',
      13: 'N',
    }

    const renderableQuestions = getKmdqRenderableQuestions(scale, answers)

    expect(
      renderableQuestions.map((question) => question.questionNo),
    ).not.toContain(14)
    expect(
      getAssessmentRenderableQuestions(scale, answers).map(
        (question) => question.questionNo,
      ),
    ).not.toContain(14)
  })

  it('marks question 14 as required only while the same metadata condition is active', () => {
    const scale = createKmdqScaleDetail()

    const requiredBeforeThreshold = getKmdqRequiredQuestions(scale, {
      1: 'Y',
      2: 'N',
      3: 'N',
      4: 'N',
      5: 'N',
      6: 'N',
      7: 'N',
      8: 'N',
      9: 'N',
      10: 'N',
      11: 'N',
      12: 'N',
      13: 'N',
    })
    const requiredAtThreshold = getKmdqRequiredQuestions(scale, {
      1: 'Y',
      2: 'Y',
      3: 'N',
      4: 'N',
      5: 'N',
      6: 'N',
      7: 'N',
      8: 'N',
      9: 'N',
      10: 'N',
      11: 'N',
      12: 'N',
      13: 'N',
    })

    expect(
      requiredBeforeThreshold.map((question) => question.questionNo),
    ).not.toContain(14)
    expect(
      requiredAtThreshold.map((question) => question.questionNo),
    ).toContain(14)
    expect(
      requiredAtThreshold.map((question) => question.questionNo),
    ).not.toContain(15)
    expect(
      getAssessmentRequiredQuestions(scale, {
        1: 'Y',
        2: 'Y',
        3: 'N',
        4: 'N',
        5: 'N',
        6: 'N',
        7: 'N',
        8: 'N',
        9: 'N',
        10: 'N',
        11: 'N',
        12: 'N',
        13: 'N',
      }).map((question) => question.questionNo),
    ).toContain(14)
  })

  it('shows question 15 when a score-bearing symptom question after question 13 is answered yes', () => {
    const scale = createKmdqScaleDetailWithExtendedSymptomQuestion()

    const renderableQuestions = getKmdqRenderableQuestions(scale, {
      16: 'Y',
    })

    expect(
      renderableQuestions.map((question) => question.questionNo),
    ).not.toContain(14)
    expect(
      renderableQuestions.map((question) => question.questionNo),
    ).toContain(15)
  })

  it('includes score-bearing questions after question 13 in the required question list', () => {
    const scale = createKmdqScaleDetailWithExtendedSymptomQuestion()

    const requiredQuestions = getKmdqRequiredQuestions(scale, {})

    expect(
      requiredQuestions.map((question) => question.questionNo),
    ).toContain(16)
    expect(
      requiredQuestions.map((question) => question.questionNo),
    ).not.toContain(15)
  })

  it('includes score-bearing questions after question 13 in the preview total score', () => {
    const scale = createKmdqScaleDetailWithExtendedSymptomQuestion()
    const answers = {
      1: 'Y',
      15: 'SERIOUS',
      16: 'Y',
    }

    expect(calculateKmdqPreviewTotalScore(scale, answers)).toBe(2)
    expect(calculateAssessmentScalePreviewTotalScore(scale, answers)).toBe(2)
  })

  it('stops applying K-MDQ conditional UI rules when the server omits the K-MDQ ui metadata block', () => {
    const scale = {
      ...createKmdqScaleDetail(),
      metadata: undefined,
    }

    expect(
      getAssessmentRenderableQuestions(scale, {
        1: 'Y',
      }).map((question) => question.questionNo),
    ).toContain(14)
    expect(
      getAssessmentRenderableQuestions(scale, {
        1: 'Y',
      }).map((question) => question.questionNo),
    ).toContain(15)
  })
})

describe('IES-R preview metadata handling', () => {
  it('uses server metadata to enable shared preview and form guidance helpers only for supported scales', () => {
    const iesrScale = createIesrScaleDetail()
    const genericScale = createKmdqScaleDetail()
    const criScale = createCriScaleDetail()

    expect(canPreviewAssessmentScaleResult(iesrScale)).toBe(true)
    expect(canPreviewAssessmentScaleAlert(iesrScale)).toBe(true)
    expect(getAssessmentScaleFormNotice(iesrScale)).toEqual({
      title: '기간 안내',
      description:
        'IES-R는 "지난 일주일 동안" 어떠셨는지를 기준으로 응답합니다.',
    })

    expect(canPreviewAssessmentScaleResult(genericScale)).toBe(false)
    expect(canPreviewAssessmentScaleAlert(genericScale)).toBe(false)
    expect(getAssessmentScaleFormNotice(genericScale)).toBeNull()

    expect(canPreviewAssessmentScaleResult(criScale)).toBe(false)
    expect(canPreviewAssessmentScaleAlert(criScale)).toBe(false)
    expect(getAssessmentScaleFormNotice(criScale)).toBeNull()
  })

  it('stops exposing IES-R preview helpers when the server omits the preview metadata block', () => {
    const scale = {
      ...createIesrScaleDetail(),
      metadata: undefined,
    }

    expect(canPreviewAssessmentScaleResult(scale)).toBe(false)
    expect(canPreviewAssessmentScaleAlert(scale)).toBe(false)
    expect(getAssessmentScaleFormNotice(scale)).toBeNull()
    expect(getAssessmentPreviewResultLevel(25, scale)).toBeNull()
    expect(getAssessmentPreviewAlertMessages(25, scale)).toBeNull()
  })

  it('shows the metadata-based result level and caution message at total score 18', () => {
    const scale = createIesrScaleDetail()

    expect(getAssessmentPreviewResultLevel(18, scale)).toBe('정상')
    expect(getAssessmentPreviewAlertMessages(18, scale)).toEqual(['주의 필요'])
  })

  it('adds the second alert message when the total score is 25 or higher', () => {
    const scale = createIesrScaleDetail()

    expect(getAssessmentPreviewResultLevel(25, scale)).toBe('약간 충격')
    expect(getAssessmentPreviewAlertMessages(25, scale)).toEqual([
      '주의 필요',
      '상담 권고 또는 고위험 경고',
    ])
  })
})
