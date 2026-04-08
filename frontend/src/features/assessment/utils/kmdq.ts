import type { ScaleDetail } from '../api/assessmentApi'

const KMDQ_SCALE_CODE = 'KMDQ'
const KMDQ_SYMPTOM_QUESTION_END_NO = 13
const KMDQ_IMPAIRMENT_QUESTION_NO = 15

function isKmdq(scale: ScaleDetail) {
  return scale.scaleCode === KMDQ_SCALE_CODE
}

function hasAnsweredValue(value: string | undefined) {
  return typeof value === 'string' && value.length > 0
}

function calculateQuestionAnswerScore(
  question: ScaleDetail['questions'][number],
  answers: Record<number, string>,
) {
  const selectedValue = answers[question.questionNo]
  const selectedOption = question.options.find(
    (option) => option.value === selectedValue,
  )

  return selectedOption?.score ?? 0
}

function calculateKmdqSymptomYesCount(
  scale: ScaleDetail,
  answers: Record<number, string>,
) {
  return scale.questions.reduce((count, question) => {
    if (question.questionNo > KMDQ_SYMPTOM_QUESTION_END_NO) {
      return count
    }

    return count + calculateQuestionAnswerScore(question, answers)
  }, 0)
}

function isConditionalQuestionActive(
  scale: ScaleDetail,
  question: ScaleDetail['questions'][number],
  answers: Record<number, string>,
) {
  const conditionalRequired = question.conditionalRequired

  if (!conditionalRequired) {
    return true
  }

  const scoreSum = conditionalRequired.sourceQuestionNos.reduce(
    (total, sourceQuestionNo) => {
      const sourceQuestion = scale.questions.find(
        (candidate) => candidate.questionNo === sourceQuestionNo,
      )

      if (!sourceQuestion) {
        return total
      }

      return total + calculateQuestionAnswerScore(sourceQuestion, answers)
    },
    0,
  )

  return scoreSum >= conditionalRequired.minScoreSum
}

export function getRenderableQuestions(
  scale: ScaleDetail,
  answers: Record<number, string>,
) {
  if (!isKmdq(scale)) {
    return scale.questions
  }

  const symptomYesCount = calculateKmdqSymptomYesCount(scale, answers)

  return scale.questions.filter((question) => {
    if (question.questionNo <= KMDQ_SYMPTOM_QUESTION_END_NO) {
      return true
    }

    if (question.conditionalRequired) {
      return isConditionalQuestionActive(scale, question, answers)
    }

    if (question.questionNo === KMDQ_IMPAIRMENT_QUESTION_NO) {
      return symptomYesCount >= 1
    }

    return true
  })
}

export function getRequiredQuestions(
  scale: ScaleDetail,
  answers: Record<number, string>,
) {
  if (!isKmdq(scale)) {
    return scale.questions
  }

  return scale.questions.filter((question) => {
    if (question.questionNo <= KMDQ_SYMPTOM_QUESTION_END_NO) {
      return true
    }

    if (question.conditionalRequired) {
      return isConditionalQuestionActive(scale, question, answers)
    }

    return false
  })
}

export function countAnsweredQuestions(
  questions: ScaleDetail['questions'],
  answers: Record<number, string>,
) {
  return questions.filter((question) =>
    hasAnsweredValue(answers[question.questionNo]),
  ).length
}

export function calculateScalePreviewTotalScore(
  scale: ScaleDetail | undefined,
  answers: Record<number, string>,
) {
  if (!scale) {
    return 0
  }

  return scale.questions.reduce((accumulator, question) => {
    if (isKmdq(scale) && question.questionNo > KMDQ_SYMPTOM_QUESTION_END_NO) {
      return accumulator
    }

    const selectedValue = answers[question.questionNo]
    const option = question.options.find(
      (candidate) => candidate.value === selectedValue,
    )

    if (!option) {
      return accumulator
    }

    const maxScore = Math.max(
      ...question.options.map((candidate) => candidate.score),
    )
    const minScore = Math.min(
      ...question.options.map((candidate) => candidate.score),
    )
    const appliedScore = question.reverseScored
      ? minScore + maxScore - option.score
      : option.score

    return accumulator + appliedScore
  }, 0)
}

function getMatchedIesrInterpretationRule(
  totalScore: number,
  scale?: ScaleDetail,
) {
  if (!scale?.interpretationRules || scale.interpretationRules.length === 0) {
    return null
  }

  return (
    scale.interpretationRules.find(
      (rule) => totalScore >= rule.min && totalScore <= rule.max,
    ) ?? null
  )
}

export function getIesrPreviewResultLevel(
  totalScore: number,
  scale?: ScaleDetail,
) {
  return getMatchedIesrInterpretationRule(totalScore, scale)?.label ?? null
}

export function getIesrPreviewAlertMessages(
  totalScore: number,
  scale?: ScaleDetail,
) {
  if (!scale?.alertRules || scale.alertRules.length === 0) {
    return null
  }

  return scale.alertRules
    .filter(
      (rule) =>
        typeof rule.minTotalScore === 'number' &&
        totalScore >= rule.minTotalScore,
    )
    .sort(
      (left, right) => (left.minTotalScore ?? 0) - (right.minTotalScore ?? 0),
    )
    .map((rule) => rule.message)
}
