import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { createAssessmentSession, fetchScaleDetail, type ScaleDetail } from '../../features/assessment/api/assessmentApi'
import { useAssessmentDraftStore } from '../../features/assessment/store/assessmentDraftStore'
import { PageHeader } from '../../shared/components/PageHeader'

export function AssessmentSummaryPage() {
  const { clientId } = useParams()
  const { clientId: draftClientId, selectedScaleCodes, answersByScale, memo, startedAt, setMemo, reset } =
    useAssessmentDraftStore()
  const [definitions, setDefinitions] = useState<Record<string, ScaleDetail>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSessionId, setSavedSessionId] = useState<number | null>(null)

  useEffect(() => {
    async function loadDefinitions() {
      const entries = await Promise.all(selectedScaleCodes.map(async (code) => [code, await fetchScaleDetail(code)] as const))
      setDefinitions(Object.fromEntries(entries))
    }

    if (selectedScaleCodes.length > 0) {
      void loadDefinitions()
    }
  }, [selectedScaleCodes])

  const summaries = useMemo(
    () =>
      selectedScaleCodes.map((code) => {
        const definition = definitions[code]
        const answers = answersByScale[code] ?? {}
        const totalScore =
          definition?.questions.reduce((accumulator, question) => {
            const selectedValue = answers[question.questionNo]
            const option = question.options.find((candidate) => candidate.value === selectedValue)
            if (!option) {
              return accumulator
            }
            const maxScore = Math.max(...question.options.map((candidate) => candidate.score))
            const minScore = Math.min(...question.options.map((candidate) => candidate.score))
            const appliedScore = question.reverseScored ? minScore + maxScore - option.score : option.score
            return accumulator + appliedScore
          }, 0) ?? 0

        return {
          scaleCode: code,
          scaleName: definition?.scaleName ?? code,
          totalScore,
          resultLevel: '서버 최종 계산',
          hasAlertPreview: false,
        }
      }),
    [answersByScale, definitions, selectedScaleCodes],
  )

  if (savedSessionId !== null) {
    return <Navigate replace to={`/assessments/sessions/${savedSessionId}`} />
  }

  if (!clientId || draftClientId !== Number(clientId) || selectedScaleCodes.length === 0 || !startedAt) {
    return <Navigate replace to={`/assessments/start/${clientId ?? ''}/scales`} />
  }

  const startedAtValue = startedAt

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const response = await createAssessmentSession({
        clientId: Number(clientId),
        sessionStartedAt: startedAtValue,
        sessionCompletedAt: new Date().toISOString().slice(0, 19),
        memo,
        selectedScales: selectedScaleCodes.map((code) => ({
          scaleCode: code,
          answers: Object.entries(answersByScale[code] ?? {}).map(([questionNo, answerValue]) => ({
            questionNo: Number(questionNo),
            answerValue,
          })),
        })),
      })
      reset()
      setSavedSessionId(response.sessionId)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '세션 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader description="저장 전 최종 확인 단계입니다." title="세션 요약" />
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>척도</th>
              <th>총점</th>
              <th>판정</th>
              <th>경고</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.scaleCode}>
                <td>{summary.scaleName}</td>
                <td>{summary.totalScore}</td>
                <td>{summary.resultLevel}</td>
                <td>{summary.hasAlertPreview ? '있음' : '저장 후 계산'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="field card">
        <span>세션 메모</span>
        <textarea
          onChange={(event) => setMemo(event.target.value)}
          placeholder="요약 메모를 남길 수 있습니다."
          rows={4}
          value={memo}
        />
      </label>
      {error ? <div className="error-text">{error}</div> : null}
      <div className="actions">
        <button className="primary-button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '저장 중...' : '세션 저장'}
        </button>
      </div>
    </div>
  )
}
