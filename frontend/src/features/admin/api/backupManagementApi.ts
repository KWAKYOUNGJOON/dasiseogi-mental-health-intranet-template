import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'

export const BACKUP_TYPE_OPTIONS = ['AUTO', 'MANUAL'] as const
export const BACKUP_STATUS_OPTIONS = ['SUCCESS', 'FAILED'] as const

export type BackupType = (typeof BACKUP_TYPE_OPTIONS)[number]
export type BackupStatus = (typeof BACKUP_STATUS_OPTIONS)[number]

interface BackupHistoryListItemResponse {
  backupId: number
  backupType: BackupType
  backupMethod: string
  status: BackupStatus
  fileName: string | null
  filePath: string | null
  fileSizeBytes: number | null
  startedAt: string
  completedAt: string | null
  executedByName: string | null
  failureReason: string | null
}

interface BackupHistoryPageResponse {
  items: BackupHistoryListItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

interface ManualBackupRunResponse {
  backupId: number
  backupType: BackupType
  backupMethod: string
  datasourceType: string
  preflightSummary: string
  status: BackupStatus
  fileName: string
  filePath: string
}

export interface BackupHistoryItem {
  id: number
  backupType: BackupType
  backupMethod: string
  status: BackupStatus
  fileName: string
  filePath: string
  fileSizeLabel: string
  startedAt: string
  completedAt: string
  executedByName: string
  failureReason: string
}

export interface BackupHistoryPage {
  items: BackupHistoryItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface BackupHistoryQuery {
  backupType?: BackupType
  status?: BackupStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  size?: number
}

export interface ManualBackupRunResult {
  backupId: number
  backupType: BackupType
  backupMethod: string
  datasourceType: string
  preflightSummary: string
  status: BackupStatus
  fileName: string
  filePath: string
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '-'
}

function formatFileSize(fileSizeBytes: number | null) {
  if (fileSizeBytes == null) {
    return '-'
  }
  if (fileSizeBytes < 1024) {
    return `${fileSizeBytes} B`
  }
  if (fileSizeBytes < 1024 * 1024) {
    return `${(fileSizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function mapBackupHistoryItem(item: BackupHistoryListItemResponse): BackupHistoryItem {
  return {
    id: item.backupId,
    backupType: item.backupType,
    backupMethod: item.backupMethod,
    status: item.status,
    fileName: normalizeText(item.fileName),
    filePath: normalizeText(item.filePath),
    fileSizeLabel: formatFileSize(item.fileSizeBytes),
    startedAt: normalizeText(item.startedAt),
    completedAt: normalizeText(item.completedAt),
    executedByName: normalizeText(item.executedByName),
    failureReason: normalizeText(item.failureReason),
  }
}

function mapBackupHistoryPage(page: BackupHistoryPageResponse): BackupHistoryPage {
  return {
    items: page.items.map(mapBackupHistoryItem),
    page: page.page,
    size: page.size,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  }
}

function mapManualBackupRunResult(response: ManualBackupRunResponse): ManualBackupRunResult {
  return {
    backupId: response.backupId,
    backupType: response.backupType,
    backupMethod: response.backupMethod,
    datasourceType: response.datasourceType,
    preflightSummary: response.preflightSummary,
    status: response.status,
    fileName: response.fileName,
    filePath: response.filePath,
  }
}

export async function fetchBackupHistoryPage(params?: BackupHistoryQuery) {
  const response = await http.get<ApiResponse<BackupHistoryPageResponse>>('/admin/backups', { params })
  return mapBackupHistoryPage(response.data.data)
}

export async function fetchLatestBackupHistory() {
  const response = await fetchBackupHistoryPage({ page: 1, size: 1 })
  return response.items[0] ?? null
}

export async function runManualBackup(reason?: string) {
  const trimmedReason = reason?.trim()
  const response = await http.post<ApiResponse<ManualBackupRunResponse>>('/admin/backups/run', {
    reason: trimmedReason || undefined,
  })
  return mapManualBackupRunResult(response.data.data)
}
