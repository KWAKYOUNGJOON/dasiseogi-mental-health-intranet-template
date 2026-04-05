import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'

export const RESTORE_STATUS_OPTIONS = [
  'UPLOADED',
  'VALIDATED',
  'PRE_BACKUP_RUNNING',
  'PRE_BACKUP_FAILED',
  'RESTORING',
  'SUCCESS',
  'FAILED',
] as const
export const RESTORE_DETECTED_ITEM_TYPES = ['DATABASE', 'CONFIG', 'SCALES', 'METADATA'] as const
export const RESTORE_EXECUTABLE_ITEM_TYPES = ['DATABASE'] as const
export const RESTORE_EXECUTION_CAPABILITY_OPTIONS = ['EXECUTABLE', 'BLOCKED'] as const

export type RestoreStatus = (typeof RESTORE_STATUS_OPTIONS)[number]
export type RestoreDetectedItemType = (typeof RESTORE_DETECTED_ITEM_TYPES)[number]
export type RestoreExecutableItemType = (typeof RESTORE_EXECUTABLE_ITEM_TYPES)[number]
export type RestoreExecutionCapability = (typeof RESTORE_EXECUTION_CAPABILITY_OPTIONS)[number]
export type RestoreConfirmationTextStatus = 'NOT_APPLICABLE' | 'WAITING_INPUT' | 'MATCHED' | 'MISMATCHED'

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
  executionCapability: RestoreExecutionCapability | string
  executionBlockedReason: string | null
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
  executedAt: string | null
  uploadedByName: string | null
  formatVersion: string | null
  datasourceType: string | null
  backupId: number | null
  selectedItemTypes: string[] | null
  preBackupId: number | null
  preBackupFileName: string | null
  failureReason: string | null
  detectedItems: RestoreDetectedItemResponse[]
  executionCapability: RestoreExecutionCapability | string
  executionBlockedReason: string | null
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
  executionCapability: RestoreExecutionCapability | string
  executionBlockedReason: string | null
}

interface RestoreExecuteResponse {
  restoreId: number
  status: RestoreStatus
  executedAt: string | null
  selectedItemTypes: string[] | null
  preBackupId: number | null
  preBackupFileName: string | null
  message: string | null
  failureReason: string | null
}

interface RestorePreparationGroupResponse {
  itemType: RestoreExecutableItemType | string
  relativePaths: string[] | null
  selectable: boolean
  selected: boolean
  blockedReason: string | null
}

interface RestorePreparationResponse {
  restoreId: number
  status: RestoreStatus
  confirmationRequiredText: string
  confirmationTextStatus: RestoreConfirmationTextStatus
  itemGroups: RestorePreparationGroupResponse[]
  selectedItemTypes: string[] | null
  selectedGroupCount: number
  confirmationTextMatched: boolean
  readyToExecute: boolean
  blockedReason: string | null
}

export interface RestoreDetectedItem {
  itemType: RestoreDetectedItemType | string
  relativePaths: string[]
}

export interface RestorePreparationGroup {
  itemType: RestoreExecutableItemType | string
  relativePaths: string[]
  selectable: boolean
  selected: boolean
  blockedReason: string | null
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
  executionCapability: RestoreExecutionCapability
  executionBlockedReason: string | null
}

