import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchClientDetail, markClientMisregistered, type ClientDetail } from '../../features/clients/api/clientApi'
import { useAuth } from '../../app/providers/AuthProvider'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import { PageHeader } from '../../shared/components/PageHeader'

export function ClientDetailPage() {
  const { clientId } = useParams()
  const { user } = useAuth()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!clientId) return
    void loadClient(Number(clientId))
  }, [clientId])

  async function loadClient(id: number) {
    try {
      const data = await fetchClientDetail(id)
      setClient(data)
      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '대상자 정보를 불러오지 못했습니다.')
    }
  }

  async function handleMarkMisregistered() {
    if (!client) return

    setProcessing(true)
    try {
      await markClientMisregistered(client.id, reason)
      await loadClient(client.id)
      setNotice('오등록 처리되었습니다.')
      setDialogOpen(false)
      setReason('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '오등록 처리에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  if (error) {
    return <div className="error-text">{error}</div>
  }

  if (!client) {
    return <div>대상자 정보를 불러오는 중...</div>
  }

  const canMarkMisregistered = user?.role === 'ADMIN' || user?.id === client.createdById

  return (
    <div className="stack">
      <PageHeader
        actions={
          <div className="actions">
            {client.status === 'ACTIVE' ? (
              <Link className="primary-button" to={`/assessments/start/${client.id}/scales`}>
                검사 시작
              </Link>
            ) : null}
            {canMarkMisregistered && client.status !== 'MISREGISTERED' ? (
              <button className="danger-button" disabled={processing} onClick={() => {
                setError(null)
                setNotice(null)
                setDialogOpen(true)
              }}>
                오등록 처리
              </button>
            ) : null}
          </div>
        }
        description="연락처는 상세 화면에서만 노출됩니다."
        title={`${client.name} 상세`}
      />
      {notice ? <div className="success-text">{notice}</div> : null}
      <div className="card grid-2">
        <div className="field">
          <span className="muted">사례번호</span>
          <strong>{client.clientNo}</strong>
        </div>
        <div className="field">
          <span className="muted">담당자</span>
          <strong>{client.primaryWorkerName}</strong>
        </div>
        <div className="field">
          <span className="muted">생년월일</span>
          <strong>{client.birthDate}</strong>
        </div>
        <div className="field">
          <span className="muted">연락처</span>
          <strong>{client.phone ?? '-'}</strong>
        </div>
        <div className="field">
          <span className="muted">상태</span>
          <strong>{client.status}</strong>
        </div>
      </div>
      {client.status === 'MISREGISTERED' ? (
        <div className="card stack">
          <div className="field">
            <span className="muted">오등록 처리 시각</span>
            <strong>{client.misregisteredAt ?? '-'}</strong>
          </div>
          <div className="field">
            <span className="muted">처리자</span>
            <strong>{client.misregisteredByName ?? '-'}</strong>
          </div>
          <div className="field">
            <span className="muted">사유</span>
            <strong>{client.misregisteredReason ?? '-'}</strong>
          </div>
        </div>
      ) : null}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>최근 검사 세션</h3>
        {client.recentSessions.length === 0 ? (
          <p className="muted">아직 저장된 검사 세션이 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>세션번호</th>
                <th>검사일시</th>
                <th>담당자</th>
                <th>척도 수</th>
                <th>경고</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {client.recentSessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.sessionNo}</td>
                  <td>{session.sessionCompletedAt}</td>
                  <td>{session.performedByName}</td>
                  <td>{session.scaleCount}</td>
                  <td>{session.hasAlert ? '있음' : '없음'}</td>
                  <td>
                    <Link className="secondary-button" to={`/assessments/sessions/${session.id}`}>
                      세션 상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ConfirmDialog
        confirmDisabled={!reason.trim()}
        confirmText="오등록 처리"
        description="물리 삭제하지 않고 대상자 상태만 MISREGISTERED로 변경합니다."
        onCancel={() => {
          if (processing) return
          setDialogOpen(false)
          setReason('')
        }}
        onConfirm={() => void handleMarkMisregistered()}
        open={dialogOpen}
        processing={processing}
        title="대상자 오등록 처리"
      >
        <div className="field">
          <span className="muted">사유</span>
          <textarea onChange={(event) => setReason(event.target.value)} rows={4} value={reason} />
        </div>
      </ConfirmDialog>
    </div>
  )
}
