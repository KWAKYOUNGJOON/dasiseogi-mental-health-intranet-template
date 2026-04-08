import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'
import {
  getDefaultSignupRequestFilterStatus,
  type AdminManagedUserStatus,
  type SignupRequestManagementStatus,
} from '../adminManagementMetadata'

export type SignupRequestApprovalStatus = SignupRequestManagementStatus
export type SignupRequestApprovalUserStatus = AdminManagedUserStatus

interface SignupRequestApprovalItemResponse {
  requestId: number
  requestedAt: string
  name: string
  loginId: string
  phone: string | null
  positionName: string | null
  teamName: string | null
  requestNote: string | null
  requestStatus: SignupRequestApprovalStatus
}

interface SignupRequestApprovalPageResponse {
  items: SignupRequestApprovalItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

interface SignupRequestProcessResponse {
  requestId: number
  userId: number
  requestStatus: SignupRequestApprovalStatus
  userStatus: SignupRequestApprovalUserStatus
}

export interface SignupRequestApprovalItem {
  id: number
  submittedAt: string
  applicantName: string
  loginId: string
  contact: string
  positionName: string
  teamName: string
  requestNote: string
  status: SignupRequestApprovalStatus
  canProcess: boolean
}

export interface SignupRequestApprovalPage {
  items: SignupRequestApprovalItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface SignupRequestApprovalProcessResult {
  requestId: number
  userId: number
  requestStatus: SignupRequestApprovalStatus
  userStatus: SignupRequestApprovalUserStatus
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '-'
}

function mapSignupRequestApprovalItem(item: SignupRequestApprovalItemResponse): SignupRequestApprovalItem {
  return {
    id: item.requestId,
    submittedAt: formatSeoulDateTimeText(item.requestedAt),
    applicantName: item.name,
    loginId: item.loginId,
    contact: normalizeText(item.phone),
    positionName: normalizeText(item.positionName),
    teamName: normalizeText(item.teamName),
    requestNote: normalizeText(item.requestNote),
    status: item.requestStatus,
    canProcess: item.requestStatus === getDefaultSignupRequestFilterStatus(),
  }
}

function mapSignupRequestApprovalPage(page: SignupRequestApprovalPageResponse): SignupRequestApprovalPage {
  return {
    items: page.items.map(mapSignupRequestApprovalItem),
    page: page.page,
    size: page.size,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  }
}

function mapSignupRequestProcessResult(response: SignupRequestProcessResponse): SignupRequestApprovalProcessResult {
  return {
    requestId: response.requestId,
    userId: response.userId,
    requestStatus: response.requestStatus,
    userStatus: response.userStatus,
  }
}

export async function fetchSignupRequestApprovalQueue(params?: { page?: number; size?: number }) {
  const response = await http.get<ApiResponse<SignupRequestApprovalPageResponse>>('/admin/signup-requests', {
    params: {
      status: getDefaultSignupRequestFilterStatus(),
      ...params,
    },
  })
  return mapSignupRequestApprovalPage(response.data.data)
}

export async function approveSignupRequest(requestId: number, processNote: string) {
  const response = await http.post<ApiResponse<SignupRequestProcessResponse>>(`/admin/signup-requests/${requestId}/approve`, {
    processNote,
  })
  return mapSignupRequestProcessResult(response.data.data)
}

export async function rejectSignupRequest(requestId: number, processNote: string) {
  const response = await http.post<ApiResponse<SignupRequestProcessResponse>>(`/admin/signup-requests/${requestId}/reject`, {
    processNote,
  })
  return mapSignupRequestProcessResult(response.data.data)
}
