import { useEffect, useState } from 'react'
import { fetchBackups, runManualBackup, type BackupHistoryPage } from '../../features/admin/api/adminApi'
import { PageHeader } from '../../shared/components/PageHeader'

function formatFileSize(fileSizeBytes: number | null) {
  if (!fileSizeBytes) {
    return '-'
  }
  if (fileSizeBytes < 1024) {
    return `${fileSizeBytes} B`
  }
  if (fileSizeBytes < 1024 * 1024) {
    return `${(fileSizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AdminBackupsPage() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [backupType, setBackupType] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reason, setReason] = useState('')
  const [running, setRunning] = useState(false)
  const [data, setData] = useState<BackupHistoryPage | null>(null)
  const [latestAutoBackup, setLatestAutoBackup] = useState<BackupHistoryPage['items'][number] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const [historyPage, autoPage] = await Promise.all([
        fetchBackups({
          backupType: backupType || undefined,
          status: status || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          size,
        }),
        fetchBackups({
          backupType: 'AUTO',
          page: 1,
          size: 1,
        }),
      ])
      setData(historyPage)
      setLatestAutoBackup(autoPage.items[0] ?? null)
      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '백업 이력을 불러오지 못했습니다.')
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

  async function handleRunBackup() {
    setRunning(true)
    try {
      await runManualBackup(reason)
      setReason('')
      if (page === 1) {
        await load()
      } else {
        setPage(1)
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '수동 백업 실행에 실패했습니다.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader description="MariaDB/MySQL은 DB dump를 우선 시도하고, 그 외 환경은 snapshot ZIP으로 백업합니다." title="백업 관리" />
      <div className="card stack">
        <div className="field">
          <span className="muted">마지막 자동 백업</span>
          <strong>{latestAutoBackup?.completedAt ?? latestAutoBackup?.startedAt ?? '아직 자동 백업 이력이 없습니다.'}</strong>
          {latestAutoBackup ? (
            <span className="muted">
              {latestAutoBackup.status} / {latestAutoBackup.backupMethod} / {latestAutoBackup.filePath}
            </span>
          ) : null}
        </div>
        <div className="field">
          <span className="muted">실행 사유</span>
          <textarea onChange={(event) => setReason(event.target.value)} rows={3} value={reason} />
        </div>
        <div className="actions">
          <button className="secondary-button" disabled={running} onClick={() => void handleRunBackup()}>
            {running ? '백업 실행 중...' : '수동 백업 실행'}
          </button>
        </div>
      </div>
      <div className="card stack">
        <div className="toolbar">
          <select onChange={(event) => setBackupType(event.target.value)} value={backupType}>
            <option value="">전체 유형</option>
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">전체 상태</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>
          <select onChange={(event) => setSize(Number(event.target.value))} value={size}>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
          </select>
          <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
          <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
          <button className="secondary-button" onClick={handleSearch}>
            조회
          </button>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        <table className="table">
          <thead>
            <tr>
              <th>시작</th>
              <th>완료</th>
              <th>유형</th>
              <th>방식</th>
              <th>상태</th>
              <th>파일명</th>
              <th>크기</th>
              <th>실행자</th>
              <th>실패 사유</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.backupId}>
                <td>{item.startedAt}</td>
                <td>{item.completedAt ?? '-'}</td>
                <td>{item.backupType}</td>
                <td>{item.backupMethod}</td>
                <td>{item.status}</td>
                <td>
                  <div>{item.fileName}</div>
                  <div className="muted">{item.filePath}</div>
                </td>
                <td>{formatFileSize(item.fileSizeBytes)}</td>
                <td>{item.executedByName ?? '-'}</td>
                <td>{item.failureReason ?? '-'}</td>
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
