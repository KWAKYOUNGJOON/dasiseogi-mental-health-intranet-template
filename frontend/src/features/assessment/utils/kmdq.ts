import type { ScaleDetail } from '../api/assessmentApi'

const KMDQ_SCALE_CODE = 'KMDQ'
const KMDQ_SYMPTOM_QUESTION_END_NO = 13
const KMDQ_SAME_PERIOD_QUESTION_NO = 14
const KMDQ_IMPAIRMENT_QUESTION_NO = 15
const IESR_NORMAL_MAX_SCORE = 24
const IESR_MILD_IMPACT_MAX_SCORE = 39
const IESR_SEVERE_IMPACT_MAX_SCORE = 59

function isKmdq(scale: ScaleDetail) {
  return scale.scaleCode === KMDQ_SCALE_CODE
}

function hasAnsweredValue(value: string | undefined) {
  return typeof value === 'string' && value.length > 0
}

function calculateKmdqSymptomYesCount(scale: ScaleDetail, answers: Record<number, string>) {
  return scale.questions.reduce((count, question) => {
    if (question.questionNo > KMDQ_SYMPTOM_QUESTION_END_NO) {
      return count
    }

    const selectedValue = answers[question.questionNo]
    const selectedOption = question.options.find((option) => option.value === selectedValue)

    return count + (selectedOption?.score ?? 0)
  }, 0)
}

export function getRenderableQuestions(scale: ScaleDetail, answers: Record<number, string>) {
  if (!isKmdq(scale)) {
    return scale.questions
  }

  const symptomYesCount = calculateKmdqSymptomYesCount(scale, answers)

  return scale.questions.filter((question) => {
    if (question.questionNo <= KMDQ_SYMPTOM_QUESTION_END_NO) {
      return true
    }

    if (question.questionNo === KMDQ_SAME_PERIOD_QUESTION_NO) {
      return symptomYesCount >= 2
    }

    if (question.questionNo === KMDQ_IMPAIRMENT_QUESTION_NO) {
      return symptomYesCount >= 1
    }

    return true
  })
}

export function getRequiredQuestions(scale: ScaleDetail, answers: Record<number, string>) {
  if (!isKmdq(scale)) {
    return scale.questions
  }

  const symptomYesCount = calculateKmdqSymptomYesCount(scale, answers)

  return scale.questions.filter((question) => {
    if (question.questionNo <= KMDQ_SYMPTOM_QUESTION_END_NO) {
      return true
    }

    if (question.questionNo === KMDQ_SAME_PERIOD_QUESTION_NO) {
      return symptomYesCount >= 2
    }

    return false
  })
}

export function countAnsweredQuestions(questions: ScaleDetail['questions'], answers: Record<number, string>) {
  return questions.filter((question) => hasAnsweredValue(answers[question.questionNo])).length
}

export function calculateScalePreviewTotalScore(scale: ScaleDetail | undefined, answers: Record<number, string>) {
  if (!scale) {
    return 0
  }

  return scale.questions.reduce((accumulator, question) => {
    if (isKmdq(scale) && question.questionNo > KMDQ_SYMPTOM_QUESTION_END_NO) {
      return accumulator
    }

    const selectedValue = answers[question.questionNo]
    const option = question.options.find((candidate) => candidate.value === selectedValue)

    if (!option) {
      return accumulator
    }

    const maxScore = Math.max(...question.options.map((candidate) => candidate.score))
    const minScore = Math.min(...question.options.map((candidate) => candidate.score))
    const appliedScore = question.reverseScored ? minScore + maxScore - option.score : option.score

    return accumulator + appliedScore
  }, 0)
}

export function getIesrPreviewResultLevel(totalScore: number) {
  if (totalScore <= IESR_NORMAL_MAX_SCORE) {
    return '정상'
  }

  if (totalScore <= IESR_MILD_IMPACT_MAX_SCORE) {
    return '약간 충격'
  }

  if (totalScore <= IESR_SEVERE_IMPACT_MAX_SCORE) {
    return '심한 충격'
  }

  return '매우 심한 충격'
}

export function getIesrPreviewAlertMessages(totalScore: number) {
  const messages: string[] = []

  if (totalScore >= 18) {
    messages.push('주의 필요')
  }

  if (totalScore >= 25) {
    messages.push('상담 권고 또는 고위험 경고')
  }

  return messages
}
