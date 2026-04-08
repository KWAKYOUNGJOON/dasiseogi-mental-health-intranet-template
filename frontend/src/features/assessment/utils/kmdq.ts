import type { ScaleDetail } from '../api/assessmentApi'

export const KMDQ_SCALE_CODE = 'KMDQ'
const KMDQ_IMPAIRMENT_QUESTION_NO = 15

type ScaleQuestion = ScaleDetail['questions'][number]

function isKmdq(scale: ScaleDetail) {
  return scale.scaleCode === KMDQ_SCALE_CODE
}

function calculateQuestionAnswerScore(
  question: ScaleQuestion,
  answers: Record<number, string>,
) {
  const selectedValue = answers[question.questionNo]
  const selectedOption = question.options.find(
    (option) => option.value === selectedValue,
  )

  return selectedOption?.score ?? 0
}

function isKmdqBaseRequiredQuestion(question: ScaleQuestion) {
  return question.options.some((option) => option.score !== 0)
}

function calculateKmdqSymptomYesCount(
  scale: ScaleDetail,
  answers: Record<number, string>,
) {
  return scale.questions.reduce((count, question) => {
    if (!isKmdqBaseRequiredQuestion(question)) {
      return count
    }

    return count + calculateQuestionAnswerScore(question, answers)
  }, 0)
}

function isConditionalQuestionActive(
  scale: ScaleDetail,
  question: ScaleQuestion,
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

export function getKmdqRenderableQuestions(
  scale: ScaleDetail,
  answers: Record<number, string>,
) {
  if (!isKmdq(scale)) {
    return scale.questions
  }

  const symptomYesCount = calculateKmdqSymptomYesCount(scale, answers)

  return scale.questions.filter((question) => {
    if (isKmdqBaseRequiredQuestion(question)) {
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

export function getKmdqRequiredQuestions(
  scale: ScaleDetail,
  answers: Record<number, string>,
) {
  if (!isKmdq(scale)) {
    return scale.questions
  }

  return scale.questions.filter((question) => {
    if (isKmdqBaseRequiredQuestion(question)) {
      return true
    }

    if (question.conditionalRequired) {
      return isConditionalQuestionActive(scale, question, answers)
    }

    return false
  })
}

export function calculateKmdqPreviewTotalScore(
  scale: ScaleDetail,
  answers: Record<number, string>,
) {
  if (!isKmdq(scale)) {
    return 0
  }

  return scale.questions.reduce((accumulator, question) => {
    if (!isKmdqBaseRequiredQuestion(question)) {
      return accumulator
    }

    return accumulator + calculateQuestionAnswerScore(question, answers)
  }, 0)
}
