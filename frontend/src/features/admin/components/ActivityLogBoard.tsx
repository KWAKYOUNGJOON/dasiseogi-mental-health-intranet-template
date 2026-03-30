import { isAxiosError } from 'axios'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { ApiResponse } from '../../../shared/types/api'
import {
  ACTIVITY_LOG_ACTION_OPTIONS,
  ACTIVITY_LOG_PAGE_SIZE_OPTIONS,
  DEFAULT_ACTIVITY_LOG_PAGE_SIZE,
  fetchActivityLogPage,
  type ActivityLogActionType,
  type ActivityLogPage,
  type ActivityLogPageSize,
  type ActivityLogQuery,
} from '../api/activityLogManagementApi'

interface FilterState {
  dateFrom: string
  dateTo: string
  userId: string
  actionType: '' | ActivityLogActionType
  pageSize: ActivityLogPageSize
}

function createDefaultFilters(): FilterState {
  return {
    dateFrom: '',
    dateTo: '',
    userId: '',
    actionType: '',
    pageSize: DEFAULT_ACTIVITY_LOG_PAGE_SIZE,
  }
}

const EMPTY_STATE_MESSAGE = '조건에 맞는 로그가 없습니다.'
const INVALID_DATE_RANGE_MESSAGE = '조회 기간을 다시 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.'
const INVALID_USER_ID_MESSAGE = '사용자 ID는 1 이상의 숫자로 입력해주세요.'
const GENERIC_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const GENERIC_LIST_ERROR_MESSAGE = '로그 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

function getApiResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return undefined
  }

  return error.response?.data
}

function getListErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_LIST_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return response.message?.trim() || '관리자 권한이 필요합니다.'
    case 'INVALID_DATE_RANGE':
      return response.message?.trim() || '조회 기간을 다시 확인해주세요.'
    case 'VALIDATION_ERROR':
      return response.message?.trim() || GENERIC_VALIDATION_MESSAGE
    default:
      return GENERIC_LIST_ERROR_MESSAGE
  }
}

function parsePageSize(value: string): ActivityLogPageSize {
  const parsedValue = Number(value)
  const matchedOption = ACTIVITY_LOG_PAGE_SIZE_OPTIONS.find((option) => option === parsedValue)

  return matchedOption ?? DEFAULT_ACTIVITY_LOG_PAGE_SIZE
}

function buildQuery(filters: FilterState): Omit<ActivityLogQuery, 'page'> {
  const trimmedUserId = filters.userId.trim()

  return {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    userId: trimmedUserId ? Number(trimmedUserId) : undefined,
    actionType: filters.actionType || undefined,
    size: filters.pageSize,
  }
}

function hasInvalidDateRange(filters: FilterState) {
  if (!filters.dateFrom || !filters.dateTo) {
    return false
  }

  return filters.dateFrom > filters.dateTo
}

function hasInvalidUserId(filters: FilterState) {
  const trimmedUserId = filters.userId.trim()
  if (!trimmedUserId) {
    return false
  }

  return !/^\d+$/.test(trimmedUserId) || Number(trimmedUserId) < 1
}

