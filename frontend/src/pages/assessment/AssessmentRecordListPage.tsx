import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  fetchAssessmentRecords,
  fetchScales,
  type AssessmentRecordPage,
  type ScaleListItem,
} from '../../features/assessment/api/assessmentApi'
import { DateTextInput } from '../../shared/components/DateTextInput'
import { PageHeader } from '../../shared/components/PageHeader'
import { formatAssessmentLocalDateTimeText, toValidDateText } from '../../shared/utils/dateText'

const DEFAULT_SIZE = 20
const ASSESSMENT_RECORD_SCALE_NAME_BY_CODE: Record<string, string> = {
  PHQ9: 'PHQ-9',
  GAD7: 'GAD-7',
  MKPQ16: 'mKPQ-16',
  KMDQ: 'K-MDQ',
  PSS10: 'PSS-10',
  ISIK: 'ISI-K',
  AUDITK: 'AUDIT-K',
  IESR: 'IES-R',
  CRI: 'CRI',
}
const ASSESSMENT_RECORD_SCALE_DESCRIPTION_BY_CODE: Record<string, string> = {
  PHQ9: '우울',
  GAD7: '불안',
  MKPQ16: '정신증 위험',
  KMDQ: '양극성(조울증)',
  PSS10: '스트레스',
  ISIK: '불면',
  AUDITK: '알코올 사용',
  IESR: '외상 후 스트레스(PTSD)',
  CRI: '정신과적 위기 분류',
}

interface RecordFilters {
  dateFrom: string
  dateTo: string
  clientName: string
  scaleCode: string
  includeMisentered: boolean
}

function createFilters(searchParams: URLSearchParams): RecordFilters {
  return {
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
    clientName: searchParams.get('clientName') ?? '',
    scaleCode: searchParams.get('scaleCode') ?? '',
    includeMisentered: searchParams.get('includeMisentered') === 'true',
  }
}

function parsePage(searchParams: URLSearchParams) {
  const rawPage = Number(searchParams.get('page') ?? '1')

  return Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
}

function createRecordSearchParams(filters: RecordFilters, page: number) {
  const params = new URLSearchParams()
  const dateFrom = toValidDateText(filters.dateFrom)
  const dateTo = toValidDateText(filters.dateTo)

  if (dateFrom) {
    params.set('dateFrom', dateFrom)
  }
  if (dateTo) {
    params.set('dateTo', dateTo)
  }
  if (filters.clientName) {
    params.set('clientName', filters.clientName)
  }
  if (filters.scaleCode) {
    params.set('scaleCode', filters.scaleCode)
  }
  if (filters.includeMisentered) {
    params.set('includeMisentered', 'true')
  }
  if (page > 1) {
    params.set('page', String(page))
  }

  return params
}

function buildSessionDetailPath(
  record: AssessmentRecordPage['items'][number],
  returnTo: string,
) {
  const params = new URLSearchParams()
  const highlightScaleCode = record.scaleCode?.trim()

  if (highlightScaleCode) {
    params.set('highlightScaleCode', highlightScaleCode)
  }

  params.set('returnTo', returnTo)

  const search = params.toString()

  return search
    ? `/assessments/sessions/${record.sessionId}?${search}`
    : `/assessments/sessions/${record.sessionId}`
}

function formatAssessmentRecordScaleOptionLabel(item: ScaleListItem) {
  const description = ASSESSMENT_RECORD_SCALE_DESCRIPTION_BY_CODE[item.scaleCode]

  if (description) {
    return `${item.scaleName} (${description})`
  }

  return `${item.scaleName} (${item.scaleCode})`
}

function formatAssessmentRecordScaleCellLabel(record: AssessmentRecordPage['items'][number]) {
  const scaleCode = record.scaleCode?.trim()

  if (scaleCode) {
    const shortLabel = ASSESSMENT_RECORD_SCALE_NAME_BY_CODE[scaleCode]

    if (shortLabel) {
      return shortLabel
    }
  }

  return record.scaleName || scaleCode || ''
}

