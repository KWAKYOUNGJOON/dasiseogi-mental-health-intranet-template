import { useEffect, useState } from 'react'
import { fetchActivityLogs, type ActivityLogPage } from '../../features/admin/api/adminApi'
import { PageHeader } from '../../shared/components/PageHeader'

export function AdminLogsPage() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userId, setUserId] = useState('')
  const [actionType, setActionType] = useState('')
  const [data, setData] = useState<ActivityLogPage | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setData(await fetchActivityLogs({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        userId: userId ? Number(userId) : undefined,
        actionType: actionType || undefined,
        page,
        size,
      }))
      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '활동 로그를 불러오지 못했습니다.')
    }
  }

  function handleSearch() {
    if (page === 1) {
      void load()
      return
    }
    setPage(1)
  }

  useEffect(() => {
    void load()
  }, [page, size])

  return (
    <div className="stack">
      <PageHeader description="성공한 주요 운영 행위를 최신순으로 확인합니다." title="활동 로그" />
      <div className="card stack">
        <div className="toolbar">
          <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
          <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
          <input
            onChange={(event) => setUserId(event.target.value)}
            placeholder="사용자 ID"
            type="number"
            value={userId}
          />
          <select onChange={(event) => setActionType(event.target.value)} value={actionType}>
            <option value="">전체 액션</option>
            <option value="LOGIN">LOGIN</option>
            <option value="SIGNUP_REQUEST">SIGNUP_REQUEST</option>
            <option value="SIGNUP_APPROVE">SIGNUP_APPROVE</option>
            <option value="SIGNUP_REJECT">SIGNUP_REJECT</option>
            <option value="USER_ROLE_CHANGE">USER_ROLE_CHANGE</option>
            <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
            <option value="CLIENT_CREATE">CLIENT_CREATE</option>
            <option value="CLIENT_UPDATE">CLIENT_UPDATE</option>
            <option value="CLIENT_MARK_MISREGISTERED">CLIENT_MARK_MISREGISTERED</option>
            <option value="SESSION_CREATE">SESSION_CREATE</option>
            <option value="SESSION_MARK_MISENTERED">SESSION_MARK_MISENTERED</option>
            <option value="PRINT_SESSION">PRINT_SESSION</option>
            <option value="STATISTICS_EXPORT">STATISTICS_EXPORT</option>
            <option value="BACKUP_RUN">BACKUP_RUN</option>
          </select>
          <select onChange={(event) => setSize(Number(event.target.value))} value={size}>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
          </select>
          <button className="secondary-button" onClick={handleSearch}>
            조회
          </button>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        <table className="table">
          <thead>
            <tr>
              <th>일시</th>
              <th>사용자</th>
              <th>IP</th>
              <th>액션</th>
              <th>대상</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.createdAt}</td>
                <td>{item.userNameSnapshot ?? '-'}{item.userId ? ` (#${item.userId})` : ''}</td>
                <td>{item.ipAddress ?? '-'}</td>
                <td>{item.actionType}</td>
                <td>
                  {[item.targetType, item.targetLabel ?? item.targetId?.toString()].filter(Boolean).join(' / ') || '-'}
                </td>
                <td>{item.description ?? '-'}</td>
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
    </div>
  )
}