export function ActivityLogBoard() {
  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters())
  const [query, setQuery] = useState<FilterState>(() => createDefaultFilters())
  const [page, setPage] = useState(1)
  const [logPage, setLogPage] = useState<ActivityLogPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetchActivityLogPage({
        ...buildQuery(query),
        page,
      })

      setLogPage(response)
      setListError(null)
    } catch (error) {
      setLogPage(null)
      setListError(getListErrorMessage(getApiResponse(error)))
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (hasInvalidDateRange(filters)) {
      setFilterError(INVALID_DATE_RANGE_MESSAGE)
      setListError(null)
      return
    }

    if (hasInvalidUserId(filters)) {
      setFilterError(INVALID_USER_ID_MESSAGE)
      setListError(null)
      return
    }

    setFilterError(null)
    setListError(null)
    setQuery({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      userId: filters.userId.trim(),
      actionType: filters.actionType,
      pageSize: filters.pageSize,
    })
    setPage(1)
  }

  function handleReset() {
    const nextFilters = createDefaultFilters()

    setFilters(nextFilters)
    setQuery(nextFilters)
    setFilterError(null)
    setListError(null)
    setPage(1)
  }

  const items = logPage?.items ?? []
  const currentPage = logPage?.page ?? page
  const totalPages = logPage && logPage.totalPages > 0 ? logPage.totalPages : 1

  return (
    <div className="stack">
      <PageHeader description="주요 운영 행위를 최신순으로 조회합니다." title="로그 확인" />

      <form className="card stack" noValidate onSubmit={handleSearch}>
        <div className="management-filter-grid">
          <label className="field">
            <span>시작일</span>
            <input
              aria-label="시작일"
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              type="date"
              value={filters.dateFrom}
            />
          </label>
          <label className="field">
            <span>종료일</span>
            <input
              aria-label="종료일"
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              type="date"
              value={filters.dateTo}
            />
          </label>
          <label className="field">
            <span>사용자 ID</span>
            <input
              aria-label="사용자 ID"
              inputMode="numeric"
              onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))}
              placeholder="숫자 ID"
              type="text"
              value={filters.userId}
            />
          </label>
          <label className="field">
            <span>기능 유형</span>
            <select
              aria-label="기능 유형"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  actionType: event.target.value as FilterState['actionType'],
                }))
              }
              value={filters.actionType}
            >
              <option value="">전체 기능</option>
              {ACTIVITY_LOG_ACTION_OPTIONS.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionType}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>페이지 크기</span>
            <select
              aria-label="페이지 크기"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  pageSize: parsePageSize(event.target.value),
                }))
              }
              value={String(filters.pageSize)}
            >
              {ACTIVITY_LOG_PAGE_SIZE_OPTIONS.map((pageSizeOption) => (
                <option key={pageSizeOption} value={pageSizeOption}>
                  {pageSizeOption}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions">
          <button className="primary-button" disabled={loading} type="submit">
            조회
          </button>
          <button className="secondary-button" disabled={loading} onClick={handleReset} type="button">
            초기화
          </button>
        </div>

        {filterError ? (
          <div className="error-text" role="alert">
            {filterError}
          </div>
        ) : null}
      </form>

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>총 {logPage?.totalItems ?? 0}건</strong>
          <span className="muted">조회 전용 화면입니다. 수정이나 삭제 기능은 제공하지 않습니다.</span>
          <button className="secondary-button" disabled={loading} onClick={() => void loadLogs()} type="button">
            재조회
          </button>
        </div>

        {listError ? (
          <div className="stack" role="alert" style={{ gap: 8 }}>
            <div className="error-text">{listError}</div>
            <div className="actions">
              <button className="secondary-button" disabled={loading} onClick={() => void loadLogs()} type="button">
                다시 시도
              </button>
            </div>
          </div>
        ) : null}

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
            {loading ? (
              <tr>
                <td className="muted" colSpan={6}>
                  로그를 불러오는 중입니다.
                </td>
              </tr>
            ) : listError ? (
              <tr>
                <td className="muted" colSpan={6}>
                  로그 조회에 실패했습니다.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="muted" colSpan={6}>
                  {EMPTY_STATE_MESSAGE}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.occurredAt}</td>
                  <td>{item.userLabel}</td>
                  <td>{item.ipAddress}</td>
                  <td>{item.actionType}</td>
                  <td>
                    <div
                      style={{
                        maxWidth: 320,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      title={item.target !== '-' ? item.target : undefined}
                    >
                      {item.target}
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        maxWidth: 320,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      title={item.description !== '-' ? item.description : undefined}
                    >
                      {item.description}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button className="secondary-button" disabled={loading || currentPage <= 1} onClick={() => setPage((value) => value - 1)} type="button">
            이전
          </button>
          <span className="muted">
            {currentPage} / {totalPages} 페이지
          </span>
          <button
            className="secondary-button"
            disabled={loading || !logPage || logPage.totalPages <= 1 || currentPage >= logPage.totalPages}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  )
}
