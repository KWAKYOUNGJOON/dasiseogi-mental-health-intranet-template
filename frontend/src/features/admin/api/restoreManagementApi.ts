import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'

export const RESTORE_STATUS_OPTIONS = ['UPLOADED', 'VALIDATED', 'FAILED'] as const
export const RESTORE_DETECTED_ITEM_TYPES = ['DATABASE', 'CONFIG', 'SCALES', 'METADATA'] as const

export type RestoreStatus = (typeof RESTORE_STATUS_OPTIONS)[number]
export type RestoreDetectedItemType = (typeof RESTORE_DETECTED_ITEM_TYPES)[number]

interface RestoreHistoryListItemResponse {
  restoreId: number
  status: RestoreStatus
  fileName: string | null
  fileSizeBytes: number | null
  uploadedAt: string
  validatedAt: string | null
  uploadedByName: string | null
  formatVersion: string | null
  datasourceType: string | null
  backupId: number | null
  failureReason: string | null
}

interface RestoreHistoryPageResponse {
  items: RestoreHistoryListItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

interface RestoreDetectedItemResponse {
  itemType: RestoreDetectedItemType | string
  relativePaths: string[] | null
}

interface RestoreDetailResponse {
  restoreId: number
  status: RestoreStatus
  fileName: string | null
  uploadedAt: string
  validatedAt: string | null
  uploadedByName: string | null
  formatVersion: string | null
  datasourceType: string | null
  backupId: number | null
  failureReason: string | null
  detectedItems: RestoreDetectedItemResponse[]
}

interface RestoreUploadResponse {
  restoreId: number
  status: RestoreStatus
  fileName: string | null
  validatedAt: string | null
  formatVersion: string | null
  datasourceType: string | null
  backupId: number | null
  detectedItems: RestoreDetectedItemResponse[]
  failureReason: string | null
}

export interface RestoreDetectedItem {
  itemType: RestoreDetectedItemType | string
  relativePaths: string[]
}

export interface RestoreHistoryItem {
  id: number
  status: RestoreStatus
  fileName: string
  fileSizeLabel: string
  uploadedAt: string
  validatedAt: string
  uploadedByName: string
  formatVersion: string
  datasourceType: string
  backupId: number | null
  failureReason: string
}

export interface RestoreHistoryPage {
  items: RestoreHistoryItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface RestoreHistoryQuery {
  page?: number
  size?: number
}

export interface RestoreDetail {
  id: number
  status: RestoreStatus
  fileName: string
  uploadedAt: string
  validatedAt: string
  uploadedByName: string
  formatVersion: string
  datasourceType: string
  backupId: number | null
  failureReason: string
  detectedItems: RestoreDetectedItem[]
}

export interface RestoreUploadResult {
  restoreId: number
  status: RestoreStatus
  fileName: string
  validatedAt: string
  formatVersion: string
  datasourceType: string
  backupId: number | null
  detectedItems: RestoreDetectedItem[]
  failureReason: string
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

function mapDetectedItem(item: RestoreDetectedItemResponse): RestoreDetectedItem {
  return {
    itemType: item.itemType,
    relativePaths: item.relativePaths ?? [],
  }
}

function mapRestoreHistoryItem(item: RestoreHistoryListItemResponse): RestoreHistoryItem {
  return {
    id: item.restoreId,
    status: item.status,
    fileName: normalizeText(item.fileName),
    fileSizeLabel: formatFileSize(item.fileSizeBytes),
    uploadedAt: normalizeText(formatSeoulDateTimeText(item.uploadedAt)),
    validatedAt: normalizeText(formatSeoulDateTimeText(item.validatedAt)),
    uploadedByName: normalizeText(item.uploadedByName),
    formatVersion: normalizeText(item.formatVersion),
    datasourceType: normalizeText(item.datasourceType),
    backupId: item.backupId ?? null,
    failureReason: normalizeText(item.failureReason),
  }
}

function mapRestoreHistoryPage(page: RestoreHistoryPageResponse): RestoreHistoryPage {
  return {
    items: page.items.map(mapRestoreHistoryItem),
    page: page.page,
    size: page.size,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  }
}

function mapRestoreDetail(response: RestoreDetailResponse): RestoreDetail {
  return {
    id: response.restoreId,
    status: response.status,
    fileName: normalizeText(response.fileName),
    uploadedAt: normalizeText(formatSeoulDateTimeText(response.uploadedAt)),
    validatedAt: normalizeText(formatSeoulDateTimeText(response.validatedAt)),
    uploadedByName: normalizeText(response.uploadedByName),
    formatVersion: normalizeText(response.formatVersion),
    datasourceType: normalizeText(response.datasourceType),
    backupId: response.backupId ?? null,
    failureReason: normalizeText(response.failureReason),
    detectedItems: response.detectedItems.map(mapDetectedItem),
  }
}

function mapRestoreUploadResult(response: RestoreUploadResponse): RestoreUploadResult {
  return {
    restoreId: response.restoreId,
    status: response.status,
    fileName: normalizeText(response.fileName),
    validatedAt: normalizeText(formatSeoulDateTimeText(response.validatedAt)),
    formatVersion: normalizeText(response.formatVersion),
    datasourceType: normalizeText(response.datasourceType),
    backupId: response.backupId ?? null,
    detectedItems: response.detectedItems.map(mapDetectedItem),
    failureReason: normalizeText(response.failureReason),
  }
}

export async function fetchRestoreHistoryPage(params?: RestoreHistoryQuery) {
  const response = await http.get<ApiResponse<RestoreHistoryPageResponse>>('/admin/restores', { params })
  return mapRestoreHistoryPage(response.data.data)
}

export async function fetchRestoreDetail(restoreId: number) {
  const response = await http.get<ApiResponse<RestoreDetailResponse>>(`/admin/restores/${restoreId}`)
  return mapRestoreDetail(response.data.data)
}

export async function uploadRestoreZip(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await http.post<ApiResponse<RestoreUploadResponse>>('/admin/restores/upload', formData)
  return mapRestoreUploadResult(response.data.data)
}
