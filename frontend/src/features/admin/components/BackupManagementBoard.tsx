import { isAxiosError } from 'axios'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { DateTextInput } from '../../../shared/components/DateTextInput'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { ApiResponse } from '../../../shared/types/api'
import { toValidDateText } from '../../../shared/utils/dateText'
import {
  BACKUP_STATUS_OPTIONS,
  BACKUP_TYPE_OPTIONS,
  fetchBackupHistoryPage,
  fetchLatestBackupHistory,
  runManualBackup,
  type BackupHistoryItem,
  type BackupHistoryPage,
  type BackupHistoryQuery,
  type BackupStatus,
  type BackupType,
} from '../api/backupManagementApi'

type Notice = { type: 'success' | 'error'; text: string } | null
type DialogFieldErrors = Partial<Record<'reason', string>>

interface FilterState {
  backupType: '' | BackupType
  status: '' | BackupStatus
  dateFrom: string
  dateTo: string
}

function createDefaultFilters(): FilterState {
  return {
    backupType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  }
}

const PAGE_SIZE = 20
const EMPTY_STATE_MESSAGE = '조건에 맞는 백업 이력이 없습니다.'
const INVALID_DATE_RANGE_MESSAGE = '조회 기간을 다시 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.'
const GENERIC_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const GENERIC_LIST_ERROR_MESSAGE = '백업 이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_RUN_ERROR_MESSAGE = '수동 백업 실행에 실패했습니다. 잠시 후 다시 시도해주세요.'
const BACKUP_PATH_GUIDE = '백업 저장 경로는 운영 설정(APP_BACKUP_ROOT_PATH)을 따릅니다.'

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

function getRunErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_RUN_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
    case 'BACKUP_RUN_FORBIDDEN':
      return response.message?.trim() || '수동 백업 실행 권한이 없습니다.'
    case 'BACKUP_ALREADY_RUNNING':
      return response.message?.trim() || '이미 백업이 실행 중입니다.'
    case 'BACKUP_PATH_NOT_WRITABLE':
      return response.message?.trim() || '백업 경로를 사용할 수 없습니다.'
    case 'BACKUP_RUN_FAILED':
      return response.message?.trim() || '백업 실행에 실패했습니다.'
    case 'VALIDATION_ERROR':
      return response.message?.trim() || GENERIC_VALIDATION_MESSAGE
    default:
      return GENERIC_RUN_ERROR_MESSAGE
  }
}

function mapDialogFieldErrors(response: ApiResponse<unknown> | undefined): DialogFieldErrors {
  return (response?.fieldErrors ?? []).reduce<DialogFieldErrors>((errors, fieldError) => {
    if (fieldError.field === 'reason') {
      errors.reason = fieldError.reason
    }

    return errors
  }, {})
}

function getStatusChipStyle(status: BackupStatus): CSSProperties {
  if (status === 'SUCCESS') {
    return {
      color: '#1d6a53',
      background: '#dff1ea',
    }
  }

  return {
    color: '#9d2f2f',
    background: '#f8e1e1',
  }
}

function buildQuery(filters: FilterState): Omit<BackupHistoryQuery, 'page' | 'size'> {
  return {
    backupType: filters.backupType || undefined,
    status: filters.status || undefined,
    dateFrom: toValidDateText(filters.dateFrom) || undefined,
    dateTo: toValidDateText(filters.dateTo) || undefined,
  }
}

function hasInvalidDateRange(filters: FilterState) {
  const dateFrom = toValidDateText(filters.dateFrom)
  const dateTo = toValidDateText(filters.dateTo)

  if (!dateFrom || !dateTo) {
    return false
  }

  return dateFrom > dateTo
}

function getLatestBackupTimestamp(latestBackup: BackupHistoryItem | null) {
  if (!latestBackup) {
    return '아직 백업 이력이 없습니다.'
  }

  return latestBackup.completedAt !== '-' ? latestBackup.completedAt : latestBackup.startedAt
}

function getLatestBackupPath(latestBackup: BackupHistoryItem | null) {
  if (!latestBackup || latestBackup.filePath === '-') {
    return BACKUP_PATH_GUIDE
  }

  return latestBackup.filePath
}

