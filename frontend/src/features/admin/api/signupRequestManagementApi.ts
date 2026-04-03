import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'

export const SIGNUP_REQUEST_STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED'] as const
export const SIGNUP_REQUEST_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

export type SignupRequestManagementStatus = (typeof SIGNUP_REQUEST_STATUS_OPTIONS)[number]
export type SignupRequestManagementPageSize = (typeof SIGNUP_REQUEST_PAGE_SIZE_OPTIONS)[number]
export type SignupRequestManagementUserStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'REJECTED'

interface SignupRequestListItemResponse {
  requestId: number
  requestedAt: string | null
  name: string | null
  loginId: string | null
  phone: string | null
  positionName: string | null
  teamName: string | null
  requestNote: string | null
  requestStatus: SignupRequestManagementStatus
}

interface SignupRequestListPageResponse {
  items: SignupRequestListItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface ApproveSignupRequestRequest {
  processNote: string
}

export interface RejectSignupRequestRequest {
  processNote: string
}

interface SignupRequestProcessResponse {
  requestId: number
  userId: number
  requestStatus: SignupRequestManagementStatus
  userStatus: SignupRequestManagementUserStatus
}

export interface SignupRequestListItem {
  id: number
  submittedAt: string
  applicantName: string
  loginId: string
  contact: string
  positionOrRole: string
  teamName: string
  requestNote: string
  status: SignupRequestManagementStatus
  canProcess: boolean
}

export interface SignupRequestListPage {
  items: SignupRequestListItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface SignupRequestProcessResult {
  requestId: number
  userId: number
  requestStatus: SignupRequestManagementStatus
  userStatus: SignupRequestManagementUserStatus
}

export interface SignupRequestListQuery {
  status?: SignupRequestManagementStatus
  page?: number
  size?: SignupRequestManagementPageSize
}

export const DEFAULT_SIGNUP_REQUEST_PAGE_SIZE: SignupRequestManagementPageSize = 20

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return '-'
  }

  return trimmed
}

function mapSignupRequestListItem(item: SignupRequestListItemResponse): SignupRequestListItem {
  return {
    id: item.requestId,
    submittedAt: normalizeText(formatSeoulDateTimeText(item.requestedAt)),
    applicantName: normalizeText(item.name),
    loginId: normalizeText(item.loginId),
    contact: normalizeText(item.phone),
    positionOrRole: normalizeText(item.positionName),
    teamName: normalizeText(item.teamName),
    requestNote: normalizeText(item.requestNote),
    status: item.requestStatus,
    canProcess: item.requestStatus === 'PENDING',
  }
}

function mapSignupRequestListPage(page: SignupRequestListPageResponse): SignupRequestListPage {
  return {
    items: page.items.map(mapSignupRequestListItem),
    page: page.page,
    size: page.size,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  }
}

function mapSignupRequestProcessResult(response: SignupRequestProcessResponse): SignupRequestProcessResult {
  return {
    requestId: response.requestId,
    userId: response.userId,
    requestStatus: response.requestStatus,
    userStatus: response.userStatus,
  }
}

export async function fetchSignupRequestPage(params?: SignupRequestListQuery): Promise<SignupRequestListPage> {
  const response = await http.get<ApiResponse<SignupRequestListPageResponse>>('/admin/signup-requests', { params })
  return mapSignupRequestListPage(response.data.data)
}

export async function approveSignupRequest(
  requestId: number,
  payload: ApproveSignupRequestRequest,
): Promise<SignupRequestProcessResult> {
  const response = await http.post<ApiResponse<SignupRequestProcessResponse>>(`/admin/signup-requests/${requestId}/approve`, payload)
  return mapSignupRequestProcessResult(response.data.data)
}

export async function rejectSignupRequest(
  requestId: number,
  payload: RejectSignupRequestRequest,
): Promise<SignupRequestProcessResult> {
  const response = await http.post<ApiResponse<SignupRequestProcessResponse>>(`/admin/signup-requests/${requestId}/reject`, payload)
  return mapSignupRequestProcessResult(response.data.data)
}
