import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchSessionDetail, markSessionMisentered, type SessionDetail } from '../../features/assessment/api/assessmentApi'
import { useAuth } from '../../app/providers/AuthProvider'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import { PageHeader } from '../../shared/components/PageHeader'

export function AssessmentSessionDetailPage() {
  const { sessionId } = useParams()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!sessionId) return
    void loadSession(Number(sessionId))
  }, [sessionId])

  async function loadSession(id: number) {
    try {
      const data = await fetchSessionDetail(id)
      setSession(data)
      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '세션 상세를 불러오지 못했습니다.')
    }
  }

  async function handleMarkMisentered() {
    if (!session) return

    setProcessing(true)
    try {
      await markSessionMisentered(session.id, reason)
      await loadSession(session.id)
      setNotice('오입력 처리되었습니다.')
      setDialogOpen(false)
      setReason('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '오입력 처리에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  if (error) {
    return <div className="error-text">{error}</div>
  }

  if (!session) {
    return <div>세션 상세를 불러오는 중...</div>
  }

  const canMarkMisentered = user?.role === 'ADMIN' || user?.id === session.performedById
  const highlightScaleCode = searchParams.get('highlightScaleCode')

  return (
    <div className="stack">
      <PageHeader
        actions={
          <div className="actions">
            <button
              className="secondary-button"
              onClick={() => window.open(`/assessments/sessions/${session.id}/print`, '_blank', 'noopener,noreferrer')}
            >
              출력
            </button>
            {canMarkMisentered && session.status !== 'MISENTERED' ? (
              <button className="danger-button" disabled={processing} onClick={() => {
                setError(null)
                setNotice(null)
                setDialogOpen(true)
              }}>
                오입력 처리
              </button>
            ) : null}
          </div>
        }
        description={`${session.clientName} / ${session.sessionNo}`}
        title="세션 상세"
      />
      {notice ? <div className="success-text">{notice}</div> : null}
      <div className="card grid-2">
        <div className="field">
          <span className="muted">검사일시</span>
          <strong>{session.sessionCompletedAt}</strong>
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
          <span className="muted">메모</span>
          <strong>{session.memo ?? '-'}</strong>
        </div>
        <div className="field">
          <span className="muted">상태</span>
          <strong>{session.status}</strong>
        </div>
      </div>
      {session.status === 'MISENTERED' ? (
        <div className="card grid-2">
          <div className="field">
            <span className="muted">오입력 처리 시각</span>
            <strong>{session.misenteredAt ?? '-'}</strong>
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
      {session.scales.map((scale) => (
        <div
          className="card stack"
          key={scale.sessionScaleId}
          style={highlightScaleCode === scale.scaleCode ? { borderColor: '#1d6a7d', boxShadow: '0 0 0 2px rgba(29,106,125,0.15)' } : undefined}
        >
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{scale.scaleName}</h3>
            <span className="status-chip">
              총점 {scale.totalScore} / {scale.resultLevel}
            </span>
          </div>
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
      ))}
      <ConfirmDialog
        confirmDisabled={!reason.trim()}
        confirmText="오입력 처리"
        description="세션과 하위 결과는 유지한 채 상태만 MISENTERED로 변경합니다."
        onCancel={() => {
          if (processing) return
          setDialogOpen(false)
          setReason('')
        }}
        onConfirm={() => void handleMarkMisentered()}
        open={dialogOpen}
        processing={processing}
        title="세션 오입력 처리"
      >
        <div className="field">
          <span className="muted">사유</span>
          <textarea onChange={(event) => setReason(event.target.value)} rows={4} value={reason} />
        </div>
      </ConfirmDialog>
    </div>
  )
}
