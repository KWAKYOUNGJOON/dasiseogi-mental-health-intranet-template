import { isAxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { createAssessmentSession, fetchScaleDetail, type ScaleDetail } from '../../features/assessment/api/assessmentApi'
import { useAssessmentDraftStore } from '../../features/assessment/store/assessmentDraftStore'
import { PageHeader } from '../../shared/components/PageHeader'
import { createCurrentSeoulDateTimeText } from '../../shared/utils/dateText'
import type { ApiResponse } from '../../shared/types/api'

const SESSION_MEMO_MAX_LENGTH = 1000

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return fallbackMessage
  }

  return error.response?.data?.message ?? fallbackMessage
}

function calculatePreviewTotalScore(definition: ScaleDetail | undefined, answers: Record<number, string>) {
  if (!definition) {
    return 0
  }

  return definition.questions.reduce((accumulator, question) => {
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

export function AssessmentSummaryPage() {
  const { clientId } = useParams()
  const { clientId: draftClientId, selectedScaleCodes, answersByScale, memo, startedAt, setMemo, reset } =
    useAssessmentDraftStore()
  const [definitions, setDefinitions] = useState<Record<string, ScaleDetail>>({})
  const [loadingDefinitions, setLoadingDefinitions] = useState(false)
  const [definitionError, setDefinitionError] = useState<string | null>(null)
  const [definitionRequestKey, setDefinitionRequestKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedSessionId, setSavedSessionId] = useState<number | null>(null)
  const parsedClientId = Number(clientId)
  const hasValidClientId = Number.isInteger(parsedClientId) && parsedClientId > 0
  const hasValidDraft = hasValidClientId && draftClientId === parsedClientId && selectedScaleCodes.length > 0 && Boolean(startedAt)
  const memoLength = memo.length
  const memoLimitExceeded = memoLength > SESSION_MEMO_MAX_LENGTH
  const memoLengthLabel = `${memoLength}/${SESSION_MEMO_MAX_LENGTH}`
  const memoError = memoLimitExceeded ? `세션 메모는 ${SESSION_MEMO_MAX_LENGTH}자 이내로 입력해주세요.` : null

  useEffect(() => {
    if (!hasValidDraft) {
      setDefinitions({})
      setDefinitionError(null)
      setLoadingDefinitions(false)
      return
    }

    let cancelled = false

    async function loadDefinitions() {
      setLoadingDefinitions(true)
      setDefinitionError(null)

      try {
        const entries = await Promise.all(selectedScaleCodes.map(async (code) => [code, await fetchScaleDetail(code)] as const))

        if (cancelled) {
          return
        }

        setDefinitions(Object.fromEntries(entries))
      } catch (requestError: unknown) {
        if (cancelled) {
          return
        }

        setDefinitions({})
        setDefinitionError(getErrorMessage(requestError, '척도 정의를 불러오지 못했습니다.'))
      } finally {
        if (!cancelled) {
          setLoadingDefinitions(false)
        }
      }
    }

    void loadDefinitions()

    return () => {
      cancelled = true
    }
  }, [definitionRequestKey, hasValidDraft, selectedScaleCodes])

  const summaries = useMemo(
    () =>
      selectedScaleCodes.map((code) => {
        const definition = definitions[code]
        const answers = answersByScale[code] ?? {}
        const answeredCount = definition?.questions.filter((question) => {
          const answerValue = answers[question.questionNo]
          return typeof answerValue === 'string' && answerValue.length > 0
        }).length ?? 0
        const questionCount = definition?.questionCount ?? 0

        return {
          scaleCode: code,
          scaleName: definition?.scaleName ?? code,
          answeredCount,
          questionCount,
          totalScorePreview: calculatePreviewTotalScore(definition, answers),
        }
      }),
    [answersByScale, definitions, selectedScaleCodes],
  )
  const definitionsReady = hasValidDraft && selectedScaleCodes.every((code) => Boolean(definitions[code]))

  if (savedSessionId !== null) {
    return <Navigate replace to={`/assessments/sessions/${savedSessionId}?notice=saved`} />
  }

  if (!clientId || !hasValidDraft) {
    return <Navigate replace to={`/assessments/start/${clientId ?? ''}/scales`} />
  }

  const startedAtValue = startedAt ?? ''

  function getValidationError() {
    if (!hasValidClientId) {
      return '대상자 정보를 다시 확인해주세요.'
    }

    if (draftClientId !== parsedClientId) {
      return '요약 화면 상태가 올바르지 않습니다. 척도 선택부터 다시 시작해주세요.'
    }

    if (selectedScaleCodes.length === 0) {
      return '선택된 척도가 없습니다. 척도 선택부터 다시 시작해주세요.'
    }

    if (!startedAtValue) {
      return '세션 시작 시간이 없습니다. 척도 선택부터 다시 시작해주세요.'
    }

    if (memoError) {
      return memoError
    }

    if (loadingDefinitions) {
      return '척도 정의를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
    }

    if (!definitionsReady) {
      return definitionError ?? '척도 정의를 다시 불러온 뒤 저장해주세요.'
    }

    const incompleteScaleNames = selectedScaleCodes.flatMap((code) => {
      const definition = definitions[code]

      if (!definition) {
        return [code]
      }

      const answers = answersByScale[code] ?? {}
      const hasMissingAnswer = definition.questions.some((question) => {
        const answerValue = answers[question.questionNo]
        return typeof answerValue !== 'string' || answerValue.length === 0
      })

      return hasMissingAnswer ? [definition.scaleName] : []
    })

    if (incompleteScaleNames.length > 0) {
      if (incompleteScaleNames.length === 1) {
        return `${incompleteScaleNames[0]} 응답이 완료되지 않았습니다. 입력 화면으로 돌아가 확인해주세요.`
      }

      return `선택한 척도 응답이 모두 입력되지 않았습니다. 미완료 척도: ${incompleteScaleNames.join(', ')}`
    }

    return null
  }

  function handleMemoChange(nextMemo: string) {
    setMemo(nextMemo)

    if (saveError) {
      setSaveError(null)
    }
  }

  function handleRetryDefinitions() {
    setDefinitionRequestKey((current) => current + 1)
  }

  async function handleSave() {
    if (saving) {
      return
    }

    const validationError = getValidationError()

    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const response = await createAssessmentSession({
        clientId: parsedClientId,
        sessionStartedAt: startedAtValue,
        sessionCompletedAt: createCurrentSeoulDateTimeText(),
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
    } catch (requestError: unknown) {
      setSaveError(getErrorMessage(requestError, '세션 저장에 실패했습니다.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader description="저장 전 최종 확인 단계입니다." title="세션 요약" />
      <div className="card stack">
        <strong>저장 전 안내</strong>
        <p className="muted" style={{ margin: 0 }}>
          현재 표시는 저장 전 UX용 미리보기입니다. 최종 점수, 판정, 경고는 저장 시 서버가 다시 계산합니다.
        </p>
      </div>
      {saveError ? (
        <div className="error-text" role="alert">
          {saveError}
        </div>
      ) : null}
      {loadingDefinitions ? (
        <div className="card">척도 정의를 불러오는 중...</div>
      ) : definitionError ? (
        <div className="card stack">
          <div className="error-text" role="alert">
            {definitionError}
          </div>
          <div className="actions">
            <button className="secondary-button" onClick={handleRetryDefinitions} type="button">
              다시 시도
            </button>
          </div>
        </div>
      ) : null}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>척도</th>
              <th>응답 상태</th>
              <th>총점 미리보기</th>
              <th>판정</th>
              <th>경고</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.scaleCode}>
                <td>{summary.scaleName}</td>
                <td>
                  {summary.answeredCount} / {summary.questionCount || '-'}
                </td>
                <td>{summary.totalScorePreview}</td>
                <td>저장 후 서버 최종 계산</td>
                <td>저장 후 서버 최종 계산</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="field card">
        <span>세션 메모</span>
        <textarea
          aria-describedby="assessment-summary-memo-hint assessment-summary-memo-error"
          aria-invalid={memoError ? 'true' : undefined}
          className={memoError ? 'input-error' : undefined}
          onChange={(event) => handleMemoChange(event.target.value)}
          placeholder="요약 메모를 남길 수 있습니다."
          rows={4}
          value={memo}
        />
        <span className="field-hint" id="assessment-summary-memo-hint">
          {memoLengthLabel}
        </span>
        {memoError ? (
          <span className="field-error" id="assessment-summary-memo-error">
            {memoError}
          </span>
        ) : null}
      </label>
      <div className="actions">
        <button
          className="primary-button"
          disabled={saving || loadingDefinitions || Boolean(definitionError)}
          onClick={() => void handleSave()}
          type="button"
        >
          {saving ? '저장 중...' : '세션 저장'}
        </button>
      </div>
    </div>
  )
}
