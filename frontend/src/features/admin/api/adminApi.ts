import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'

export interface SignupRequestPage {
  items: Array<{
    requestId: number
    requestedAt: string
    name: string
    loginId: string
    phone: string | null
    positionName: string | null
    teamName: string | null
    requestNote: string | null
    requestStatus: string
  }>
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface AdminUserPage {
  items: Array<{
    userId: number
    name: string
    loginId: string
    phone: string | null
    role: 'ADMIN' | 'USER'
    status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'REJECTED'
    approvedAt: string | null
    lastLoginAt: string | null
  }>
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface ActivityLogPage {
  items: Array<{
    id: number
    userId: number | null
    userNameSnapshot: string | null
    actionType: string
    targetType: string | null
    targetId: number | null
    targetLabel: string | null
    description: string | null
    ipAddress: string | null
    createdAt: string
  }>
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface BackupHistoryPage {
  items: Array<{
    backupId: number
    backupType: string
    backupMethod: string
    status: string
    fileName: string
    filePath: string
    fileSizeBytes: number | null
    startedAt: string
    completedAt: string | null
    executedByName: string | null
    failureReason: string | null
  }>
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export async function fetchSignupRequests(params?: { status?: string; page?: number; size?: number }) {
  const response = await http.get<ApiResponse<SignupRequestPage>>('/admin/signup-requests', { params })
  return response.data.data
}

export async function approveSignupRequest(requestId: number, processNote: string) {
  const response = await http.post<ApiResponse<{ requestId: number; userId: number; requestStatus: string; userStatus: string }>>(
    `/admin/signup-requests/${requestId}/approve`,
    { processNote },
  )
  return response.data.data
}

export async function rejectSignupRequest(requestId: number, processNote: string) {
  const response = await http.post<ApiResponse<{ requestId: number; userId: number; requestStatus: string; userStatus: string }>>(
    `/admin/signup-requests/${requestId}/reject`,
    { processNote },
  )
  return response.data.data
}

export async function fetchAdminUsers(params?: {
  keyword?: string
  role?: string
  status?: string
  page?: number
  size?: number
}) {
  const response = await http.get<ApiResponse<AdminUserPage>>('/admin/users', { params })
  return response.data.data
}

export async function updateUserRole(userId: number, role: 'ADMIN' | 'USER') {
  const response = await http.patch<ApiResponse<{ userId: number; role: string; status: string }>>(`/admin/users/${userId}/role`, { role })
  return response.data.data
}

export async function updateUserStatus(userId: number, status: 'ACTIVE' | 'INACTIVE') {
  const response = await http.patch<ApiResponse<{ userId: number; role: string; status: string }>>(`/admin/users/${userId}/status`, { status })
  return response.data.data
}

export async function fetchActivityLogs(params?: {
  dateFrom?: string
  dateTo?: string
  userId?: number
  actionType?: string
  page?: number
  size?: number
}) {
  const response = await http.get<ApiResponse<ActivityLogPage>>('/admin/activity-logs', { params })
  return response.data.data
}

export async function fetchBackups(params?: {
  backupType?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  size?: number
}) {
  const response = await http.get<ApiResponse<BackupHistoryPage>>('/admin/backups', { params })
  return response.data.data
}

export async function runManualBackup(reason: string) {
  const response = await http.post<ApiResponse<{
    backupId: number
    backupType: string
    backupMethod: string
    datasourceType: string
    preflightSummary: string
    status: string
    fileName: string
    filePath: string
  }>>(
    '/admin/backups/run',
    { reason },
  )
  return response.data.data
}
