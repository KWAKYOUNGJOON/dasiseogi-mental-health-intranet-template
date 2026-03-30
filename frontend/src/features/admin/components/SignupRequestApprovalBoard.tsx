import { isAxiosError } from 'axios'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { ApiResponse } from '../../../shared/types/api'
import {
  approveSignupRequest,
  fetchSignupRequestApprovalQueue,
  rejectSignupRequest,
  type SignupRequestApprovalItem,
  type SignupRequestApprovalPage,
  type SignupRequestApprovalStatus,
} from '../api/signupRequestApprovalApi'

type ProcessMode = 'approve' | 'reject'
type Notice = { type: 'success' | 'error'; text: string } | null
type ProcessFieldErrors = Partial<Record<'processNote', string>>

interface DialogState {
  mode: ProcessMode
  request: SignupRequestApprovalItem
}

const PAGE_SIZE_OPTIONS = [20, 50] as const
const EMPTY_STATE_MESSAGE = '현재 승인 대기 중인 가입 신청이 없습니다.'
const GENERIC_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const GENERIC_LIST_ERROR_MESSAGE = '승인 대기 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_PROCESS_ERROR_MESSAGE = '가입 신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'

function getApiResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return undefined
  }
  return error.response?.data
}

function getListErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (response?.errorCode === 'FORBIDDEN') {
    return response.message?.trim() || '관리자 권한이 필요합니다.'
  }
  if (response?.errorCode === 'VALIDATION_ERROR') {
    return response.message?.trim() || GENERIC_VALIDATION_MESSAGE
  }
  return GENERIC_LIST_ERROR_MESSAGE
}

function getProcessErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_PROCESS_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'SIGNUP_REQUEST_NOT_FOUND':
      return response.message?.trim() || '가입 신청을 찾을 수 없습니다.'
    case 'SIGNUP_REQUEST_ALREADY_PROCESSED':
      return response.message?.trim() || '이미 처리된 가입 신청입니다.'
    case 'FORBIDDEN':
      return response.message?.trim() || '관리자 권한이 필요합니다.'
    case 'VALIDATION_ERROR':
      return response.message?.trim() || GENERIC_VALIDATION_MESSAGE
    default:
      return GENERIC_PROCESS_ERROR_MESSAGE
  }
}

function mapProcessFieldErrors(
  response: ApiResponse<unknown> | undefined,
  mode: ProcessMode,
  processNote: string,
): ProcessFieldErrors {
  const nextErrors = (response?.fieldErrors ?? []).reduce<ProcessFieldErrors>((errors, fieldError) => {
    if (fieldError.field === 'processNote') {
      errors.processNote = fieldError.reason
    }
    return errors
  }, {})

  if (mode === 'reject' && !processNote && response?.errorCode === 'VALIDATION_ERROR' && !nextErrors.processNote) {
    nextErrors.processNote = response.message?.trim() || '반려 사유를 입력해주세요.'
  }

  return nextErrors
}

function getStatusLabel(status: SignupRequestApprovalStatus) {
  switch (status) {
    case 'APPROVED':
      return '승인 완료'
    case 'REJECTED':
      return '반려 완료'
    default:
      return '승인 대기'
  }
}

