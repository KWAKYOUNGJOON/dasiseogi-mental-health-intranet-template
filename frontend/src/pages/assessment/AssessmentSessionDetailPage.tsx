import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import {
  fetchSessionDetail,
  markSessionMisentered,
  type SessionDetail,
} from '../../features/assessment/api/assessmentApi'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import { PageHeader } from '../../shared/components/PageHeader'
import { formatAssessmentLocalDateTimeText } from '../../shared/utils/dateText'
import type { ApiResponse } from '../../shared/types/api'

interface SessionDetailLoadError {
  title: string
  message: string
}

const GENERIC_DETAIL_ERROR_TITLE = '세션 상세를 불러오지 못했습니다.'
const GENERIC_DETAIL_ERROR_MESSAGE = '잠시 후 다시 시도해주세요.'
const GENERIC_MISENTERED_ERROR_MESSAGE = '오입력 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
const HIGHLIGHT_SCALE_FALLBACK_MESSAGE = '강조할 척도를 찾지 못해 세션 전체를 표시합니다.'
const DEFAULT_RECORD_LIST_PATH = '/assessment-records'

function getErrorResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return null
  }

  return {
    data: error.response?.data,
    status: error.response?.status ?? null,
  }
}

function isHighlightScaleNotFoundError(error: unknown) {
  const response = getErrorResponse(error)
  const errorCode = response?.data?.errorCode ?? null

  return errorCode === 'HIGHLIGHT_SCALE_NOT_FOUND' || errorCode === 'INVALID_SCALE_CODE'
}

function isSessionAlreadyMisenteredError(error: unknown) {
  return getErrorResponse(error)?.data?.errorCode === 'SESSION_ALREADY_MISENTERED'
}

function getSessionDetailLoadError(error: unknown): SessionDetailLoadError {
  const response = getErrorResponse(error)
  const message = response?.data?.message?.trim()

  if (response?.status === 404 || response?.data?.errorCode === 'SESSION_NOT_FOUND') {
    return {
      title: '세션을 찾을 수 없습니다.',
      message: message || '검사기록 목록에서 다시 확인해주세요.',
    }
  }

  if (response?.status === 403 || response?.data?.errorCode === 'SESSION_VIEW_FORBIDDEN' || response?.data?.errorCode === 'FORBIDDEN') {
    return {
      title: '세션 상세를 볼 수 없습니다.',
      message: message || '권한이 없어 해당 세션을 조회할 수 없습니다.',
    }
  }

  return {
    title: GENERIC_DETAIL_ERROR_TITLE,
    message: message || GENERIC_DETAIL_ERROR_MESSAGE,
  }
}

function getMisenteredActionErrorMessage(error: unknown) {
  const response = getErrorResponse(error)
  const message = response?.data?.message?.trim()

  if (response?.data?.errorCode === 'SESSION_ALREADY_MISENTERED') {
    return message || '이 세션은 이미 오입력 처리되었습니다. 현재 상태를 다시 확인해주세요.'
  }

  if (response?.status === 403 || response?.data?.errorCode === 'SESSION_MARK_MISENTERED_FORBIDDEN' || response?.data?.errorCode === 'FORBIDDEN') {
    return message || '권한이 없어 해당 작업을 수행할 수 없습니다.'
  }

  if (response?.data?.errorCode === 'MISENTERED_REASON_REQUIRED') {
    return message || '오입력 처리 사유를 입력해주세요.'
  }

  if (response?.status === 404 || response?.data?.errorCode === 'SESSION_NOT_FOUND') {
    return message || '세션을 찾을 수 없습니다. 목록에서 다시 확인해주세요.'
  }

  return message || GENERIC_MISENTERED_ERROR_MESSAGE
}

function getSessionDetailDescription(session: SessionDetail | null) {
  if (!session) {
    return '세션 전체 결과를 확인하고 출력 및 오입력 처리를 수행합니다.'
  }

  return `${session.clientName} / ${session.sessionNo}`
}

function getAssessmentRecordReturnTo(searchParams: URLSearchParams) {
  const returnTo = searchParams.get('returnTo')?.trim()

  if (!returnTo) {
    return DEFAULT_RECORD_LIST_PATH
  }

  if (returnTo === DEFAULT_RECORD_LIST_PATH || returnTo.startsWith(`${DEFAULT_RECORD_LIST_PATH}?`)) {
    return returnTo
  }

  return DEFAULT_RECORD_LIST_PATH
}

