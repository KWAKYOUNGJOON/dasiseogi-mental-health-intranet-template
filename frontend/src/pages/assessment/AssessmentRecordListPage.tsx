import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAssessmentRecords, type AssessmentRecordPage } from '../../features/assessment/api/assessmentApi'
import { PageHeader } from '../../shared/components/PageHeader'

const DEFAULT_SIZE = 20

export function AssessmentRecordListPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<AssessmentRecordPage | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [clientName, setClientName] = useState('')
  const [scaleCode, setScaleCode] = useState('')
  const [includeMisentered, setIncludeMisentered] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load(1)
  }, [])

  async function load(nextPage = page) {
    setLoading(true)
    try {
      const data = await fetchAssessmentRecords({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        clientName: clientName || undefined,
        scaleCode: scaleCode || undefined,
        includeMisentered,
        page: nextPage,
        size: DEFAULT_SIZE,
      })
      setRecords(data)
      setPage(nextPage)
      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '검사기록 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader description="척도 결과 1건 단위로 조회합니다." title="검사기록 목록" />
      <div className="card">
        <div className="toolbar">
          <input onChange={(event) => setDateFrom(event.target.value)} placeholder="시작일 YYYY-MM-DD" value={dateFrom} />
          <input onChange={(event) => setDateTo(event.target.value)} placeholder="종료일 YYYY-MM-DD" value={dateTo} />
          <input onChange={(event) => setClientName(event.target.value)} placeholder="대상자명" value={clientName} />
          <input onChange={(event) => setScaleCode(event.target.value)} placeholder="척도코드 예: PHQ9" value={scaleCode} />
          <label className="option-item">
            <input checked={includeMisentered} onChange={(event) => setIncludeMisentered(event.target.checked)} type="checkbox" />
            오입력 포함
          </label>
          <button className="secondary-button" onClick={() => void load(1)}>
            조회
          </button>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        {loading ? (
          <p>불러오는 중...</p>
        ) : records && records.items.length > 0 ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>검사일시</th>
                  <th>대상자</th>
                  <th>담당자</th>
                  <th>척도</th>
                  <th>총점</th>
                  <th>판정</th>
                  <th>경고</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {records.items.map((record) => (
                  <tr
                    className="clickable-row"
                    key={record.sessionScaleId}
                    onClick={() => navigate(`/assessments/sessions/${record.sessionId}?highlightScaleCode=${record.scaleCode}`)}
                  >
                    <td>{record.sessionCompletedAt}</td>
                    <td>{record.clientName}</td>
                    <td>{record.performedByName}</td>
                    <td>{record.scaleName}</td>
                    <td>{record.totalScore}</td>
                    <td>{record.resultLevel}</td>
                    <td>{record.hasAlert ? '있음' : '없음'}</td>
                    <td>{record.sessionStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <span className="muted">
                {records.totalItems}건 / {records.page}페이지
              </span>
              <div className="actions">
                <button className="secondary-button" disabled={page <= 1} onClick={() => void load(page - 1)}>
                  이전
                </button>
                <button
                  className="secondary-button"
                  disabled={!records || records.totalPages === 0 || page >= records.totalPages}
                  onClick={() => void load(page + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">조회된 검사기록이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