export interface RestoreHistoryPage {
  items: RestoreHistoryItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface RestoreHistoryQuery {
  status?: RestoreStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  size?: number
}

export interface RestoreDetail {
  id: number
  status: RestoreStatus
  fileName: string
  uploadedAt: string
  validatedAt: string
  executedAt: string
  uploadedByName: string
  formatVersion: string
  datasourceType: string
  backupId: number | null
  selectedItemTypes: string[]
  preBackupId: number | null
  preBackupFileName: string
  failureReason: string
  detectedItems: RestoreDetectedItem[]
  executionCapability: RestoreExecutionCapability
  executionBlockedReason: string | null
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
  executionCapability: RestoreExecutionCapability
  executionBlockedReason: string | null
}

export interface RestoreExecuteParams {
  selectedItemTypes: string[]
  confirmationText: string
}

export interface RestoreExecuteResult {
  restoreId: number
  status: RestoreStatus
  executedAt: string
  selectedItemTypes: string[]
  preBackupId: number | null
  preBackupFileName: string
  message: string
  failureReason: string
}

export interface RestorePreparation {
  restoreId: number
  status: RestoreStatus
  confirmationRequiredText: string
  confirmationTextStatus: RestoreConfirmationTextStatus
  itemGroups: RestorePreparationGroup[]
  selectedItemTypes: string[]
  selectedGroupCount: number
  confirmationTextMatched: boolean
  readyToExecute: boolean
  blockedReason: string | null
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '-'
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeArray(values: string[] | null | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean)
}

function normalizeRestoreExecutionCapability(
  value: RestoreExecutionCapability | string | null | undefined,
): RestoreExecutionCapability {
  return value === 'EXECUTABLE' ? 'EXECUTABLE' : 'BLOCKED'
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

function mapPreparationGroup(item: RestorePreparationGroupResponse): RestorePreparationGroup {
  return {
    itemType: item.itemType,
    relativePaths: item.relativePaths ?? [],
    selectable: item.selectable,
    selected: item.selected,
    blockedReason: normalizeNullableText(item.blockedReason),
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
    executionCapability: normalizeRestoreExecutionCapability(item.executionCapability),
    executionBlockedReason: normalizeNullableText(item.executionBlockedReason),
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
    executedAt: normalizeText(formatSeoulDateTimeText(response.executedAt)),
    uploadedByName: normalizeText(response.uploadedByName),
    formatVersion: normalizeText(response.formatVersion),
    datasourceType: normalizeText(response.datasourceType),
    backupId: response.backupId ?? null,
    selectedItemTypes: normalizeArray(response.selectedItemTypes),
    preBackupId: response.preBackupId ?? null,
    preBackupFileName: normalizeText(response.preBackupFileName),
    failureReason: normalizeText(response.failureReason),
    detectedItems: response.detectedItems.map(mapDetectedItem),
    executionCapability: normalizeRestoreExecutionCapability(response.executionCapability),
    executionBlockedReason: normalizeNullableText(response.executionBlockedReason),
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
    executionCapability: normalizeRestoreExecutionCapability(response.executionCapability),
    executionBlockedReason: normalizeNullableText(response.executionBlockedReason),
  }
}

function mapRestoreExecuteResult(response: RestoreExecuteResponse): RestoreExecuteResult {
  return {
    restoreId: response.restoreId,
    status: response.status,
    executedAt: normalizeText(formatSeoulDateTimeText(response.executedAt)),
    selectedItemTypes: normalizeArray(response.selectedItemTypes),
    preBackupId: response.preBackupId ?? null,
    preBackupFileName: normalizeText(response.preBackupFileName),
    message: normalizeText(response.message),
    failureReason: normalizeText(response.failureReason),
  }
}

function mapRestorePreparation(response: RestorePreparationResponse): RestorePreparation {
  return {
    restoreId: response.restoreId,
    status: response.status,
    confirmationRequiredText: response.confirmationRequiredText,
    confirmationTextStatus: response.confirmationTextStatus,
    itemGroups: response.itemGroups.map(mapPreparationGroup),
    selectedItemTypes: normalizeArray(response.selectedItemTypes),
    selectedGroupCount: response.selectedGroupCount,
    confirmationTextMatched: response.confirmationTextMatched,
    readyToExecute: response.readyToExecute,
    blockedReason: normalizeNullableText(response.blockedReason),
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

export async function fetchRestorePreparation(restoreId: number, payload: RestoreExecuteParams) {
  const response = await http.post<ApiResponse<RestorePreparationResponse>>(`/admin/restores/${restoreId}/preparation`, payload)
  return mapRestorePreparation(response.data.data)
}

export async function uploadRestoreZip(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await http.post<ApiResponse<RestoreUploadResponse>>('/admin/restores/upload', formData)
  return mapRestoreUploadResult(response.data.data)
}

export async function executeRestore(restoreId: number, payload: RestoreExecuteParams) {
  const response = await http.post<ApiResponse<RestoreExecuteResponse>>(`/admin/restores/${restoreId}/execute`, payload)
  return mapRestoreExecuteResult(response.data.data)
}
