import type { CSSProperties } from 'react'

export const USER_MANAGEMENT_ROLE_OPTIONS = ['ADMIN', 'USER'] as const
export const USER_MANAGEMENT_STATUS_OPTIONS = ['ACTIVE', 'PENDING', 'INACTIVE', 'REJECTED'] as const
export const USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const
export const USER_MANAGEMENT_POSITION_NAME_OPTIONS = ['팀장', '대리', '실무자'] as const
export const USER_MANAGEMENT_PAGE_SIZE_OPTIONS = [20, 50] as const

export const SIGNUP_REQUEST_STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED'] as const
export const SIGNUP_REQUEST_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

export type UserManagementRole = (typeof USER_MANAGEMENT_ROLE_OPTIONS)[number]
export type UserManagementStatus = (typeof USER_MANAGEMENT_STATUS_OPTIONS)[number]
export type UserManagementEditableStatus = (typeof USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS)[number]
export type UserManagementPositionName = (typeof USER_MANAGEMENT_POSITION_NAME_OPTIONS)[number]
export type UserManagementPageSize = (typeof USER_MANAGEMENT_PAGE_SIZE_OPTIONS)[number]
export type SignupRequestManagementStatus = (typeof SIGNUP_REQUEST_STATUS_OPTIONS)[number]
export type SignupRequestManagementPageSize = (typeof SIGNUP_REQUEST_PAGE_SIZE_OPTIONS)[number]
export type AdminManagedUserStatus = UserManagementStatus

export const DEFAULT_USER_MANAGEMENT_PAGE_SIZE: UserManagementPageSize = 20
export const DEFAULT_SIGNUP_REQUEST_PAGE_SIZE: SignupRequestManagementPageSize = 20
export const SIGNUP_REQUEST_PROCESSABLE_STATUS: SignupRequestManagementStatus = 'PENDING'

export const USER_MANAGEMENT_ROLE_LABELS: Record<UserManagementRole, string> = {
  ADMIN: '관리자',
  USER: '일반 사용자',
}

export const USER_MANAGEMENT_STATUS_LABELS: Record<UserManagementStatus, string> = {
  ACTIVE: '활성',
  PENDING: '승인 대기',
  INACTIVE: '비활성',
  REJECTED: '반려',
}

export const SIGNUP_REQUEST_STATUS_LABELS: Record<SignupRequestManagementStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '반려',
}

type AdminChipStyle = Readonly<Pick<CSSProperties, 'background' | 'color'>>

export const USER_MANAGEMENT_ROLE_CHIP_STYLES: Record<UserManagementRole, AdminChipStyle> = {
  ADMIN: {
    color: '#204e72',
    background: '#dceaf7',
  },
  USER: {
    color: '#576b7d',
    background: '#e9eef3',
  },
}

export const USER_MANAGEMENT_STATUS_CHIP_STYLES: Record<UserManagementStatus, AdminChipStyle> = {
  ACTIVE: {
    color: '#1d6a53',
    background: '#dff1ea',
  },
  PENDING: {
    color: '#1d537d',
    background: '#dceaf7',
  },
  INACTIVE: {
    color: '#8c5a11',
    background: '#f8e8cf',
  },
  REJECTED: {
    color: '#9d2f2f',
    background: '#f8e1e1',
  },
}

export const SIGNUP_REQUEST_STATUS_CHIP_STYLES: Record<SignupRequestManagementStatus, AdminChipStyle> = {
  PENDING: {
    color: '#1d537d',
    background: '#dceaf7',
  },
  APPROVED: {
    color: '#1d6a53',
    background: '#dff1ea',
  },
  REJECTED: {
    color: '#9d2f2f',
    background: '#f8e1e1',
  },
}

export function isUserManagementEditableStatus(status: UserManagementStatus): status is UserManagementEditableStatus {
  return USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS.includes(status as UserManagementEditableStatus)
}

export function getDefaultUserManagementStatusDraft(
  status: UserManagementStatus,
): UserManagementEditableStatus | '' {
  return isUserManagementEditableStatus(status) ? status : ''
}

function parsePageSizeOption<TPageSize extends number>(
  value: string,
  options: readonly TPageSize[],
  fallback: TPageSize,
): TPageSize {
  const parsedValue = Number(value)
  const matchedOption = options.find((option) => option === parsedValue)

  return matchedOption ?? fallback
}

export function parseUserManagementPageSize(value: string): UserManagementPageSize {
  return parsePageSizeOption(value, USER_MANAGEMENT_PAGE_SIZE_OPTIONS, DEFAULT_USER_MANAGEMENT_PAGE_SIZE)
}

export function parseSignupRequestPageSize(value: string): SignupRequestManagementPageSize {
  return parsePageSizeOption(value, SIGNUP_REQUEST_PAGE_SIZE_OPTIONS, DEFAULT_SIGNUP_REQUEST_PAGE_SIZE)
}

export function getDefaultSignupRequestFilterStatus(): SignupRequestManagementStatus {
  return 'PENDING'
}

export function isSignupRequestProcessableStatus(
  status: SignupRequestManagementStatus,
): status is typeof SIGNUP_REQUEST_PROCESSABLE_STATUS {
  return status === SIGNUP_REQUEST_PROCESSABLE_STATUS
}
