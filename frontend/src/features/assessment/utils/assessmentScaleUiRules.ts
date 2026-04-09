import type { ScaleDetail } from '../api/assessmentApi'
import {
  calculateKmdqPreviewTotalScore,
  getKmdqRenderableQuestions,
  getKmdqRequiredQuestions,
  hasKmdqUiRules,
} from './kmdq'

const IESR_SCALE_CODE = 'IESR'

type AssessmentScaleAnswers = Record<number, string>
type AssessmentScaleQuestion = ScaleDetail['questions'][number]
type AssessmentScaleFormNotice = Readonly<{
  title: string
  description: string
}>
type AssessmentScalePreviewUi = Readonly<{
  showResultLevel?: boolean
  showAlertMessages?: boolean
}>

const FALLBACK_IESR_FORM_NOTICE: AssessmentScaleFormNotice = {
  title: '기간 안내',
  description:
    'IES-R는 "지난 일주일 동안" 어떠셨는지를 기준으로 응답합니다.',
}

const FALLBACK_IESR_PREVIEW_UI: AssessmentScalePreviewUi = {
  showResultLevel: true,
  showAlertMessages: true,
}

function getAssessmentScaleFormNoticeFromMetadata(scale?: ScaleDetail) {
  return scale?.metadata?.ui?.formNotice ?? null
}

function getFallbackAssessmentScaleFormNotice(scale?: ScaleDetail) {
  if (scale?.scaleCode !== IESR_SCALE_CODE) {
    return null
  }

  return FALLBACK_IESR_FORM_NOTICE
}

function getResolvedAssessmentScaleFormNotice(scale?: ScaleDetail) {
  return (
    getAssessmentScaleFormNoticeFromMetadata(scale) ??
    getFallbackAssessmentScaleFormNotice(scale)
  )
}

function getResolvedAssessmentScalePreviewUi(
  scale?: ScaleDetail,
): AssessmentScalePreviewUi | null {
  if (scale?.metadata?.ui?.preview) {
    return scale.metadata.ui.preview
  }

  if (scale?.scaleCode === IESR_SCALE_CODE) {
    return FALLBACK_IESR_PREVIEW_UI
  }

  return null
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

function getMatchedInterpretationRule(
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

function getPreviewResultLevelFromMetadata(
  totalScore: number,
  scale?: ScaleDetail,
) {
  return getMatchedInterpretationRule(totalScore, scale)?.label ?? null
}

function getPreviewAlertMessagesFromMetadata(
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
  return hasKmdqUiRules(scale)
    ? getKmdqRenderableQuestions(scale, answers)
    : scale.questions
}

export function getAssessmentRequiredQuestions(
  scale: ScaleDetail,
  answers: AssessmentScaleAnswers,
) {
  return hasKmdqUiRules(scale)
    ? getKmdqRequiredQuestions(scale, answers)
    : scale.questions
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

  return hasKmdqUiRules(scale)
    ? calculateKmdqPreviewTotalScore(scale, answers)
    : calculateDefaultPreviewTotalScore(scale, answers)
}

export function canPreviewAssessmentScaleResult(scale: ScaleDetail | undefined) {
  return Boolean(getResolvedAssessmentScalePreviewUi(scale)?.showResultLevel)
}

export function canPreviewAssessmentScaleAlert(scale: ScaleDetail | undefined) {
  return Boolean(getResolvedAssessmentScalePreviewUi(scale)?.showAlertMessages)
}

export function getAssessmentPreviewResultLevel(
  totalScore: number,
  scale?: ScaleDetail,
) {
  if (!scale || !canPreviewAssessmentScaleResult(scale)) {
    return null
  }

  return getPreviewResultLevelFromMetadata(totalScore, scale)
}

export function getAssessmentPreviewAlertMessages(
  totalScore: number,
  scale?: ScaleDetail,
) {
  if (!scale || !canPreviewAssessmentScaleAlert(scale)) {
    return null
  }

  return getPreviewAlertMessagesFromMetadata(totalScore, scale)
}

export function getAssessmentScaleFormNotice(scale: ScaleDetail | undefined) {
  if (!scale) {
    return null
  }

  return getResolvedAssessmentScaleFormNotice(scale)
}
