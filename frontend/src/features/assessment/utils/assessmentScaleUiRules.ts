import type { ScaleDetail } from '../api/assessmentApi'
import {
  calculateKmdqPreviewTotalScore,
  getKmdqRenderableQuestions,
  getKmdqRequiredQuestions,
  KMDQ_SCALE_CODE,
} from './kmdq'

const CRI_SCALE_CODE = 'CRI'
const IESR_SCALE_CODE = 'IESR'

type AssessmentScaleAnswers = Record<number, string>
type AssessmentScaleQuestion = ScaleDetail['questions'][number]
type AssessmentScaleFormNotice = Readonly<{
  title: string
  description: string
}>
type AssessmentScaleUiRule = {
  getRenderableQuestions?: (
    scale: ScaleDetail,
    answers: AssessmentScaleAnswers,
  ) => ScaleDetail['questions']
  getRequiredQuestions?: (
    scale: ScaleDetail,
    answers: AssessmentScaleAnswers,
  ) => ScaleDetail['questions']
  calculatePreviewTotalScore?: (
    scale: ScaleDetail,
    answers: AssessmentScaleAnswers,
  ) => number
  getPreviewResultLevel?: (
    totalScore: number,
    scale?: ScaleDetail,
  ) => string | null
  getPreviewAlertMessages?: (
    totalScore: number,
    scale?: ScaleDetail,
  ) => string[] | null
  formNotice?: AssessmentScaleFormNotice
}

const IESR_FORM_NOTICE: AssessmentScaleFormNotice = {
  title: '기간 안내',
  description:
    'IES-R는 "지난 일주일 동안" 어떠셨는지를 기준으로 응답합니다.',
}

const assessmentScaleUiRules: Partial<Record<string, AssessmentScaleUiRule>> = {
  [CRI_SCALE_CODE]: {},
  [IESR_SCALE_CODE]: {
    formNotice: IESR_FORM_NOTICE,
    getPreviewAlertMessages: getIesrPreviewAlertMessagesFromMetadata,
    getPreviewResultLevel: getIesrPreviewResultLevelFromMetadata,
  },
  [KMDQ_SCALE_CODE]: {
    calculatePreviewTotalScore: calculateKmdqPreviewTotalScore,
    getRenderableQuestions: getKmdqRenderableQuestions,
    getRequiredQuestions: getKmdqRequiredQuestions,
  },
}

function getAssessmentScaleUiRule(scaleCode: string) {
  return assessmentScaleUiRules[scaleCode]
}

function hasAnsweredValue(value: string | undefined) {
  return typeof value === 'string' && value.length > 0
}

function getAppliedOptionScore(
  question: AssessmentScaleQuestion,
  answerValue: string | undefined,
) {
  const option = question.options.find(
    (candidate) => candidate.value === answerValue,
  )

  if (!option) {
    return null
  }

  const maxScore = Math.max(
    ...question.options.map((candidate) => candidate.score),
  )
  const minScore = Math.min(
    ...question.options.map((candidate) => candidate.score),
  )

  return question.reverseScored
    ? minScore + maxScore - option.score
    : option.score
}

function calculateDefaultPreviewTotalScore(
  scale: ScaleDetail,
  answers: AssessmentScaleAnswers,
) {
  return scale.questions.reduce((accumulator, question) => {
    const appliedScore = getAppliedOptionScore(
      question,
      answers[question.questionNo],
    )

    return appliedScore === null ? accumulator : accumulator + appliedScore
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

function getIesrPreviewResultLevelFromMetadata(
  totalScore: number,
  scale?: ScaleDetail,
) {
  return getMatchedIesrInterpretationRule(totalScore, scale)?.label ?? null
}

function getIesrPreviewAlertMessagesFromMetadata(
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

export function getAssessmentRenderableQuestions(
  scale: ScaleDetail,
  answers: AssessmentScaleAnswers,
) {
  return (
    getAssessmentScaleUiRule(scale.scaleCode)?.getRenderableQuestions?.(
      scale,
      answers,
    ) ?? scale.questions
  )
}

export function getAssessmentRequiredQuestions(
  scale: ScaleDetail,
  answers: AssessmentScaleAnswers,
) {
  return (
    getAssessmentScaleUiRule(scale.scaleCode)?.getRequiredQuestions?.(
      scale,
      answers,
    ) ?? scale.questions
  )
}

export function countAnsweredQuestions(
  questions: ScaleDetail['questions'],
  answers: AssessmentScaleAnswers,
) {
  return questions.filter((question) =>
    hasAnsweredValue(answers[question.questionNo]),
  ).length
}

export function calculateAssessmentScalePreviewTotalScore(
  scale: ScaleDetail | undefined,
  answers: AssessmentScaleAnswers,
) {
  if (!scale) {
    return 0
  }

  return (
    getAssessmentScaleUiRule(scale.scaleCode)?.calculatePreviewTotalScore?.(
      scale,
      answers,
    ) ?? calculateDefaultPreviewTotalScore(scale, answers)
  )
}

export function canPreviewAssessmentScaleResult(scale: ScaleDetail | undefined) {
  return Boolean(
    scale && getAssessmentScaleUiRule(scale.scaleCode)?.getPreviewResultLevel,
  )
}

export function canPreviewAssessmentScaleAlert(scale: ScaleDetail | undefined) {
  return Boolean(
    scale &&
      getAssessmentScaleUiRule(scale.scaleCode)?.getPreviewAlertMessages,
  )
}

export function getAssessmentPreviewResultLevel(
  totalScore: number,
  scale?: ScaleDetail,
) {
  if (!scale) {
    return null
  }

  return (
    getAssessmentScaleUiRule(scale.scaleCode)?.getPreviewResultLevel?.(
      totalScore,
      scale,
    ) ?? null
  )
}

export function getAssessmentPreviewAlertMessages(
  totalScore: number,
  scale?: ScaleDetail,
) {
  if (!scale) {
    return null
  }

  return (
    getAssessmentScaleUiRule(scale.scaleCode)?.getPreviewAlertMessages?.(
      totalScore,
      scale,
    ) ?? null
  )
}

export function getAssessmentScaleFormNotice(scaleCode: string | undefined) {
  if (!scaleCode) {
    return null
  }

  return getAssessmentScaleUiRule(scaleCode)?.formNotice ?? null
}
