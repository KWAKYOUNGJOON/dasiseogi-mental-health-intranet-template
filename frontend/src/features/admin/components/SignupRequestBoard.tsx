import { isAxiosError } from 'axios'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { ApiResponse } from '../../../shared/types/api'
import {
  approveSignupRequest,
  DEFAULT_SIGNUP_REQUEST_PAGE_SIZE,
  fetchSignupRequestPage,
  rejectSignupRequest,
  SIGNUP_REQUEST_PAGE_SIZE_OPTIONS,
  SIGNUP_REQUEST_STATUS_OPTIONS,
  type SignupRequestListItem,
  type SignupRequestListPage,
  type SignupRequestManagementPageSize,
  type SignupRequestManagementStatus,
} from '../api/signupRequestManagementApi'

type ProcessMode = 'approve' | 'reject'
type Notice = { type: 'success' | 'error'; text: string } | null

interface FilterState {
  status: SignupRequestManagementStatus
  pageSize: SignupRequestManagementPageSize
}

interface DialogState {
  mode: ProcessMode
  request: SignupRequestListItem
}

const EMPTY_STATE_MESSAGE = '조건에 맞는 가입 신청이 없습니다.'
const GENERIC_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const GENERIC_LIST_ERROR_MESSAGE = '가입 신청 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_PROCESS_ERROR_MESSAGE = '가입 신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'

function createDefaultFilters(): FilterState {
  return {
    status: 'PENDING',
    pageSize: DEFAULT_SIGNUP_REQUEST_PAGE_SIZE,
  }
}

function getApiResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return undefined
  }

  return error.response?.data
}

function getFallbackMessage(message: string | null | undefined, fallbackMessage: string) {
  const trimmedMessage = message?.trim()
  return trimmedMessage ? trimmedMessage : fallbackMessage
}

function getSignupRequestErrorMessage(response: ApiResponse<unknown> | undefined, fallbackMessage: string) {
  if (!response) {
    return fallbackMessage
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return getFallbackMessage(response.message, '관리자 권한이 필요합니다.')
    case 'SIGNUP_REQUEST_ALREADY_PROCESSED':
      return getFallbackMessage(response.message, '이미 처리된 가입 신청입니다.')
    case 'SIGNUP_REQUEST_NOT_FOUND':
      return getFallbackMessage(response.message, '가입 신청 내역을 찾을 수 없습니다.')
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    default:
      return fallbackMessage
  }
}

function getStatusLabel(status: SignupRequestManagementStatus) {
  switch (status) {
    case 'APPROVED':
      return '승인 완료'
    case 'REJECTED':
      return '반려 완료'
    default:
      return '승인 대기'
  }
}

function getStatusStyle(status: SignupRequestManagementStatus): CSSProperties {
  switch (status) {
    case 'APPROVED':
      return {
        color: '#1d6a53',
        background: '#dff1ea',
      }
    case 'REJECTED':
      return {
        color: '#9d2f2f',
        background: '#f8e1e1',
      }
    default:
      return {
        color: '#1d537d',
        background: '#dceaf7',
      }
  }
}

function parsePageSize(value: string): SignupRequestManagementPageSize {
  const parsedValue = Number(value)
  const matchedOption = SIGNUP_REQUEST_PAGE_SIZE_OPTIONS.find((option) => option === parsedValue)

  return matchedOption ?? DEFAULT_SIGNUP_REQUEST_PAGE_SIZE
}

function getSuccessMessage(mode: ProcessMode) {
  return mode === 'approve' ? '가입 신청을 승인했습니다.' : '가입 신청을 반려했습니다.'
}

function isRefreshRequiredError(errorCode: string | null) {
  return errorCode === 'SIGNUP_REQUEST_ALREADY_PROCESSED' || errorCode === 'SIGNUP_REQUEST_NOT_FOUND'
}

function mapProcessFieldError(response: ApiResponse<unknown> | undefined, mode: ProcessMode, processNote: string) {
  const processNoteFieldError = response?.fieldErrors.find((fieldError) => fieldError.field === 'processNote')

  if (processNoteFieldError) {
    return processNoteFieldError.reason
  }

  if (mode === 'reject' && !processNote && response?.errorCode === 'VALIDATION_ERROR') {
    return '반려 시 처리 메모를 입력해주세요.'
  }

  return null
}

