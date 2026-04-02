import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchClients, type ClientListPage } from '../../features/clients/api/clientApi'
import { DateTextInput } from '../../shared/components/DateTextInput'
import { PageHeader } from '../../shared/components/PageHeader'
import { toValidDateText } from '../../shared/utils/dateText'

const DEFAULT_PAGE_SIZE = 20

export function ClientListPage() {
  const [clientPage, setClientPage] = useState<ClientListPage | null>(null)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [includeMisregistered, setIncludeMisregistered] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  async function load(nextPage = page) {
    setLoading(true)
    try {
      const data = await fetchClients({
        name,
        birthDate: toValidDateText(birthDate) || undefined,
        includeMisregistered,
        page: nextPage,
        size: DEFAULT_PAGE_SIZE,
      })
      setClientPage(data)
      setPage(nextPage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="stack">
      <PageHeader
        actions={
          <Link className="primary-button" to="/clients/new">
            대상자 등록
          </Link>
        }
        description="로그인 후 기본 진입 화면입니다."
        title="대상자 목록"
      />
      <div className="card">
        <div className="toolbar">
          <input onChange={(event) => setName(event.target.value)} placeholder="이름 검색" value={name} />
          <DateTextInput
            aria-label="생년월일"
            onChange={setBirthDate}
            value={birthDate}
          />
          <label className="option-item">
            <input checked={includeMisregistered} onChange={(event) => setIncludeMisregistered(event.target.checked)} type="checkbox" />
            오등록 포함
          </label>
          <button className="secondary-button" onClick={() => void load(1)}>
            검색
          </button>
        </div>
        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>생년월일</th>
                  <th>성별</th>
                  <th>사례번호</th>
                  <th>담당자</th>
                  <th>최근 검사일</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(clientPage?.items ?? []).map((client) => (
                  <tr key={client.id}>
                    <td>{client.name}</td>
                    <td>{client.birthDate}</td>
                    <td>{client.gender}</td>
                    <td>{client.clientNo}</td>
                    <td>{client.primaryWorkerName}</td>
                    <td>{client.latestSessionDate ?? '-'}</td>
                    <td>{client.status}</td>
                    <td>
                      <Link className="secondary-button" to={`/clients/${client.id}`}>
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <span className="muted">
                {clientPage?.totalItems ?? 0}건 / {clientPage?.page ?? 1}페이지
              </span>
              <div className="actions">
                <button className="secondary-button" disabled={page <= 1} onClick={() => void load(page - 1)}>
                  이전
                </button>
                <button
                  className="secondary-button"
                  disabled={!clientPage || clientPage.totalPages === 0 || page >= clientPage.totalPages}
                  onClick={() => void load(page + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