export function AssessmentSessionDetailPage() {
  const { sessionId } = useParams()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<SessionDetailLoadError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [highlightNotice, setHighlightNotice] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const requestedHighlightScaleCode = searchParams.get('highlightScaleCode')?.trim() || null
  const returnTo = getAssessmentRecordReturnTo(searchParams)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setLoadError({
        title: '세션을 찾을 수 없습니다.',
        message: '검사기록 목록에서 다시 확인해주세요.',
      })
      return
    }

    const parsedSessionId = Number(sessionId)

    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      setSession(null)
      setLoadError({
        title: '세션을 찾을 수 없습니다.',
        message: '검사기록 목록에서 다시 확인해주세요.',
      })
      return
    }

    void loadSession(parsedSessionId)
  }, [requestedHighlightScaleCode, sessionId])

  async function requestSessionDetail(id: number) {
    try {
      return await fetchSessionDetail(
        id,
        requestedHighlightScaleCode ? { highlightScaleCode: requestedHighlightScaleCode } : undefined,
      )
    } catch (requestError: unknown) {
      if (!requestedHighlightScaleCode || !isHighlightScaleNotFoundError(requestError)) {
        throw requestError
      }

      return await fetchSessionDetail(id)
    }
  }

  function applySessionData(data: SessionDetail) {
    setSession(data)
    setHighlightNotice(
      requestedHighlightScaleCode && !data.scales.some((scale) => scale.scaleCode === requestedHighlightScaleCode)
        ? HIGHLIGHT_SCALE_FALLBACK_MESSAGE
        : null,
    )
  }

  async function loadSession(id: number) {
    setLoading(true)
    setLoadError(null)
    setActionError(null)

    try {
      const data = await requestSessionDetail(id)
      applySessionData(data)
    } catch (requestError: unknown) {
      setSession(null)
      setHighlightNotice(null)
      setLoadError(getSessionDetailLoadError(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function refreshSession(id: number) {
    setRefreshing(true)

    try {
      const data = await requestSessionDetail(id)
      applySessionData(data)
      return data
    } catch {
      return null
    } finally {
      setRefreshing(false)
    }
  }

  function handleOpenDialog() {
    setActionError(null)
    setNotice(null)
    setDialogOpen(true)
  }

  function handleCloseDialog() {
    if (processing) {
      return
    }

    setDialogOpen(false)
    setReason('')
    setActionError(null)
  }

  function handleReasonChange(nextReason: string) {
    setReason(nextReason)

    if (actionError) {
      setActionError(null)
    }
  }

  async function handleMarkMisentered() {
    if (!session || processing) {
      return
    }

    const trimmedReason = reason.trim()

    if (!trimmedReason) {
      setActionError('오입력 처리 사유를 입력해주세요.')
      return
    }

    setProcessing(true)
    setActionError(null)

    try {
      const result = await markSessionMisentered(session.id, trimmedReason)
      const refreshedSession = await refreshSession(session.id)

      if (!refreshedSession) {
        setSession((current) =>
          current
            ? {
                ...current,
                status: result.status,
                misenteredAt: result.misenteredAt,
                misenteredById: user?.id ?? current.misenteredById,
                misenteredByName: user?.name ?? current.misenteredByName,
                misenteredReason: trimmedReason,
              }
            : current,
        )
      }

      setNotice('오입력 처리되었습니다.')
      setDialogOpen(false)
      setReason('')
    } catch (requestError: unknown) {
      const nextActionError = getMisenteredActionErrorMessage(requestError)

      if (isSessionAlreadyMisenteredError(requestError) && session) {
        const refreshedSession = await refreshSession(session.id)

        if (refreshedSession) {
          setDialogOpen(false)
          setReason('')
        }
      }

      setActionError(nextActionError)
    } finally {
      setProcessing(false)
    }
  }

  function handleRetry() {
    if (!sessionId) {
      return
    }

    const parsedSessionId = Number(sessionId)

    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return
    }

    void loadSession(parsedSessionId)
  }

  function handlePrint() {
    if (!session || loading || refreshing || loadError) {
      return
    }

    window.open(`/assessments/sessions/${session.id}/print`, '_blank', 'noopener,noreferrer')
  }

  const canMarkMisentered = user?.role === 'ADMIN' || user?.id === session?.performedById
  const highlightedScaleCode =
    requestedHighlightScaleCode && session?.scales.some((scale) => scale.scaleCode === requestedHighlightScaleCode)
      ? requestedHighlightScaleCode
      : null

  return (
    <div className="stack">
      <PageHeader
        actions={
          <div className="actions">
            <Link className="secondary-button" to={returnTo}>
              검사기록 목록으로 돌아가기
            </Link>
            {session ? (
              <button
                className="secondary-button"
                disabled={loading || refreshing || processing}
                onClick={handlePrint}
                type="button"
              >
                출력
              </button>
            ) : null}
            {session && canMarkMisentered && session.status !== 'MISENTERED' ? (
              <button
                className="danger-button"
                disabled={processing || refreshing}
                onClick={handleOpenDialog}
                type="button"
              >
                오입력 처리
              </button>
            ) : null}
          </div>
        }
        description={getSessionDetailDescription(session)}
        title="세션 상세"
      />

      {!dialogOpen && actionError ? (
        <div className="error-text" role="alert">
          {actionError}
        </div>
      ) : null}
      {notice ? <div className="success-text">{notice}</div> : null}
      {highlightNotice ? <div className="card muted">{highlightNotice}</div> : null}

      {loading && !session ? (
        <div className="card" aria-busy="true">
          세션 상세를 불러오는 중...
        </div>
      ) : null}

      {loadError ? (
        <div className="card stack" role="alert">
          <h3 style={{ margin: 0 }}>{loadError.title}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {loadError.message}
          </p>
          <div className="actions">
            <button className="secondary-button" onClick={handleRetry} type="button">
              다시 시도
            </button>
          </div>
        </div>
      ) : null}

      {session ? (
        <>
          {refreshing ? (
            <div className="card muted" aria-live="polite">
              최신 상태를 확인하는 중...
            </div>
          ) : null}

          <div className="card grid-2">
            <div className="field">
              <span className="muted">세션번호</span>
              <strong>{session.sessionNo}</strong>
            </div>
            <div className="field">
              <span className="muted">사례번호</span>
              <strong>{session.clientNo}</strong>
            </div>
            <div className="field">
              <span className="muted">검사일시</span>
              <strong>{formatAssessmentLocalDateTimeText(session.sessionCompletedAt)}</strong>
            </div>
            <div className="field">
              <span className="muted">담당자</span>
              <strong>{session.performedByName}</strong>
            </div>
            <div className="field">
              <span className="muted">대상자</span>
              <strong>{session.clientName}</strong>
            </div>
            <div className="field">
              <span className="muted">생년월일</span>
              <strong>{session.clientBirthDate}</strong>
            </div>
            <div className="field">
              <span className="muted">상태</span>
              <strong>{session.status}</strong>
            </div>
            <div className="field">
              <span className="muted">세션 메모</span>
              <strong>{session.memo ?? '-'}</strong>
            </div>
          </div>

          {session.status === 'MISENTERED' ? (
            <div className="card grid-2">
              <div className="field">
                <span className="muted">오입력 처리 시각</span>
                <strong>{session.misenteredAt ? formatAssessmentLocalDateTimeText(session.misenteredAt) : '-'}</strong>
              </div>
              <div className="field">
                <span className="muted">처리자</span>
                <strong>{session.misenteredByName ?? '-'}</strong>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="muted">사유</span>
                <strong>{session.misenteredReason ?? '-'}</strong>
              </div>
            </div>
          ) : null}

          {session.alerts.length > 0 ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>경고</h3>
              <div className="stack">
                {session.alerts.map((alert) => (
                  <div className="error-text" key={alert.id}>
                    [{alert.scaleCode}] {alert.alertMessage}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {session.scales.map((scale) => {
            const highlighted = highlightedScaleCode === scale.scaleCode

            return (
              <div
                className="card stack"
                data-highlighted={highlighted ? 'true' : 'false'}
                data-testid={`session-scale-${scale.scaleCode}`}
                key={scale.sessionScaleId}
                style={
                  highlighted
                    ? { borderColor: '#1d6a7d', boxShadow: '0 0 0 2px rgba(29,106,125,0.15)' }
                    : undefined
                }
              >
                <div className="actions" style={{ justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0 }}>{scale.scaleName}</h3>
                  <span className="status-chip">
                    총점 {scale.totalScore} / {scale.resultLevel}
                  </span>
                </div>
                {scale.alerts.length > 0 ? (
                  <div className="stack">
                    {scale.alerts.map((alert) => (
                      <div className="error-text" key={alert.id}>
                        {alert.alertMessage}
                      </div>
                    ))}
                  </div>
                ) : null}
                <table className="table">
                  <thead>
                    <tr>
                      <th>문항</th>
                      <th>응답</th>
                      <th>점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scale.answers.map((answer) => (
                      <tr key={answer.questionNo}>
                        <td>{answer.questionText}</td>
                        <td>{answer.answerLabel}</td>
                        <td>{answer.scoreValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </>
      ) : null}

      <ConfirmDialog
        confirmDisabled={!reason.trim()}
        confirmText="오입력 처리"
        description="세션과 하위 결과는 유지한 채 상태만 MISENTERED로 변경합니다."
        onCancel={handleCloseDialog}
        onConfirm={() => void handleMarkMisentered()}
        open={dialogOpen}
        processing={processing}
        title="세션 오입력 처리"
      >
        <div className="field">
          <span className="muted">사유</span>
          <textarea onChange={(event) => handleReasonChange(event.target.value)} rows={4} value={reason} />
        </div>
        {dialogOpen && actionError ? (
          <div className="error-text" role="alert">
            {actionError}
          </div>
        ) : null}
        {refreshing ? <div className="muted">최신 상태를 확인하는 중...</div> : null}
      </ConfirmDialog>
    </div>
  )
}
