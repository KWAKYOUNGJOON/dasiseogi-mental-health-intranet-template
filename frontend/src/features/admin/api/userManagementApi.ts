import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'
import {
  type UserManagementEditableStatus,
  type UserManagementPageSize,
  type UserManagementPositionName,
  type UserManagementRole,
  type UserManagementStatus,
} from '../adminManagementMetadata'

export {
  DEFAULT_USER_MANAGEMENT_PAGE_SIZE,
  USER_MANAGEMENT_EDITABLE_STATUS_OPTIONS,
  USER_MANAGEMENT_PAGE_SIZE_OPTIONS,
  USER_MANAGEMENT_POSITION_NAME_OPTIONS,
  USER_MANAGEMENT_ROLE_OPTIONS,
  USER_MANAGEMENT_STATUS_OPTIONS,
} from '../adminManagementMetadata'

interface UserManagementListItemResponse {
  userId: number
  name: string | null
  loginId: string | null
  phone: string | null
  positionName: string | null
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
  positionName: string | null
}

export interface UpdateUserManagementStatusRequest {
  status: UserManagementEditableStatus
}

export interface UpdateUserManagementStatusResponse {
  userId: number
  role: UserManagementRole
  status: UserManagementStatus
  positionName: string | null
}

export interface UpdateUserManagementPositionNameRequest {
  positionName: UserManagementPositionName
}

export interface UpdateUserManagementPositionNameResponse {
  userId: number
  role: UserManagementRole
  status: UserManagementStatus
  positionName: string | null
}

export interface UserManagementListItem {
  id: number
  name: string
  loginId: string
  contact: string
  positionName: string
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
  positionName?: string
}

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
    positionName: normalizeText(item.positionName),
    role: item.role,
    status: item.status,
    approvedAt: normalizeText(formatSeoulDateTimeText(item.approvedAt)),
    lastLoginAt: normalizeText(formatSeoulDateTimeText(item.lastLoginAt)),
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
  response: UpdateUserManagementRoleResponse | UpdateUserManagementStatusResponse | UpdateUserManagementPositionNameResponse,
): UserManagementChangeResult {
  return {
    userId: response.userId,
    role: response.role,
    status: response.status,
    positionName: normalizeText(response.positionName),
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

export async function updateUserManagementPositionName(
  userId: number,
  positionName: UserManagementPositionName,
): Promise<UserManagementChangeResult> {
  const payload: UpdateUserManagementPositionNameRequest = { positionName }
  const response = await http.patch<ApiResponse<UpdateUserManagementPositionNameResponse>>(
    `/admin/users/${userId}/position-name`,
    payload,
  )
  return mapUserManagementChangeResult(response.data.data)
}

export type {
  UserManagementEditableStatus,
  UserManagementPageSize,
  UserManagementPositionName,
  UserManagementRole,
  UserManagementStatus,
}