export function SignupRequestBoard() {
  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters())
  const [query, setQuery] = useState<FilterState>(() => createDefaultFilters())
  const [page, setPage] = useState(1)
  const [signupRequestPage, setSignupRequestPage] = useState<SignupRequestListPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [processNote, setProcessNote] = useState('')
  const [processFieldError, setProcessFieldError] = useState<string | null>(null)
  const [processError, setProcessError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const loadSignupRequests = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetchSignupRequestPage({
        status: query.status,
        page,
        size: query.pageSize,
      })

      setSignupRequestPage(response)
      setListError(null)
    } catch (error) {
      setSignupRequestPage(null)
      setListError(getSignupRequestErrorMessage(getApiResponse(error), GENERIC_LIST_ERROR_MESSAGE))
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    void loadSignupRequests()
  }, [loadSignupRequests])

  function resetDialog() {
    setDialog(null)
    setProcessNote('')
    setProcessFieldError(null)
    setProcessError(null)
  }

  async function reloadSignupRequestsAfterProcess() {
    if (page === 1) {
      await loadSignupRequests()
      return
    }

    setPage(1)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setListError(null)
    setNotice(null)
    setQuery({
      status: filters.status,
      pageSize: filters.pageSize,
    })
    setPage(1)
  }

  function handleReset() {
    const nextFilters = createDefaultFilters()

    setFilters(nextFilters)
    setQuery(nextFilters)
    setPage(1)
    setListError(null)
    setNotice(null)
  }

  function openDialog(mode: ProcessMode, request: SignupRequestListItem) {
    setNotice(null)
    setDialog({ mode, request })
    setProcessNote('')
    setProcessFieldError(null)
    setProcessError(null)
  }

  function closeDialog() {
    if (processing) {
      return
    }

    resetDialog()
  }

  async function handleConfirm() {
    if (!dialog || processing) {
      return
    }

    const normalizedProcessNote = processNote.trim()

    if (dialog.mode === 'reject' && !normalizedProcessNote) {
      setProcessFieldError('반려 시 처리 메모를 입력해주세요.')
      setProcessError(GENERIC_VALIDATION_MESSAGE)
      return
    }

    setProcessing(true)
    setNotice(null)
    setProcessFieldError(null)
    setProcessError(null)

    try {
      if (dialog.mode === 'approve') {
        await approveSignupRequest(dialog.request.id, { processNote: normalizedProcessNote })
      } else {
        await rejectSignupRequest(dialog.request.id, { processNote: normalizedProcessNote })
      }

      resetDialog()
      setNotice({ type: 'success', text: getSuccessMessage(dialog.mode) })
      await reloadSignupRequestsAfterProcess()
    } catch (error) {
      const response = getApiResponse(error)
      const errorMessage = getSignupRequestErrorMessage(response, GENERIC_PROCESS_ERROR_MESSAGE)

      if (response?.errorCode === 'FORBIDDEN' || isRefreshRequiredError(response?.errorCode ?? null)) {
        resetDialog()
        setNotice({ type: 'error', text: errorMessage })

        if (isRefreshRequiredError(response?.errorCode ?? null)) {
          await reloadSignupRequestsAfterProcess()
        }

        return
      }

      setProcessFieldError(mapProcessFieldError(response, dialog.mode, normalizedProcessNote))
      setProcessError(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  const items = signupRequestPage?.items ?? []
  const currentPage = signupRequestPage?.page ?? page
  const totalPages = signupRequestPage && signupRequestPage.totalPages > 0 ? signupRequestPage.totalPages : 1

  return (
    <div className="stack">
      <PageHeader description="회원가입 신청 내역을 상태별로 조회하고 승인 또는 반려합니다." title="회원가입 승인" />

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

      <form className="card stack" noValidate onSubmit={handleSearch}>
        <div className="management-filter-grid">
          <label className="field">
            <span>상태</span>
            <select
              aria-label="상태"
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  status: event.target.value as SignupRequestManagementStatus,
                }))
              }
              value={filters.status}
            >
              {SIGNUP_REQUEST_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>페이지 크기</span>
            <select
              aria-label="페이지 크기"
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  pageSize: parsePageSize(event.target.value),
                }))
              }
              value={String(filters.pageSize)}
            >
              {SIGNUP_REQUEST_PAGE_SIZE_OPTIONS.map((pageSizeOption) => (
                <option key={pageSizeOption} value={pageSizeOption}>
                  {pageSizeOption}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="actions">
          <button className="primary-button" disabled={loading || processing} type="submit">
            조회
          </button>
          <button className="secondary-button" disabled={loading || processing} onClick={handleReset} type="button">
            초기화
          </button>
        </div>
      </form>

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>총 {signupRequestPage?.totalItems ?? 0}건</strong>
          <span className="muted">현재 상태 필터: {getStatusLabel(query.status)}</span>
          <button className="secondary-button" disabled={loading || processing} onClick={() => void loadSignupRequests()} type="button">
            재조회
          </button>
        </div>

        {listError ? (
          <div className="stack" role="alert" style={{ gap: 8 }}>
            <div className="error-text">{listError}</div>
            <div className="actions">
              <button className="secondary-button" disabled={loading || processing} onClick={() => void loadSignupRequests()} type="button">
                다시 시도
              </button>
            </div>
          </div>
        ) : null}

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
            {loading ? (
              <tr>
                <td className="muted" colSpan={9}>
                  가입 신청 목록을 불러오는 중입니다.
                </td>
              </tr>
            ) : listError ? (
              <tr>
                <td className="muted" colSpan={9}>
                  가입 신청 조회에 실패했습니다.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="muted" colSpan={9}>
                  {EMPTY_STATE_MESSAGE}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.submittedAt}</td>
                  <td>{item.applicantName}</td>
                  <td>{item.loginId}</td>
                  <td>{item.contact}</td>
                  <td>{item.positionOrRole}</td>
                  <td>{item.teamName}</td>
                  <td>
                    <div
                      style={{
                        maxWidth: 320,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      title={item.requestNote !== '-' ? item.requestNote : undefined}
                    >
                      {item.requestNote}
                    </div>
                  </td>
                  <td>
                    <span className="status-chip" style={getStatusStyle(item.status)}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    {item.canProcess ? (
                      <div className="actions">
                        <button className="primary-button" disabled={processing} onClick={() => openDialog('approve', item)} type="button">
                          승인
                        </button>
                        <button className="danger-button" disabled={processing} onClick={() => openDialog('reject', item)} type="button">
                          반려
                        </button>
                      </div>
                    ) : (
                      <span className="muted">처리 완료</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button
            className="secondary-button"
            disabled={loading || processing || currentPage <= 1}
            onClick={() => setPage((previous) => previous - 1)}
            type="button"
          >
            이전
          </button>
          <span className="muted">
            {currentPage} / {totalPages} 페이지
          </span>
          <button
            className="secondary-button"
            disabled={loading || processing || !signupRequestPage || signupRequestPage.totalPages <= 1 || currentPage >= signupRequestPage.totalPages}
            onClick={() => setPage((previous) => previous + 1)}
            type="button"
          >
            다음
          </button>
        </div>
      </div>

      <ConfirmDialog
        confirmText={dialog?.mode === 'approve' ? '승인' : '반려'}
        confirmVariant={dialog?.mode === 'approve' ? 'primary' : 'danger'}
        description={dialog?.mode === 'approve' ? '선택한 가입 신청을 승인합니다.' : '선택한 가입 신청을 반려합니다.'}
        onCancel={closeDialog}
        onConfirm={() => void handleConfirm()}
        open={dialog !== null}
        processing={processing}
        title={dialog?.mode === 'approve' ? '가입 신청 승인' : '가입 신청 반려'}
      >
        <div className="stack" style={{ gap: 12 }}>
          {dialog ? (
            <div className="stack" style={{ gap: 4 }}>
              <strong>
                {dialog.request.applicantName} / {dialog.request.loginId}
              </strong>
              <span className="muted">
                {dialog.request.teamName} · {dialog.request.positionOrRole}
              </span>
            </div>
          ) : null}

          {processError ? (
            <div className="error-text" role="alert">
              {processError}
            </div>
          ) : null}

          <label className="field">
            <span>처리 메모</span>
            <textarea
              aria-label="처리 메모"
              className={processFieldError ? 'input-error' : undefined}
              disabled={processing}
              onChange={(event) => {
                setProcessNote(event.target.value)

                if (processFieldError) {
                  setProcessFieldError(null)
                }

                if (processError) {
                  setProcessError(null)
                }
              }}
              placeholder={dialog?.mode === 'reject' ? '반려 사유 또는 처리 메모를 입력해주세요.' : '필요하면 처리 메모를 남길 수 있습니다.'}
              rows={4}
              value={processNote}
            />
            <span className="field-hint">
              {dialog?.mode === 'reject' ? '반려 시에는 처리 메모 입력이 필요합니다.' : '승인 메모는 선택 입력입니다.'}
            </span>
            {processFieldError ? <span className="field-error">{processFieldError}</span> : null}
          </label>
        </div>
      </ConfirmDialog>
    </div>
  )
}
