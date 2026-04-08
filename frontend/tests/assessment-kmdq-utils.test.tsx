import { describe, expect, it } from 'vitest'
import { type ScaleDetail } from '../src/features/assessment/api/assessmentApi'
import { getRenderableQuestions, getRequiredQuestions } from '../src/features/assessment/utils/kmdq'

function createKmdqScaleDetail(): ScaleDetail {
  return {
    scaleCode: 'KMDQ',
    scaleName: 'K-MDQ',
    displayOrder: 4,
    questionCount: 15,
    screeningThreshold: 7,
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

describe('kmdq metadata-driven conditional question handling', () => {
  it('renders question 14 when the conditionalRequired score threshold is met', () => {
    const scale = createKmdqScaleDetail()

    const renderableQuestions = getRenderableQuestions(scale, {
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

    expect(renderableQuestions.map((question) => question.questionNo)).toContain(14)
  })

  it('hides question 14 when the conditionalRequired score threshold is not met', () => {
    const scale = createKmdqScaleDetail()

    const renderableQuestions = getRenderableQuestions(scale, {
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

    expect(renderableQuestions.map((question) => question.questionNo)).not.toContain(14)
  })

  it('marks question 14 as required only while the same metadata condition is active', () => {
    const scale = createKmdqScaleDetail()

    const requiredBeforeThreshold = getRequiredQuestions(scale, {
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
    const requiredAtThreshold = getRequiredQuestions(scale, {
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

    expect(requiredBeforeThreshold.map((question) => question.questionNo)).not.toContain(14)
    expect(requiredAtThreshold.map((question) => question.questionNo)).toContain(14)
    expect(requiredAtThreshold.map((question) => question.questionNo)).not.toContain(15)
  })
})
