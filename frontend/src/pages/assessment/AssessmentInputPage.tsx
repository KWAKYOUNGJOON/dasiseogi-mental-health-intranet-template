import { isAxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchScaleDetail, type ScaleDetail } from '../../features/assessment/api/assessmentApi'
import { AssessmentProgressHeader } from '../../features/assessment/components/AssessmentProgressHeader'
import { ScaleQuestionForm } from '../../features/assessment/components/ScaleQuestionForm'
import { useAssessmentDraftStore } from '../../features/assessment/store/assessmentDraftStore'
import { PageHeader } from '../../shared/components/PageHeader'
import type { ApiResponse } from '../../shared/types/api'

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return fallbackMessage
  }

  return error.response?.data?.message ?? fallbackMessage
}

export function AssessmentInputPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const parsedClientId = Number(clientId)
  const hasValidClientId = Number.isInteger(parsedClientId) && parsedClientId > 0
  const {
    clientId: draftClientId,
    selectedScaleCodes,
    currentScaleIndex,
    answersByScale,
    setAnswer,
    nextScale,
    previousScale,
  } = useAssessmentDraftStore()
  const [scale, setScale] = useState<ScaleDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentScaleCode = selectedScaleCodes[currentScaleIndex]
  const currentAnswers = useMemo(
    () => (currentScaleCode ? answersByScale[currentScaleCode] ?? {} : {}),
    [answersByScale, currentScaleCode],
  )
  const hasValidDraft = hasValidClientId && draftClientId === parsedClientId && selectedScaleCodes.length > 0 && Boolean(currentScaleCode)

  useEffect(() => {
    if (!hasValidDraft || !currentScaleCode) return

    let cancelled = false

    async function loadScale() {
      setScale(null)
      setError(null)
      try {
        const data = await fetchScaleDetail(currentScaleCode)
        if (cancelled) return
        setScale(data)
      } catch (requestError: unknown) {
        if (cancelled) return
        setError(getErrorMessage(requestError, '척도 정보를 불러오지 못했습니다.'))
      }
    }

    void loadScale()

    return () => {
      cancelled = true
    }
  }, [currentScaleCode, hasValidDraft])

  const answeredCount = useMemo(() => {
    if (!scale) {
      return 0
    }

    return scale.questions.filter((question) => Boolean(currentAnswers[question.questionNo])).length
  }, [currentAnswers, scale])
  const isFirstScale = currentScaleIndex === 0
  const isLastScale = currentScaleIndex === selectedScaleCodes.length - 1
  const canMoveNext = Boolean(scale) && answeredCount === (scale?.questionCount ?? 0)

  if (!hasValidClientId) {
    return (
      <div className="stack">
        <PageHeader description="선택한 척도를 순서대로 입력합니다." title="척도 입력" />
        <div className="card stack">
          <div className="error-text">대상자 정보를 확인할 수 없습니다.</div>
          <div className="actions">
            <Link className="secondary-button" to="/clients">
              대상자 목록으로 이동
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!hasValidDraft || !currentScaleCode) {
    return (
      <div className="stack">
        <PageHeader description="선택한 척도를 순서대로 입력합니다." title="척도 입력" />
        <div className="card stack">
          <div className="error-text">선택된 척도 정보가 없습니다. 척도 선택부터 다시 시작해주세요.</div>
          <div className="actions">
            <Link className="secondary-button" to={`/assessments/start/${parsedClientId}`}>
              척도 선택으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  function handlePrevious() {
    if (isFirstScale) return
    previousScale()
  }

  function handleNext() {
    if (!scale || !canMoveNext) {
      return
    }

    if (isLastScale) {
      navigate(`/assessments/start/${clientId}/summary`)
      return
    }

    nextScale()
  }

  return (
    <div className="stack assessment-input-page">
      <PageHeader
        actions={
          scale ? (
            <div aria-live="polite" className="assessment-page-header-meta">
              <span className="assessment-page-header-meta__label">응답 완료</span>
              <strong>
                {answeredCount} / {scale.questionCount}
              </strong>
            </div>
          ) : null
        }
        description={`${currentScaleIndex + 1} / ${selectedScaleCodes.length} 단계`}
        title={scale ? `${scale.scaleName} 입력` : '척도 입력'}
      />
      <AssessmentProgressHeader currentScaleCode={currentScaleCode} scaleCodes={selectedScaleCodes} />
      {error ? <div className="error-text">{error}</div> : null}
      {scale ? (
        <ScaleQuestionForm
          answers={currentAnswers}
          onSelect={(questionNo, value) => setAnswer(currentScaleCode, questionNo, value)}
          scale={scale}
        />
      ) : error ? null : (
        <div>척도 정보를 불러오는 중...</div>
      )}
      <div aria-label="문항 이동" className="assessment-action-bar" role="region">
        <div className="assessment-action-bar__summary">
          <span className="assessment-action-bar__eyebrow">
            현재 단계 {currentScaleIndex + 1} / {selectedScaleCodes.length}
          </span>
          <strong className="assessment-action-bar__count">
            {error
              ? '입력 가능한 척도를 다시 확인해주세요.'
              : scale
                ? `응답 완료 ${answeredCount} / ${scale.questionCount}`
                : '척도 정보를 불러오는 중...'}
          </strong>
        </div>
        <div className="assessment-action-bar__buttons">
          <button className="secondary-button" disabled={isFirstScale} onClick={handlePrevious}>
            이전
          </button>
          <button className="primary-button" disabled={!canMoveNext} onClick={handleNext}>
            다음
          </button>
        </div>
      </div>
    </div>
  )
}
