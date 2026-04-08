export const USER_ROLE_OPTIONS = ['ADMIN', 'USER'] as const
export const USER_STATUS_OPTIONS = ['ACTIVE', 'PENDING', 'INACTIVE', 'REJECTED'] as const

export type UserRole = (typeof USER_ROLE_OPTIONS)[number]
export type UserStatus = (typeof USER_STATUS_OPTIONS)[number]

export const USER_ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  ADMIN: '관리자',
  USER: '일반 사용자',
}

export const USER_STATUS_LABELS: Readonly<Record<UserStatus, string>> = {
  ACTIVE: '활성',
  PENDING: '승인 대기',
  INACTIVE: '비활성',
  REJECTED: '반려',
}

export function getUserRoleLabel(role: UserRole) {
  return USER_ROLE_LABELS[role]
}

export function getUserStatusLabel(status: UserStatus) {
  return USER_STATUS_LABELS[status]
}

export function isAdminRole(role: UserRole) {
  return role === 'ADMIN'
}

export function hasAdminAccess(user: { role: UserRole } | null | undefined) {
  return Boolean(user && isAdminRole(user.role))
}
