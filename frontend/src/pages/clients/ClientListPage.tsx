import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchClients, type ClientListPage } from '../../features/clients/api/clientApi'
import { DateTextInput } from '../../shared/components/DateTextInput'
import { PageHeader } from '../../shared/components/PageHeader'
import { toValidDateText } from '../../shared/utils/dateText'

const DEFAULT_PAGE_SIZE = 20
const CLIENT_LIST_ERROR_MESSAGE = '대상자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const EMPTY_CLIENTS_MESSAGE = '등록된 대상자가 없습니다.'
const EMPTY_SEARCH_RESULTS_MESSAGE = '검색 조건에 맞는 대상자가 없습니다.'
const GENDER_LABELS: Record<string, string> = {
  MALE: '남성',
  FEMALE: '여성',
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  MISREGISTERED: '오등록',
}

function toDisplayLabel(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) {
    return '-'
  }

  return labels[value] ?? value
}

export function ClientListPage() {
  const [clientPage, setClientPage] = useState<ClientListPage | null>(null)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [includeMisregistered, setIncludeMisregistered] = useState(false)
  const [page, setPage] = useState(1)
  const [requestedPage, setRequestedPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasActiveFilters = name.trim() !== '' || birthDate.trim() !== '' || includeMisregistered
  const items = clientPage?.items ?? []
  const emptyMessage = hasActiveFilters ? EMPTY_SEARCH_RESULTS_MESSAGE : EMPTY_CLIENTS_MESSAGE

  async function load(nextPage = page) {
    setLoading(true)
    setError(null)
    setRequestedPage(nextPage)
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
    } catch {
      setError(CLIENT_LIST_ERROR_MESSAGE)
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
          <button className="secondary-button" onClick={() => void load(1)} type="button">
            검색
          </button>
        </div>
        {loading ? (
          <div aria-busy="true" className="muted">
            대상자 목록을 불러오는 중입니다.
          </div>
        ) : error ? (
          <div className="stack" role="alert">
            <p className="error-text" style={{ margin: 0 }}>
              {error}
            </p>
            <div className="actions">
              <button className="secondary-button" onClick={() => void load(requestedPage)} type="button">
                다시 시도
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {emptyMessage}
          </p>
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
                {items.map((client) => (
                  <tr key={client.id}>
                    <td>{client.name}</td>
                    <td>{client.birthDate}</td>
                    <td>{toDisplayLabel(client.gender, GENDER_LABELS)}</td>
                    <td>{client.clientNo}</td>
                    <td>{client.primaryWorkerName}</td>
                    <td>{client.latestSessionDate ?? '-'}</td>
                    <td>{toDisplayLabel(client.status, STATUS_LABELS)}</td>
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
