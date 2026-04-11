import { isAxiosError } from 'axios'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAppMetadata } from '../../../app/providers/AppMetadataProvider'
import { useAuth } from '../../../app/providers/AuthProvider'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { ApiResponse } from '../../../shared/types/api'
import {
  fetchUserManagementPage,
  updateUserManagementPositionName,
  updateUserManagementRole,
  updateUserManagementStatus,
  type UserManagementListItem,
  type UserManagementPage,
  type UserManagementQuery,
} from '../api/userManagementApi'
import {
  DEFAULT_USER_MANAGEMENT_PAGE_SIZE,
  USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS,
  USER_MANAGEMENT_PAGE_SIZE_OPTIONS,
  USER_MANAGEMENT_ROLE_CHIP_STYLES,
  USER_MANAGEMENT_ROLE_LABELS,
  USER_MANAGEMENT_ROLE_OPTIONS,
  USER_MANAGEMENT_STATUS_CHIP_STYLES,
  USER_MANAGEMENT_STATUS_LABELS,
  USER_MANAGEMENT_STATUS_OPTIONS,
  getDefaultUserManagementStatusDraft,
  isUserManagementEditableStatus,
  parseUserManagementPageSize,
  type UserManagementEditableStatus,
  type UserManagementPageSize,
  type UserManagementPositionName,
  type UserManagementRole,
  type UserManagementStatus,
} from '../adminManagementMetadata'

type Notice = { type: 'success' | 'error'; text: string } | null
type ActionFieldErrors = Partial<Record<'role' | 'status' | 'positionName', string>>

interface FilterState {
  keyword: string
  role: '' | UserManagementRole
  status: '' | UserManagementStatus
  pageSize: UserManagementPageSize
}

interface RoleDialogState {
  action: 'role'
  user: UserManagementListItem
  nextRole: UserManagementRole
}

interface StatusDialogState {
  action: 'status'
  user: UserManagementListItem
  nextStatus: UserManagementEditableStatus
}

interface PositionNameDialogState {
  action: 'positionName'
  user: UserManagementListItem
  nextPositionName: UserManagementPositionName
}

type DialogState = RoleDialogState | StatusDialogState | PositionNameDialogState
type UserManagementAction = DialogState['action']

const EMPTY_STATE_MESSAGE = '조건에 맞는 사용자가 없습니다.'
const GENERIC_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const GENERIC_LIST_ERROR_MESSAGE = '사용자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_ROLE_ERROR_MESSAGE = '사용자 역할 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_STATUS_ERROR_MESSAGE = '사용자 상태 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_POSITION_NAME_ERROR_MESSAGE = '사용자 직책 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
const POSITION_NAME_OPTIONS_LOADING_MESSAGE = '직책 목록을 불러오는 중입니다.'
const POSITION_NAME_OPTIONS_ERROR_MESSAGE = '직책 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'

function createDefaultFilters(): FilterState {
  return {
    keyword: '',
    role: '',
    status: '',
    pageSize: DEFAULT_USER_MANAGEMENT_PAGE_SIZE,
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

function isNotFoundError(errorCode: string | null | undefined) {
  return Boolean(errorCode && errorCode.includes('NOT_FOUND'))
}

function getListErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_LIST_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return getFallbackMessage(response.message, '관리자 권한이 필요합니다.')
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    default:
      return GENERIC_LIST_ERROR_MESSAGE
  }
}

function getRoleActionErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_ROLE_ERROR_MESSAGE
  }

  if (isNotFoundError(response.errorCode)) {
    return getFallbackMessage(response.message, '사용자 정보를 찾을 수 없습니다.')
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return getFallbackMessage(response.message, '관리자 권한이 필요합니다.')
    case 'INVALID_ROLE':
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    case 'LAST_ACTIVE_ADMIN_REQUIRED':
      return getFallbackMessage(response.message, '마지막 활성 관리자 계정은 일반 사용자로 변경할 수 없습니다.')
    default:
      return GENERIC_ROLE_ERROR_MESSAGE
  }
}

function getStatusActionErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_STATUS_ERROR_MESSAGE
  }

  if (isNotFoundError(response.errorCode)) {
    return getFallbackMessage(response.message, '사용자 정보를 찾을 수 없습니다.')
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return getFallbackMessage(response.message, '관리자 권한이 필요합니다.')
    case 'INVALID_USER_STATUS':
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    case 'USER_STATUS_ALREADY_SET':
      return getFallbackMessage(response.message, '이미 같은 상태입니다. 목록을 다시 확인해주세요.')
    case 'LAST_ACTIVE_ADMIN_REQUIRED':
      return getFallbackMessage(response.message, '마지막 활성 관리자 계정은 비활성화할 수 없습니다.')
    default:
      return GENERIC_STATUS_ERROR_MESSAGE
  }
}

function getPositionNameActionErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_POSITION_NAME_ERROR_MESSAGE
  }

  if (isNotFoundError(response.errorCode)) {
    return getFallbackMessage(response.message, '사용자 정보를 찾을 수 없습니다.')
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return getFallbackMessage(response.message, '관리자 권한이 필요합니다.')
    case 'INVALID_POSITION_NAME':
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    default:
      return GENERIC_POSITION_NAME_ERROR_MESSAGE
  }
}

function mapActionFieldErrors(
  response: ApiResponse<unknown> | undefined,
  action: UserManagementAction,
): ActionFieldErrors {
  return (response?.fieldErrors ?? []).reduce<ActionFieldErrors>((errors, fieldError) => {
    if (action === 'role' && fieldError.field === 'role') {
      errors.role = fieldError.reason
    }

    if (action === 'status' && fieldError.field === 'status') {
      errors.status = fieldError.reason
    }

    if (action === 'positionName' && fieldError.field === 'positionName') {
      errors.positionName = fieldError.reason
    }

    return errors
  }, {})
}

function getRoleSuccessMessage(user: UserManagementListItem, nextRole: UserManagementRole) {
  const nextRoleText = `${USER_MANAGEMENT_ROLE_LABELS[nextRole]}로`
  return `${user.name} 사용자의 역할을 ${nextRoleText} 변경했습니다.`
}

function getStatusSuccessMessage(user: UserManagementListItem, nextStatus: UserManagementEditableStatus) {
  const nextStatusText = `${USER_MANAGEMENT_STATUS_LABELS[nextStatus]}으로`
  return `${user.name} 사용자의 상태를 ${nextStatusText} 변경했습니다.`
}

function getPositionNameSuccessMessage(user: UserManagementListItem, nextPositionName: UserManagementPositionName) {
  return `${user.name} 사용자의 직책을 ${nextPositionName}(으)로 변경했습니다.`
}

function getDialogTitle(dialog: DialogState | null) {
  if (!dialog) {
    return ''
  }

  if (dialog.action === 'role') {
    return '사용자 역할 변경 확인'
  }

  if (dialog.action === 'status') {
    return '사용자 상태 변경 확인'
  }

  return '사용자 직책 변경 확인'
}

function getDialogDescription(dialog: DialogState | null) {
  if (!dialog) {
    return ''
  }

  if (dialog.action === 'role') {
    return '선택한 사용자의 역할을 변경합니다. 변경 내용을 확인한 뒤 적용해주세요.'
  }

  if (dialog.action === 'status') {
    return '선택한 사용자의 상태를 변경합니다. 변경 내용을 확인한 뒤 적용해주세요.'
  }

  return '선택한 사용자의 직책을 변경합니다. 변경 내용을 확인한 뒤 적용해주세요.'
}

function isAllowedPositionName(value: string, positionNameOptions: readonly string[]): value is UserManagementPositionName {
  return positionNameOptions.includes(value)
}

function getSelectablePositionNameOptions(currentPositionName: string, positionNameOptions: readonly string[]) {
  if (positionNameOptions.length === 0) {
    return currentPositionName && currentPositionName !== '-' ? [currentPositionName] : ['']
  }

  if (!currentPositionName || currentPositionName === '-') {
    return [...positionNameOptions]
  }

  if (isAllowedPositionName(currentPositionName, positionNameOptions)) {
    return [...positionNameOptions]
  }

  return [currentPositionName, ...positionNameOptions]
}

