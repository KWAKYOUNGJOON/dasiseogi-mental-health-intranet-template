import type { ScaleDetail } from '../api/assessmentApi'

type ScaleQuestion = ScaleDetail['questions'][number]

function getKmdqUiMetadata(scale: ScaleDetail) {
  return scale.metadata?.ui?.kmdq ?? null
}

export function hasKmdqUiRules(scale: ScaleDetail) {
  return getKmdqUiMetadata(scale) !== null
}

function isKmdq(scale: ScaleDetail) {
  return hasKmdqUiRules(scale)
}

function getKmdqImpairmentQuestionNo(scale: ScaleDetail) {
  return getKmdqUiMetadata(scale)?.impairmentQuestionNo
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

    if (question.questionNo === getKmdqImpairmentQuestionNo(scale)) {
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