export function BackupManagementBoard() {
  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters())
  const [query, setQuery] = useState<FilterState>(() => createDefaultFilters())
  const [page, setPage] = useState(1)
  const [historyPage, setHistoryPage] = useState<BackupHistoryPage | null>(null)
  const [latestBackup, setLatestBackup] = useState<BackupHistoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reasonDraft, setReasonDraft] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogFieldErrors, setDialogFieldErrors] = useState<DialogFieldErrors>({})
  const [processing, setProcessing] = useState(false)

  const loadBackups = useCallback(async () => {
    setLoading(true)

    try {
      const [pageResponse, latestResponse] = await Promise.all([
        fetchBackupHistoryPage({
          ...buildQuery(query),
          page,
          size: PAGE_SIZE,
        }),
        fetchLatestBackupHistory(),
      ])

      setHistoryPage(pageResponse)
      setLatestBackup(latestResponse)
      setListError(null)
    } catch (error) {
      setListError(getListErrorMessage(getApiResponse(error)))
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (hasInvalidDateRange(filters)) {
      setFilterError(INVALID_DATE_RANGE_MESSAGE)
      return
    }

    setFilterError(null)
    setListError(null)
    setQuery({
      backupType: filters.backupType,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
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

  function openDialog() {
    if (processing) {
      return
    }

    setNotice(null)
    setDialogError(null)
    setDialogFieldErrors({})
    setReasonDraft('')
    setDialogOpen(true)
  }

  function closeDialog() {
    if (processing) {
      return
    }

    setDialogOpen(false)
    setDialogError(null)
    setDialogFieldErrors({})
    setReasonDraft('')
  }

  async function reloadAfterRun() {
    if (page === 1) {
      await loadBackups()
      return
    }

    setPage(1)
  }

  async function handleConfirmRun() {
    if (processing) {
      return
    }

    setProcessing(true)
    setNotice(null)
    setDialogError(null)
    setDialogFieldErrors({})

    try {
      const result = await runManualBackup(reasonDraft)

      setDialogOpen(false)
      setReasonDraft('')
      setNotice({
        type: 'success',
        text: `수동 백업을 실행했습니다. ${result.backupMethod} 방식으로 ${result.fileName} 이 생성되었습니다.`,
      })
      await reloadAfterRun()
    } catch (error) {
      const response = getApiResponse(error)

      setDialogError(getRunErrorMessage(response))
      setDialogFieldErrors(mapDialogFieldErrors(response))
    } finally {
      setProcessing(false)
    }
  }

  const items = historyPage?.items ?? []
  const currentPage = historyPage?.page ?? page
  const totalPages = historyPage && historyPage.totalPages > 0 ? historyPage.totalPages : 1
  const latestBackupTimestamp = getLatestBackupTimestamp(latestBackup)
  const latestBackupPath = getLatestBackupPath(latestBackup)

  return (
    <div className="stack">
      <PageHeader description="최근 백업 상태를 확인하고 필요 시 수동 백업을 실행합니다." title="백업 관리" />

      {notice ? (
        notice.type === 'success' ? (
          <div className="success-panel" role="status">
            {notice.text}
          </div>
        ) : (
          <div className="error-text" role="alert">
            {notice.text}
          </div>
        )
      ) : null}

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>최근 백업 상태</strong>
          <span className="muted">가장 최근 이력을 기준으로 백업 상태와 저장 경로를 확인합니다.</span>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <span>가장 최근 백업 시각</span>
            <strong>{latestBackupTimestamp}</strong>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span>최근 백업 상태</span>
            {latestBackup ? (
              <span className="status-chip" style={getStatusChipStyle(latestBackup.status)}>
                {latestBackup.status}
              </span>
            ) : (
              <span className="muted">이력 없음</span>
            )}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span>저장 경로 안내</span>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              title={latestBackupPath}
            >
              {latestBackupPath}
            </div>
          </div>
        </div>
      </div>

      <div className="card stack" style={{ borderColor: '#d7c09b' }}>
        <div className="stack" style={{ gap: 8 }}>
          <strong>수동 백업 실행</strong>
          <p className="muted" style={{ margin: 0 }}>
            배포 전, 설정 변경 전, 척도 JSON 교체 전에는 수동 백업을 먼저 실행하는 것을 권장합니다.
          </p>
        </div>
        <div className="actions">
          <button className="danger-button" disabled={processing} onClick={openDialog} type="button">
            수동 백업 실행
          </button>
        </div>
      </div>

      <form className="card stack" noValidate onSubmit={handleSearch}>
        <div className="management-filter-grid">
          <label className="field">
            <span>백업 유형</span>
            <select
              aria-label="백업 유형"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  backupType: event.target.value as FilterState['backupType'],
                }))
              }
              value={filters.backupType}
            >
              <option value="">전체 유형</option>
              {BACKUP_TYPE_OPTIONS.map((backupType) => (
                <option key={backupType} value={backupType}>
                  {backupType}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>상태</span>
            <select
              aria-label="상태"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as FilterState['status'],
                }))
              }
              value={filters.status}
            >
              <option value="">전체 상태</option>
              {BACKUP_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>시작일</span>
            <DateTextInput
              aria-label="시작일"
              onChange={(dateFrom) => setFilters((prev) => ({ ...prev, dateFrom }))}
              value={filters.dateFrom}
            />
          </label>
          <label className="field">
            <span>종료일</span>
            <DateTextInput
              aria-label="종료일"
              onChange={(dateTo) => setFilters((prev) => ({ ...prev, dateTo }))}
              value={filters.dateTo}
            />
          </label>
          <div className="actions" style={{ alignSelf: 'end' }}>
            <button className="primary-button" disabled={loading} type="submit">
              조회
            </button>
            <button className="secondary-button" disabled={loading} onClick={handleReset} type="button">
              초기화
            </button>
          </div>
        </div>

        {filterError ? (
          <div className="error-text" role="alert">
            {filterError}
          </div>
        ) : null}
      </form>

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>총 {historyPage?.totalItems ?? 0}건</strong>
          <span className="muted">백업 파일 다운로드나 삭제는 이번 화면 범위에 포함하지 않습니다.</span>
          <button className="secondary-button" disabled={loading} onClick={() => void loadBackups()} type="button">
            재조회
          </button>
        </div>

        {listError ? (
          <div className="stack" role="alert" style={{ gap: 8 }}>
            <div className="error-text">{listError}</div>
            <div className="actions">
              <button className="secondary-button" disabled={loading} onClick={() => void loadBackups()} type="button">
                다시 시도
              </button>
            </div>
          </div>
        ) : null}

        <table className="table">
          <thead>
            <tr>
              <th>백업 ID</th>
              <th>백업 유형</th>
              <th>상태</th>
              <th>파일명</th>
              <th>파일경로</th>
              <th>파일크기</th>
              <th>시작 시각</th>
              <th>완료 시각</th>
              <th>실행자</th>
              <th>실패 사유</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="muted" colSpan={10}>
                  백업 이력을 불러오는 중입니다.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="muted" colSpan={10}>
                  {EMPTY_STATE_MESSAGE}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.backupType}</td>
                  <td>
                    <span className="status-chip" style={getStatusChipStyle(item.status)}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.fileName}</td>
                  <td>
                    <div
                      style={{
                        maxWidth: 260,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      title={item.filePath !== '-' ? item.filePath : undefined}
                    >
                      {item.filePath}
                    </div>
                  </td>
                  <td>{item.fileSizeLabel}</td>
                  <td>{item.startedAt}</td>
                  <td>{item.completedAt}</td>
                  <td>{item.executedByName}</td>
                  <td>
                    <div
                      style={{
                        maxWidth: 240,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      title={item.failureReason !== '-' ? item.failureReason : undefined}
                    >
                      {item.failureReason}
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
            disabled={loading || !historyPage || historyPage.totalPages <= 1 || currentPage >= historyPage.totalPages}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            다음
          </button>
        </div>
      </div>

      <ConfirmDialog
        confirmText="백업 실행"
        confirmVariant="danger"
        description="수동 백업은 즉시 실행되며, 진행 중에는 중복 실행할 수 없습니다. 실행 사유는 선택 입력이지만 남겨두는 것을 권장합니다."
        onCancel={closeDialog}
        onConfirm={() => void handleConfirmRun()}
        open={dialogOpen}
        processing={processing}
        title="수동 백업 실행 확인"
      >
        <div className="stack" style={{ gap: 12 }}>
          {dialogError ? (
            <div className="error-text" role="alert">
              {dialogError}
            </div>
          ) : null}

          <label className="field" style={{ margin: 0 }}>
            <span>실행 사유</span>
            <textarea
              aria-label="실행 사유"
              onChange={(event) => setReasonDraft(event.target.value)}
              placeholder="예: 배포 전 수동 백업"
              rows={4}
              value={reasonDraft}
            />
            <span className="field-hint">사유는 선택 입력입니다. 운영 이력 추적을 위해 작성하는 것을 권장합니다.</span>
            {dialogFieldErrors.reason ? <span className="field-error">{dialogFieldErrors.reason}</span> : null}
          </label>
        </div>
      </ConfirmDialog>
    </div>
  )
}
