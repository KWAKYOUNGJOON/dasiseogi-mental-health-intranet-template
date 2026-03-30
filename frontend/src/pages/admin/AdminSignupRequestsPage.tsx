import { useEffect, useState } from 'react'
import { approveSignupRequest, fetchSignupRequests, rejectSignupRequest, type SignupRequestPage } from '../../features/admin/api/adminApi'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import { PageHeader } from '../../shared/components/PageHeader'

export function AdminSignupRequestsPage() {
  const [data, setData] = useState<SignupRequestPage | null>(null)
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null)
  const [processNote, setProcessNote] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    void load()
  }, [page, size, status])

  async function load() {
    try {
      setData(await fetchSignupRequests({ status: status || undefined, page, size }))
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
      if (page === 1) {
        await load()
      } else {
        setPage(1)
      }
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
      <div className="card stack">
        <div className="toolbar">
          <select
            onChange={(event) => {
              setStatus(event.target.value)
              if (page !== 1) {
                setPage(1)
              }
            }}
            value={status}
          >
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <select
            onChange={(event) => {
              setSize(Number(event.target.value))
              if (page !== 1) {
                setPage(1)
              }
            }}
            value={size}
          >
            <option value={20}>20개</option>
            <option value={50}>50개</option>
          </select>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>신청일시</th>
              <th>이름</th>
              <th>아이디</th>
              <th>연락처</th>
              <th>직책/역할</th>
              <th>소속 팀</th>
              <th>신청 메모</th>
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
                <td>{item.positionName ?? '-'}</td>
                <td>{item.teamName ?? '-'}</td>
                <td>{item.requestNote ?? '-'}</td>
                <td>{item.requestStatus}</td>
                <td>
                  {item.requestStatus === 'PENDING' ? (
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
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="toolbar">
          <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            이전
          </button>
          <span className="muted">
            {data?.page ?? page} / {data?.totalPages ?? 0} 페이지
          </span>
          <button
            className="secondary-button"
            disabled={!data || page >= data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            다음
          </button>
        </div>
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
