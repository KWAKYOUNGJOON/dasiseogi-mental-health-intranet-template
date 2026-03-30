import { useEffect, useState } from 'react'
import { approveSignupRequest, fetchSignupRequests, rejectSignupRequest, type SignupRequestPage } from '../../features/admin/api/adminApi'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import { PageHeader } from '../../shared/components/PageHeader'

export function AdminSignupRequestsPage() {
  const [data, setData] = useState<SignupRequestPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [processNote, setProcessNote] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      setData(await fetchSignupRequests())
      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '승인 대기 목록을 불러오지 못했습니다.')
    }
  }

  async function handleProcess() {
    if (!selectedRequestId || !mode) {
      return
    }
    setProcessing(true)
    try {
      if (mode === 'approve') {
        await approveSignupRequest(selectedRequestId, processNote)
      } else {
        await rejectSignupRequest(selectedRequestId, processNote)
      }
      setSelectedRequestId(null)
      setMode(null)
      setProcessNote('')
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '처리에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader description="승인 대기 계정을 처리합니다." title="가입 신청 관리" />
      {error ? <div className="error-text">{error}</div> : null}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>신청일시</th>
              <th>이름</th>
              <th>아이디</th>
              <th>연락처</th>
              <th>소속 팀</th>
              <th>상태</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.requestId}>
                <td>{item.requestedAt}</td>
                <td>{item.name}</td>
                <td>{item.loginId}</td>
                <td>{item.phone ?? '-'}</td>
                <td>{item.teamName ?? '-'}</td>
                <td>{item.requestStatus}</td>
                <td>
                  <div className="actions">
                    <button className="secondary-button" onClick={() => {
                      setMode('approve')
                      setSelectedRequestId(item.requestId)
                      setProcessNote('')
                    }}>
                      승인
                    </button>
                    <button className="danger-button" onClick={() => {
                      setMode('reject')
                      setSelectedRequestId(item.requestId)
                      setProcessNote('')
                    }}>
                      반려
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        confirmDisabled={mode === 'reject' && !processNote.trim()}
        confirmText={mode === 'approve' ? '승인' : '반려'}
        description={mode === 'approve' ? '선택한 가입 신청을 승인합니다.' : '선택한 가입 신청을 반려합니다.'}
        onCancel={() => {
          if (processing) return
          setSelectedRequestId(null)
          setMode(null)
          setProcessNote('')
        }}
        onConfirm={() => void handleProcess()}
        open={selectedRequestId !== null && mode !== null}
        processing={processing}
        title={mode === 'approve' ? '가입 신청 승인' : '가입 신청 반려'}
      >
        <div className="field">
          <span className="muted">처리 메모</span>
          <textarea onChange={(event) => setProcessNote(event.target.value)} rows={4} value={processNote} />
        </div>
      </ConfirmDialog>
    </div>
  )
}
