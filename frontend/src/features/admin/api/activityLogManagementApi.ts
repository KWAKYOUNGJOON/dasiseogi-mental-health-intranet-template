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
  'USER_POSITION_NAME_CHANGE',
  'USER_PROFILE_UPDATE',
  'CLIENT_CREATE',
  'CLIENT_UPDATE',
  'CLIENT_MARK_MISREGISTERED',
  'SESSION_CREATE',
  'SESSION_MARK_MISENTERED',
  'PRINT_SESSION',
  'STATISTICS_EXPORT',
  'BACKUP_RUN',
] as const

export const ACTIVITY_LOG_PAGE_SIZE_OPTIONS = [20, 50, 100] as const

export type ActivityLogActionType = (typeof ACTIVITY_LOG_ACTION_OPTIONS)[number]
export type ActivityLogPageSize = (typeof ACTIVITY_LOG_PAGE_SIZE_OPTIONS)[number]

type ActivityLogTargetType = 'USER' | 'SIGNUP_REQUEST' | 'CLIENT' | 'SESSION' | 'STATISTICS' | 'BACKUP'

interface ActivityLogListItemResponse {
  id: number
  userId: number | null
  userNameSnapshot: string | null
  actionType: ActivityLogActionType
  targetType: ActivityLogTargetType | null
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
  occurredAt: string
  userLabel: string
  ipAddress: string
  actionType: ActivityLogActionType
  target: string
  description: string
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
  size?: ActivityLogPageSize
}

export const DEFAULT_ACTIVITY_LOG_PAGE_SIZE: ActivityLogPageSize = 20

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return '-'
  }

  return trimmed
}

function formatUserLabel(userId: number | null, userNameSnapshot: string | null) {
  const normalizedUserName = normalizeText(userNameSnapshot)

  if (userId == null) {
    return normalizedUserName
  }

  if (normalizedUserName === '-') {
    return `#${userId}`
  }

  return `${normalizedUserName} (#${userId})`
}

function formatTargetMetadata(targetType: ActivityLogTargetType | null, targetId: number | null) {
  const normalizedTargetType = normalizeText(targetType)

  if (normalizedTargetType === '-' && targetId == null) {
    return ''
  }

  if (normalizedTargetType === '-') {
    return `#${targetId}`
  }

  if (targetId == null) {
    return normalizedTargetType
  }

  return `${normalizedTargetType} #${targetId}`
}

function formatTargetLabel(item: ActivityLogListItemResponse) {
  const normalizedTargetLabel = normalizeText(item.targetLabel)
  const targetMetadata = formatTargetMetadata(item.targetType, item.targetId)

  if (normalizedTargetLabel !== '-' && targetMetadata) {
    return `${normalizedTargetLabel} (${targetMetadata})`
  }

  if (normalizedTargetLabel !== '-') {
    return normalizedTargetLabel
  }

  return targetMetadata || '-'
}

function mapActivityLogItem(item: ActivityLogListItemResponse): ActivityLogListItem {
  return {
    id: item.id,
    occurredAt: normalizeText(formatSeoulDateTimeText(item.createdAt)),
    userLabel: formatUserLabel(item.userId, item.userNameSnapshot),
    ipAddress: normalizeText(item.ipAddress),
    actionType: item.actionType,
    target: formatTargetLabel(item),
    description: normalizeText(item.description),
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

export async function fetchActivityLogPage(params?: ActivityLogQuery): Promise<ActivityLogPage> {
  const response = await http.get<ApiResponse<ActivityLogPageResponse>>('/admin/activity-logs', { params })
  return mapActivityLogPage(response.data.data)
}