export function AssessmentRecordListPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [records, setRecords] = useState<AssessmentRecordPage | null>(null)
  const [scaleItems, setScaleItems] = useState<ScaleListItem[]>([])
  const [filters, setFilters] = useState(() => createFilters(searchParams))
  const [appliedFilters, setAppliedFilters] = useState(() => createFilters(searchParams))
  const [page, setPage] = useState(() => parsePage(searchParams))
  const [loading, setLoading] = useState(true)
  const [scaleLoading, setScaleLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scaleError, setScaleError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  useEffect(() => {
    void loadScaleOptions()
    void load(parsePage(searchParams), createFilters(searchParams))
  }, [])

  const sortedScaleItems = useMemo(
    () => [...scaleItems].sort((left, right) => left.displayOrder - right.displayOrder),
    [scaleItems],
  )

  async function loadScaleOptions() {
    setScaleLoading(true)

    try {
      const data = await fetchScales()
      setScaleItems(data)
      setScaleError(null)
    } catch (requestError: any) {
      setScaleItems([])
      setScaleError(requestError?.response?.data?.message ?? '척도 목록을 불러오지 못했습니다.')
    } finally {
      setScaleLoading(false)
    }
  }

  async function load(nextPage: number, nextFilters: RecordFilters) {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId

    setLoading(true)
    setError(null)
    setPage(nextPage)
    setAppliedFilters(nextFilters)

    try {
      const data = await fetchAssessmentRecords({
        dateFrom: toValidDateText(nextFilters.dateFrom) || undefined,
        dateTo: toValidDateText(nextFilters.dateTo) || undefined,
        clientName: nextFilters.clientName || undefined,
        scaleCode: nextFilters.scaleCode || undefined,
        includeMisentered: nextFilters.includeMisentered,
        page: nextPage,
        size: DEFAULT_SIZE,
      })
      if (requestId !== requestSequence.current) {
        return
      }

      const resolvedPage = data.page > 0 ? data.page : nextPage
      const nextSearchParams = createRecordSearchParams(nextFilters, resolvedPage)
      const nextSearch = nextSearchParams.toString()

      setRecords(data)
      setPage(resolvedPage)
      setError(null)
      if (location.search !== (nextSearch ? `?${nextSearch}` : '')) {
        setSearchParams(nextSearchParams, { replace: true })
      }
    } catch (requestError: any) {
      if (requestId !== requestSequence.current) {
        return
      }

      setRecords(null)
      setError(requestError?.response?.data?.message ?? '검사기록 목록을 불러오지 못했습니다.')
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
      }
    }
  }

  function handleFilterChange<K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleSearch() {
    if (loading) {
      return
    }

    void load(1, filters)
  }

  function handleRetry() {
    if (loading) {
      return
    }

    void load(page, appliedFilters)
  }

  const returnTo = `${location.pathname}${location.search}`

  return (
    <div className="stack">
      <PageHeader description="척도 결과 1건 단위로 조회합니다." title="검사기록 목록" />
      <div className="card">
        <div className="toolbar">
          <DateTextInput
            aria-label="시작일"
            onChange={(value) => handleFilterChange('dateFrom', value)}
            placeholder="시작일 (연도. 월. 일.)"
            value={filters.dateFrom}
          />
          <DateTextInput
            aria-label="종료일"
            onChange={(value) => handleFilterChange('dateTo', value)}
            placeholder="종료일 (연도. 월. 일.)"
            value={filters.dateTo}
          />
          <input
            onChange={(event) => handleFilterChange('clientName', event.target.value)}
            placeholder="대상자명"
            value={filters.clientName}
          />
          <select
            disabled={scaleLoading}
            onChange={(event) => handleFilterChange('scaleCode', event.target.value)}
            value={filters.scaleCode}
          >
            <option value="">{scaleLoading ? '척도 목록 불러오는 중...' : '전체 척도'}</option>
            {sortedScaleItems.map((item) => (
              <option key={item.scaleCode} value={item.scaleCode}>
                {formatAssessmentRecordScaleOptionLabel(item)}
              </option>
            ))}
          </select>
          <label className="option-item">
            <input
              checked={filters.includeMisentered}
              onChange={(event) => handleFilterChange('includeMisentered', event.target.checked)}
              type="checkbox"
            />
            오입력 포함
          </label>
          <button className="secondary-button" disabled={loading} onClick={handleSearch} type="button">
            조회
          </button>
        </div>
        {scaleError ? (
          <p className="error-text" style={{ margin: '0 0 16px' }}>
            {scaleError}
          </p>
        ) : null}
        {loading ? (
          <div aria-busy="true" className="muted">
            검사기록 목록을 불러오는 중...
          </div>
        ) : error ? (
          <div className="stack" role="alert">
            <p className="error-text" style={{ margin: 0 }}>
              {error}
            </p>
            <div className="actions">
              <button className="secondary-button" onClick={handleRetry} type="button">
                다시 시도
              </button>
            </div>
          </div>
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
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {records.items.map((record) => (
                  <tr key={record.sessionScaleId}>
                    <td>{formatAssessmentLocalDateTimeText(record.sessionCompletedAt)}</td>
                    <td>{record.clientName}</td>
                    <td>{record.performedByName}</td>
                    <td>{formatAssessmentRecordScaleCellLabel(record)}</td>
                    <td>{record.totalScore}</td>
                    <td>{record.resultLevel}</td>
                    <td>{record.hasAlert ? '있음' : '없음'}</td>
                    <td>
                      <span
                        className={record.sessionStatus === 'MISENTERED' ? 'status-chip status-chip-danger' : 'status-chip'}
                        data-status={record.sessionStatus}
                        data-testid={`record-status-${record.sessionScaleId}`}
                      >
                        {record.sessionStatus === 'MISENTERED' ? '오입력' : '정상'}
                      </span>
                    </td>
                    <td>
                      <Link className="secondary-button" to={buildSessionDetailPath(record, returnTo)}>
                        상세 보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <span className="muted">
                {records.totalItems}건 / {records.page}페이지
              </span>
              <div className="actions">
                <button
                  className="secondary-button"
                  disabled={loading || page <= 1}
                  onClick={() => void load(page - 1, appliedFilters)}
                  type="button"
                >
                  이전
                </button>
                <button
                  className="secondary-button"
                  disabled={loading || !records || records.totalPages === 0 || page >= records.totalPages}
                  onClick={() => void load(page + 1, appliedFilters)}
                  type="button"
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