function getStatusStyle(status: SignupRequestApprovalStatus): CSSProperties {
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

function getSuccessMessage(mode: ProcessMode) {
  return mode === 'approve' ? '가입 신청을 승인했습니다.' : '가입 신청을 반려했습니다.'
}

function isQueueRefreshError(response: ApiResponse<unknown> | undefined) {
  return response?.errorCode === 'SIGNUP_REQUEST_NOT_FOUND' || response?.errorCode === 'SIGNUP_REQUEST_ALREADY_PROCESSED'
}

export function SignupRequestApprovalBoard() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20)
  const [queue, setQueue] = useState<SignupRequestApprovalPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [processNote, setProcessNote] = useState('')
  const [processFieldErrors, setProcessFieldErrors] = useState<ProcessFieldErrors>({})
  const [processError, setProcessError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetchSignupRequestApprovalQueue({ page, size })
      setQueue(response)
      setListError(null)
    } catch (error) {
      setListError(getListErrorMessage(getApiResponse(error)))
    } finally {
      setLoading(false)
    }
  }, [page, size])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  function resetDialog() {
    setDialog(null)
    setProcessNote('')
    setProcessFieldErrors({})
    setProcessError(null)
  }

  async function reloadQueueAfterProcess() {
    if (page === 1) {
      await loadQueue()
      return
    }
    setPage(1)
  }

  function openDialog(mode: ProcessMode, request: SignupRequestApprovalItem) {
    setNotice(null)
    setDialog({ mode, request })
    setProcessNote('')
    setProcessFieldErrors({})
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
      setProcessError('반려 사유를 입력해주세요.')
      setProcessFieldErrors({ processNote: '반려 사유를 입력해주세요.' })
      return
    }

    setProcessing(true)
    setNotice(null)
    setProcessError(null)
    setProcessFieldErrors({})

    try {
      if (dialog.mode === 'approve') {
        await approveSignupRequest(dialog.request.id, normalizedProcessNote)
      } else {
        await rejectSignupRequest(dialog.request.id, normalizedProcessNote)
      }

      const successMessage = getSuccessMessage(dialog.mode)
      resetDialog()
      setNotice({ type: 'success', text: successMessage })
      await reloadQueueAfterProcess()
    } catch (error) {
      const response = getApiResponse(error)
      const errorMessage = getProcessErrorMessage(response)

      if (response?.errorCode === 'FORBIDDEN' || isQueueRefreshError(response)) {
        resetDialog()
        setNotice({ type: 'error', text: errorMessage })

        if (isQueueRefreshError(response)) {
          await reloadQueueAfterProcess()
        }

        return
      }

      setProcessError(errorMessage)
      setProcessFieldErrors(mapProcessFieldErrors(response, dialog.mode, normalizedProcessNote))
    } finally {
      setProcessing(false)
    }
  }

  const items = queue?.items ?? []
  const currentPage = queue?.page ?? page
  const totalPages = queue && queue.totalPages > 0 ? queue.totalPages : 1

  return (
    <div className="stack">
      <PageHeader description="승인 대기 중인 회원가입 신청을 검토하고 승인 또는 반려합니다." title="회원가입 승인" />

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
          <strong>승인 대기 {queue?.totalItems ?? 0}건</strong>
          <select
            aria-label="페이지 크기"
            disabled={loading || processing}
            onChange={(event) => {
              setSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
              if (page !== 1) {
                setPage(1)
              }
            }}
            value={size}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}개씩 보기
              </option>
            ))}
          </select>
          <button className="secondary-button" disabled={loading || processing} onClick={() => void loadQueue()}>
            재조회
          </button>
        </div>

        {listError ? (
          <div className="stack" role="alert" style={{ gap: 8 }}>
            <div className="error-text">{listError}</div>
            <div className="actions">
              <button className="secondary-button" disabled={loading || processing} onClick={() => void loadQueue()}>
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
              <th>직책</th>
              <th>소속 팀</th>
              <th>신청 메모</th>
              <th>처리 상태</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="muted" colSpan={9}>
                  승인 대기 목록을 불러오는 중입니다.
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
                  <td>{item.positionName}</td>
                  <td>{item.teamName}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{item.requestNote}</td>
                  <td>
                    <span className="status-chip" style={getStatusStyle(item.status)}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    {item.canProcess ? (
                      <div className="actions">
                        <button className="primary-button" disabled={processing} onClick={() => openDialog('approve', item)}>
                          승인
                        </button>
                        <button className="danger-button" disabled={processing} onClick={() => openDialog('reject', item)}>
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
          <button className="secondary-button" disabled={loading || processing || currentPage <= 1} onClick={() => setPage((value) => value - 1)}>
            이전
          </button>
          <span className="muted">
            {currentPage} / {totalPages} 페이지
          </span>
          <button
            className="secondary-button"
            disabled={loading || processing || !queue || queue.totalPages <= 1 || currentPage >= queue.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            다음
          </button>
        </div>
      </div>

      <ConfirmDialog
        confirmText={dialog?.mode === 'approve' ? '승인' : '반려'}
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
                {dialog.request.teamName} · {dialog.request.positionName}
              </span>
            </div>
          ) : null}

          {processError ? (
            <div className="error-text" role="alert">
              {processError}
            </div>
          ) : null}

          <label className="field">
            <span>{dialog?.mode === 'reject' ? '반려 사유' : '처리 메모'}</span>
            <textarea
              aria-label={dialog?.mode === 'reject' ? '반려 사유' : '처리 메모'}
              className={processFieldErrors.processNote ? 'input-error' : undefined}
              onChange={(event) => {
                setProcessNote(event.target.value)

                if (processFieldErrors.processNote) {
                  setProcessFieldErrors({})
                }
                if (processError) {
                  setProcessError(null)
                }
              }}
              placeholder={
                dialog?.mode === 'reject'
                  ? '반려 사유를 입력해주세요.'
                  : '필요하면 승인 메모를 남길 수 있습니다.'
              }
              rows={4}
              value={processNote}
            />
            <span className="field-hint">
              {dialog?.mode === 'reject' ? '반려 시에는 사유 입력이 필요합니다.' : '승인 메모는 선택 입력입니다.'}
            </span>
            {processFieldErrors.processNote ? <span className="field-error">{processFieldErrors.processNote}</span> : null}
          </label>
        </div>
      </ConfirmDialog>
    </div>
  )
}
