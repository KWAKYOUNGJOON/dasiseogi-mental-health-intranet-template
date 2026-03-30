import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { fetchScaleDetail, type ScaleDetail } from '../../features/assessment/api/assessmentApi'
import { ScaleQuestionForm } from '../../features/assessment/components/ScaleQuestionForm'
import { useAssessmentDraftStore } from '../../features/assessment/store/assessmentDraftStore'
import { PageHeader } from '../../shared/components/PageHeader'

export function AssessmentInputPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const {
    clientId: draftClientId,
    selectedScaleCodes,
    currentScaleIndex,
    answersByScale,
    setAnswer,
    nextScale,
  } = useAssessmentDraftStore()
  const [scale, setScale] = useState<ScaleDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentScaleCode = selectedScaleCodes[currentScaleIndex]
  const currentAnswers = answersByScale[currentScaleCode] ?? {}

  useEffect(() => {
    if (!currentScaleCode) return
    void fetchScaleDetail(currentScaleCode).then(setScale)
  }, [currentScaleCode])

  const answeredCount = useMemo(() => Object.keys(currentAnswers).length, [currentAnswers])

  if (!clientId || draftClientId !== Number(clientId) || !currentScaleCode) {
    return <Navigate replace to={`/assessments/start/${clientId ?? ''}/scales`} />
  }

  function handleContinue() {
    if (!scale) return
    if (answeredCount !== scale.questionCount) {
      setError('모든 문항에 응답해야 다음 단계로 이동할 수 있습니다.')
      return
    }
    setError(null)
    if (currentScaleIndex === selectedScaleCodes.length - 1) {
      navigate(`/assessments/start/${clientId}/summary`)
      return
    }
    nextScale()
  }

  return (
    <div className="stack">
      <PageHeader
        description={`${currentScaleIndex + 1} / ${selectedScaleCodes.length} 단계`}
        title={scale ? `${scale.scaleName} 입력` : '척도 입력'}
      />
      <div className="card">
        <p className="muted">응답 완료: {answeredCount} / {scale?.questionCount ?? 0}</p>
      </div>
      {scale ? (
        <ScaleQuestionForm
          answers={currentAnswers}
          onSelect={(questionNo, value) => setAnswer(currentScaleCode, questionNo, value)}
          scale={scale}
        />
      ) : (
        <div>척도 정보를 불러오는 중...</div>
      )}
      {error ? <div className="error-text">{error}</div> : null}
      <div className="actions">
        <button className="primary-button" onClick={handleContinue}>
          {currentScaleIndex === selectedScaleCodes.length - 1 ? '요약으로 이동' : '다음 척도'}
        </button>
      </div>
    </div>
  )
}
