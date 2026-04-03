import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'

export const ACTIVITY_LOG_ACTION_OPTIONS = [
  'LOGIN',
  'SIGNUP_REQUEST',
  'SIGNUP_APPROVE',
  'SIGNUP_REJECT',
  'USER_ROLE_CHANGE',
  'USER_STATUS_CHANGE',
  'CLIENT_CREATE',
  'CLIENT_UPDATE',
  'CLIENT_MARK_MISREGISTERED',
  'SESSION_CREATE',
  'SESSION_MARK_MISENTERED',
  'PRINT_SESSION',
  'STATISTICS_EXPORT',
  'BACKUP_RUN',
] as const

export type ActivityLogActionType = (typeof ACTIVITY_LOG_ACTION_OPTIONS)[number]

interface ActivityLogListItemResponse {
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
}

interface ActivityLogPageResponse {
  items: ActivityLogListItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface ActivityLogListItem {
  id: number
  actorName: string
  actionType: string
  targetType: string
  targetId: string
  summary: string
  ipAddress: string
  createdAt: string
}

export interface ActivityLogPage {
  items: ActivityLogListItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface ActivityLogQuery {
  dateFrom?: string
  dateTo?: string
  userId?: number
  actionType?: ActivityLogActionType
  page?: number
  size?: number
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '-'
}

function mapActivityLogItem(item: ActivityLogListItemResponse): ActivityLogListItem {
  return {
    id: item.id,
    actorName: normalizeText(item.userNameSnapshot),
    actionType: item.actionType,
    targetType: normalizeText(item.targetType),
    targetId: item.targetId == null ? '-' : String(item.targetId),
    summary: normalizeText(item.description),
    ipAddress: normalizeText(item.ipAddress),
    createdAt: normalizeText(formatSeoulDateTimeText(item.createdAt)),
  }
}

function mapActivityLogPage(page: ActivityLogPageResponse): ActivityLogPage {
  return {
    items: page.items.map(mapActivityLogItem),
    page: page.page,
    size: page.size,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  }
}

export async function fetchActivityLogPage(params?: ActivityLogQuery) {
  const response = await http.get<ApiResponse<ActivityLogPageResponse>>('/admin/activity-logs', { params })
  return mapActivityLogPage(response.data.data)
}
