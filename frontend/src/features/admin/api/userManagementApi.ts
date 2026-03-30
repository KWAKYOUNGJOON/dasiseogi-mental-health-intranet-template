import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'

export const USER_MANAGEMENT_ROLE_OPTIONS = ['ADMIN', 'USER'] as const
export const USER_MANAGEMENT_STATUS_OPTIONS = ['ACTIVE', 'PENDING', 'INACTIVE', 'REJECTED'] as const
export const USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const
export const USER_MANAGEMENT_PAGE_SIZE_OPTIONS = [20, 50] as const

export type UserManagementRole = (typeof USER_MANAGEMENT_ROLE_OPTIONS)[number]
export type UserManagementStatus = (typeof USER_MANAGEMENT_STATUS_OPTIONS)[number]
export type UserManagementEditableStatus = (typeof USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS)[number]
export type UserManagementPageSize = (typeof USER_MANAGEMENT_PAGE_SIZE_OPTIONS)[number]

interface UserManagementListItemResponse {
  userId: number
  name: string | null
  loginId: string | null
  phone: string | null
  role: UserManagementRole
  status: UserManagementStatus
  approvedAt: string | null
  lastLoginAt: string | null
}

interface UserManagementPageResponse {
  items: UserManagementListItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface UpdateUserManagementRoleRequest {
  role: UserManagementRole
}

export interface UpdateUserManagementRoleResponse {
  userId: number
  role: UserManagementRole
  status: UserManagementStatus
}

export interface UpdateUserManagementStatusRequest {
  status: UserManagementEditableStatus
}

export interface UpdateUserManagementStatusResponse {
  userId: number
  role: UserManagementRole
  status: UserManagementStatus
}

export interface UserManagementListItem {
  id: number
  name: string
  loginId: string
  contact: string
  role: UserManagementRole
  status: UserManagementStatus
  approvedAt: string
  lastLoginAt: string
}

export interface UserManagementPage {
  items: UserManagementListItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface UserManagementQuery {
  keyword?: string
  role?: UserManagementRole
  status?: UserManagementStatus
  page?: number
  size?: UserManagementPageSize
}

export interface UserManagementChangeResult {
  userId: number
  role: UserManagementRole
  status: UserManagementStatus
}

export const DEFAULT_USER_MANAGEMENT_PAGE_SIZE: UserManagementPageSize = 20

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return '-'
  }

  return trimmed
}

function mapUserManagementListItem(item: UserManagementListItemResponse): UserManagementListItem {
  return {
    id: item.userId,
    name: normalizeText(item.name),
    loginId: normalizeText(item.loginId),
    contact: normalizeText(item.phone),
    role: item.role,
    status: item.status,
    approvedAt: normalizeText(item.approvedAt),
    lastLoginAt: normalizeText(item.lastLoginAt),
  }
}

function mapUserManagementPage(page: UserManagementPageResponse): UserManagementPage {
  return {
    items: page.items.map(mapUserManagementListItem),
    page: page.page,
    size: page.size,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  }
}

function mapUserManagementChangeResult(
  response: UpdateUserManagementRoleResponse | UpdateUserManagementStatusResponse,
): UserManagementChangeResult {
  return {
    userId: response.userId,
    role: response.role,
    status: response.status,
  }
}

export async function fetchUserManagementPage(params?: UserManagementQuery): Promise<UserManagementPage> {
  const response = await http.get<ApiResponse<UserManagementPageResponse>>('/admin/users', { params })
  return mapUserManagementPage(response.data.data)
}

export async function updateUserManagementRole(
  userId: number,
  role: UserManagementRole,
): Promise<UserManagementChangeResult> {
  const payload: UpdateUserManagementRoleRequest = { role }
  const response = await http.patch<ApiResponse<UpdateUserManagementRoleResponse>>(`/admin/users/${userId}/role`, payload)
  return mapUserManagementChangeResult(response.data.data)
}

export async function updateUserManagementStatus(
  userId: number,
  status: UserManagementEditableStatus,
): Promise<UserManagementChangeResult> {
  const payload: UpdateUserManagementStatusRequest = { status }
  const response = await http.patch<ApiResponse<UpdateUserManagementStatusResponse>>(`/admin/users/${userId}/status`, payload)
  return mapUserManagementChangeResult(response.data.data)
}