function getPositionNameOptionLabel(positionName: string) {
  if (!positionName || positionName === '-') {
    return '현재 직책 없음'
  }

  return positionName
}

function buildQuery(filters: FilterState): UserManagementQuery {
  return {
    keyword: filters.keyword.trim() || undefined,
    role: filters.role || undefined,
    status: filters.status || undefined,
    size: filters.pageSize,
  }
}

export function UserManagementBoard() {
  const { positionNames, status: appMetadataStatus } = useAppMetadata()
  const { refresh } = useAuth()
  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters())
  const [query, setQuery] = useState<FilterState>(() => createDefaultFilters())
  const [page, setPage] = useState(1)
  const [userPage, setUserPage] = useState<UserManagementPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogFieldErrors, setDialogFieldErrors] = useState<ActionFieldErrors>({})
  const [processing, setProcessing] = useState(false)
  const [roleDrafts, setRoleDrafts] = useState<Record<number, UserManagementRole>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<number, UserManagementEditableStatus | ''>>({})
  const [positionNameDrafts, setPositionNameDrafts] = useState<Record<number, string>>({})
  const positionMetadataReady = appMetadataStatus === 'ready' && positionNames.length > 0
  const positionMetadataMessage =
    appMetadataStatus === 'error' ? POSITION_NAME_OPTIONS_ERROR_MESSAGE : POSITION_NAME_OPTIONS_LOADING_MESSAGE

  const loadUsers = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetchUserManagementPage({
        ...buildQuery(query),
        page,
      })

      setUserPage(response)
      setListError(null)
      setRoleDrafts(Object.fromEntries(response.items.map((item) => [item.id, item.role])))
      setStatusDrafts(Object.fromEntries(response.items.map((item) => [item.id, getDefaultUserManagementStatusDraft(item.status)])))
      setPositionNameDrafts(Object.fromEntries(response.items.map((item) => [item.id, item.positionName])))
    } catch (error) {
      setUserPage(null)
      setRoleDrafts({})
      setStatusDrafts({})
      setPositionNameDrafts({})
      setListError(getListErrorMessage(getApiResponse(error)))
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  function resetDialog() {
    setDialog(null)
    setDialogError(null)
    setDialogFieldErrors({})
  }

  async function reloadUsersAfterProcess() {
    if (page === 1) {
      await loadUsers()
      return
    }

    setPage(1)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (processing) {
      return
    }

    setNotice(null)
    setListError(null)
    setQuery({
      keyword: filters.keyword.trim(),
      role: filters.role,
      status: filters.status,
      pageSize: filters.pageSize,
    })
    setPage(1)
  }

  function handleResetFilters() {
    if (processing) {
      return
    }

    const nextFilters = createDefaultFilters()

    setNotice(null)
    setListError(null)
    setFilters(nextFilters)
    setQuery(nextFilters)
    setPage(1)
  }

  function openRoleDialog(user: UserManagementListItem) {
    if (processing) {
      return
    }

    const nextRole = roleDrafts[user.id] ?? user.role

    if (nextRole === user.role) {
      return
    }

    setNotice(null)
    setDialog({
      action: 'role',
      user,
      nextRole,
    })
    setDialogError(null)
    setDialogFieldErrors({})
  }

  function openStatusDialog(user: UserManagementListItem) {
    if (processing || !isUserManagementEditableStatus(user.status)) {
      return
    }

    const nextStatus = statusDrafts[user.id] ?? user.status

    if (!nextStatus || nextStatus === user.status) {
      return
    }

    setNotice(null)
    setDialog({
      action: 'status',
      user,
      nextStatus,
    })
    setDialogError(null)
    setDialogFieldErrors({})
  }

  function openPositionNameDialog(user: UserManagementListItem) {
    if (processing) {
      return
    }

    const nextPositionName = positionNameDrafts[user.id] ?? user.positionName

    if (!isAllowedPositionName(nextPositionName, positionNames) || nextPositionName === user.positionName) {
      return
    }

    setNotice(null)
    setDialog({
      action: 'positionName',
      user,
      nextPositionName,
    })
    setDialogError(null)
    setDialogFieldErrors({})
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

    setProcessing(true)
    setNotice(null)
    setDialogError(null)
    setDialogFieldErrors({})

    try {
      if (dialog.action === 'role') {
        await updateUserManagementRole(dialog.user.id, dialog.nextRole)
      } else if (dialog.action === 'status') {
        await updateUserManagementStatus(dialog.user.id, dialog.nextStatus)
      } else {
        await updateUserManagementPositionName(dialog.user.id, dialog.nextPositionName)
      }

      const successMessage =
        dialog.action === 'role'
          ? getRoleSuccessMessage(dialog.user, dialog.nextRole)
          : dialog.action === 'status'
            ? getStatusSuccessMessage(dialog.user, dialog.nextStatus)
            : getPositionNameSuccessMessage(dialog.user, dialog.nextPositionName)

      resetDialog()
      setNotice({ type: 'success', text: successMessage })
      await reloadUsersAfterProcess()
      await refresh()
    } catch (error) {
      const response = getApiResponse(error)
      const errorCode = response?.errorCode
      const errorMessage =
        dialog.action === 'role'
          ? getRoleActionErrorMessage(response)
          : dialog.action === 'status'
            ? getStatusActionErrorMessage(response)
            : getPositionNameActionErrorMessage(response)

      if (errorCode === 'FORBIDDEN' || isNotFoundError(errorCode) || errorCode === 'USER_STATUS_ALREADY_SET') {
        resetDialog()
        setNotice({ type: 'error', text: errorMessage })

        if (isNotFoundError(errorCode) || errorCode === 'USER_STATUS_ALREADY_SET') {
          await reloadUsersAfterProcess()
        }

        return
      }

      setDialogError(errorMessage)
      setDialogFieldErrors(mapActionFieldErrors(response, dialog.action))
    } finally {
      setProcessing(false)
    }
  }

  const items = userPage?.items ?? []
  const currentPage = userPage?.page ?? page
  const totalPages = userPage && userPage.totalPages > 0 ? userPage.totalPages : 1

  return (
    <div className="stack">
      <PageHeader description="사용자 목록을 조회하고 역할과 상태를 안전하게 변경합니다." title="사용자 관리" />

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
            <span>검색어</span>
            <input
              aria-label="검색어"
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="이름 또는 아이디"
              value={filters.keyword}
            />
          </label>
          <label className="field">
            <span>권한</span>
            <select
              aria-label="권한 필터"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  role: event.target.value as FilterState['role'],
                }))
              }
              value={filters.role}
            >
              <option value="">전체</option>
              {USER_MANAGEMENT_ROLE_OPTIONS.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {USER_MANAGEMENT_ROLE_LABELS[roleOption]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>상태</span>
            <select
              aria-label="상태 필터"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as FilterState['status'],
                }))
              }
              value={filters.status}
            >
              <option value="">전체</option>
              {USER_MANAGEMENT_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {USER_MANAGEMENT_STATUS_LABELS[statusOption]}
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
                  pageSize: parseUserManagementPageSize(event.target.value),
                }))
              }
              value={String(filters.pageSize)}
            >
              {USER_MANAGEMENT_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="actions" style={{ alignSelf: 'end' }}>
            <button className="primary-button" disabled={loading || processing} type="submit">
              조회
            </button>
            <button className="secondary-button" disabled={loading || processing} onClick={handleResetFilters} type="button">
              초기화
            </button>
          </div>
        </div>
      </form>

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>총 {userPage?.totalItems ?? 0}명</strong>
          <span className="muted">직책, 역할, 상태 변경은 각각 확인 모달에서 최종 적용됩니다.</span>
          <button className="secondary-button" disabled={loading || processing} onClick={() => void loadUsers()} type="button">
            재조회
          </button>
        </div>

        {!positionMetadataReady ? <div className="muted">{positionMetadataMessage}</div> : null}

        {listError ? (
          <div className="stack" role="alert" style={{ gap: 8 }}>
            <div className="error-text">{listError}</div>
            <div className="actions">
              <button className="secondary-button" disabled={loading || processing} onClick={() => void loadUsers()} type="button">
                다시 시도
              </button>
            </div>
          </div>
        ) : null}

        <table className="table">
          <thead>
            <tr>
              <th>이름</th>
              <th>아이디</th>
              <th>연락처</th>
              <th>직책</th>
              <th>권한</th>
              <th>상태</th>
              <th>승인일시</th>
              <th>최근 로그인</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="muted" colSpan={9}>
                  사용자 목록을 불러오는 중입니다.
                </td>
              </tr>
            ) : listError ? (
              <tr>
                <td className="muted" colSpan={9}>
                  사용자 목록 조회에 실패했습니다.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="muted" colSpan={9}>
                  {EMPTY_STATE_MESSAGE}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const roleDraft = roleDrafts[item.id] ?? item.role
                const canEditStatus = isUserManagementEditableStatus(item.status)
                const statusDraft = statusDrafts[item.id] ?? getDefaultUserManagementStatusDraft(item.status)
                const positionNameDraft = positionNameDrafts[item.id] ?? item.positionName
                const selectablePositionNameOptions = getSelectablePositionNameOptions(item.positionName, positionNames)
                const canSubmitPositionNameChange =
                  positionMetadataReady &&
                  isAllowedPositionName(positionNameDraft, positionNames) &&
                  positionNameDraft !== item.positionName

                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.loginId}</td>
                    <td>{item.contact}</td>
                    <td>{item.positionName}</td>
                    <td>
                      <span className="status-chip" style={USER_MANAGEMENT_ROLE_CHIP_STYLES[item.role]}>
                        {USER_MANAGEMENT_ROLE_LABELS[item.role]}
                      </span>
                    </td>
                    <td>
                      <span className="status-chip" style={USER_MANAGEMENT_STATUS_CHIP_STYLES[item.status]}>
                        {USER_MANAGEMENT_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td>{item.approvedAt}</td>
                    <td>{item.lastLoginAt}</td>
                    <td>
                      <div className="stack" style={{ gap: 12, minWidth: 220 }}>
                        <div className="management-action-panel">
                          <span className="management-action-label">직책 변경</span>
                          <select
                            aria-label={`${item.name} 직책 변경 값`}
                            disabled={processing || !positionMetadataReady}
                            onChange={(event) =>
                              setPositionNameDrafts((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            value={positionNameDraft}
                          >
                            {selectablePositionNameOptions.length === 0 ? (
                              <option value="">{positionMetadataMessage}</option>
                            ) : null}
                            {selectablePositionNameOptions.map((positionNameOption) => {
                              const isCurrentLegacyOption =
                                positionNameOption === item.positionName &&
                                !isAllowedPositionName(positionNameOption, positionNames)

                              return (
                                <option disabled={isCurrentLegacyOption} key={positionNameOption} value={positionNameOption}>
                                  {getPositionNameOptionLabel(positionNameOption)}
                                </option>
                              )
                            })}
                          </select>
                          <button
                            className="primary-button"
                            disabled={processing || !canSubmitPositionNameChange}
                            onClick={() => openPositionNameDialog(item)}
                            type="button"
                          >
                            직책 변경
                          </button>
                        </div>

                        <div className="management-action-panel">
                          <span className="management-action-label">역할 변경</span>
                          <select
                            aria-label={`${item.name} 역할 변경 값`}
                            disabled={processing}
                            onChange={(event) =>
                              setRoleDrafts((prev) => ({
                                ...prev,
                                [item.id]: event.target.value as UserManagementRole,
                              }))
                            }
                            value={roleDraft}
                          >
                            {USER_MANAGEMENT_ROLE_OPTIONS.map((roleOption) => (
                              <option key={roleOption} value={roleOption}>
                                {USER_MANAGEMENT_ROLE_LABELS[roleOption]}
                              </option>
                            ))}
                          </select>
                          <button
                            className="primary-button"
                            disabled={processing || roleDraft === item.role}
                            onClick={() => openRoleDialog(item)}
                            type="button"
                          >
                            역할 변경
                          </button>
                        </div>

                        <div className="management-action-panel">
                          <span className="management-action-label">상태 변경</span>
                          {canEditStatus ? (
                            <>
                              <select
                                aria-label={`${item.name} 상태 변경 값`}
                                disabled={processing}
                                onChange={(event) =>
                                  setStatusDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: event.target.value as UserManagementEditableStatus,
                                  }))
                                }
                                value={statusDraft}
                              >
                                {USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS.map((statusOption) => (
                                  <option key={statusOption} value={statusOption}>
                                    {USER_MANAGEMENT_STATUS_LABELS[statusOption]}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="danger-button"
                                disabled={processing || statusDraft === item.status}
                                onClick={() => openStatusDialog(item)}
                                type="button"
                              >
                                상태 변경
                              </button>
                            </>
                          ) : (
                            <span className="muted">현재 상태에서는 변경할 수 없습니다.</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button
            className="secondary-button"
            disabled={loading || processing || currentPage <= 1}
            onClick={() => setPage((value) => value - 1)}
            type="button"
          >
            이전
          </button>
          <span className="muted">
            {currentPage} / {totalPages} 페이지
          </span>
          <button
            className="secondary-button"
            disabled={loading || processing || !userPage || userPage.totalPages <= 1 || currentPage >= userPage.totalPages}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            다음
          </button>
        </div>
      </div>

      <ConfirmDialog
        confirmText="변경 적용"
        confirmVariant={dialog?.action === 'status' ? 'danger' : 'primary'}
        description={getDialogDescription(dialog)}
        onCancel={closeDialog}
        onConfirm={() => void handleConfirm()}
        open={dialog !== null}
        processing={processing}
        title={getDialogTitle(dialog)}
      >
        <div className="stack" style={{ gap: 12 }}>
          {dialog ? (
            <div className="stack" style={{ gap: 4 }}>
              <strong>
                {dialog.user.name} / {dialog.user.loginId}
              </strong>
              <span className="muted">
                현재 권한 {USER_MANAGEMENT_ROLE_LABELS[dialog.user.role]} · 현재 상태 {USER_MANAGEMENT_STATUS_LABELS[dialog.user.status]}
              </span>
            </div>
          ) : null}

          {dialogError ? (
            <div className="error-text" role="alert">
              {dialogError}
            </div>
          ) : null}

          {dialog?.action === 'role' ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="management-dialog-summary">
                <span className="muted">변경 전</span>
                <strong>{USER_MANAGEMENT_ROLE_LABELS[dialog.user.role]}</strong>
              </div>
              <div className="management-dialog-summary">
                <span className="muted">변경 후</span>
                <strong>{USER_MANAGEMENT_ROLE_LABELS[dialog.nextRole]}</strong>
              </div>
              {dialogFieldErrors.role ? <span className="field-error">{dialogFieldErrors.role}</span> : null}
            </div>
          ) : null}

          {dialog?.action === 'status' ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="management-dialog-summary">
                <span className="muted">변경 전</span>
                <strong>{USER_MANAGEMENT_STATUS_LABELS[dialog.user.status]}</strong>
              </div>
              <div className="management-dialog-summary">
                <span className="muted">변경 후</span>
                <strong>{USER_MANAGEMENT_STATUS_LABELS[dialog.nextStatus]}</strong>
              </div>
              {dialogFieldErrors.status ? <span className="field-error">{dialogFieldErrors.status}</span> : null}
            </div>
          ) : null}

          {dialog?.action === 'positionName' ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="management-dialog-summary">
                <span className="muted">변경 전</span>
                <strong>{getPositionNameOptionLabel(dialog.user.positionName)}</strong>
              </div>
              <div className="management-dialog-summary">
                <span className="muted">변경 후</span>
                <strong>{dialog.nextPositionName}</strong>
              </div>
              {dialogFieldErrors.positionName ? <span className="field-error">{dialogFieldErrors.positionName}</span> : null}
            </div>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  )
}
