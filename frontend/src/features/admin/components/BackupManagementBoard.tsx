import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { DateTextInput } from '../../../shared/components/DateTextInput'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { ApiResponse } from '../../../shared/types/api'
import { toValidDateText } from '../../../shared/utils/dateText'
import {
  BACKUP_STATUS_OPTIONS,
  BACKUP_TYPE_OPTIONS,
  fetchBackupHistoryPage,
  fetchLatestBackupHistory,
  runManualBackup,
  type BackupHistoryItem,
  type BackupHistoryPage,
  type BackupHistoryQuery,
  type BackupStatus,
  type BackupType,
} from '../api/backupManagementApi'
import {
  RESTORE_DETECTED_ITEM_TYPES,
  RESTORE_EXECUTABLE_ITEM_TYPES,
  RESTORE_STATUS_OPTIONS,
  executeRestore,
  fetchRestoreDetail,
  fetchRestorePreparation,
  fetchRestoreHistoryPage,
  uploadRestoreZip,
  type RestoreConfirmationTextStatus,
  type RestoreDetectedItem,
  type RestoreDetail,
  type RestoreExecutableItemType,
  type RestoreExecutionCapability,
  type RestoreHistoryPage,
  type RestoreHistoryQuery,
  type RestorePreparation,
  type RestorePreparationGroup,
  type RestoreStatus,
} from '../api/restoreManagementApi'

type Notice = { type: 'success' | 'error'; text: string } | null
type DetailError = { errorCode: string | null; text: string } | null
type DialogFieldErrors = Partial<Record<'reason', string>>

interface FilterState {
  backupType: '' | BackupType
  status: '' | BackupStatus
  dateFrom: string
  dateTo: string
}

interface RestoreFilterState {
  status: '' | RestoreStatus
  dateFrom: string
  dateTo: string
}

interface DateRangeFilterState {
  dateFrom: string
  dateTo: string
}

function createDefaultFilters(): FilterState {
  return {
    backupType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  }
}

function createDefaultRestoreFilters(): RestoreFilterState {
  return {
    status: '',
    dateFrom: '',
    dateTo: '',
  }
}

const PAGE_SIZE = 20
const RESTORE_PAGE_SIZE = 20
const EMPTY_STATE_MESSAGE = '조건에 맞는 백업 이력이 없습니다.'
const RESTORE_EMPTY_STATE_MESSAGE = '등록된 복원 검증 이력이 없습니다.'
const RESTORE_FILTERED_EMPTY_STATE_MESSAGE = '조건에 맞는 복원 검증 이력이 없습니다.'
const INVALID_DATE_RANGE_MESSAGE = '조회 기간을 다시 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.'
const GENERIC_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const GENERIC_LIST_ERROR_MESSAGE = '백업 이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_RUN_ERROR_MESSAGE = '수동 백업 실행에 실패했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_RESTORE_UPLOAD_ERROR_MESSAGE = '복원 ZIP 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_RESTORE_LIST_ERROR_MESSAGE = '복원 검증 이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_RESTORE_DETAIL_ERROR_MESSAGE = '복원 검증 상세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
const GENERIC_RESTORE_EXECUTE_ERROR_MESSAGE = '복원 실행에 실패했습니다. 잠시 후 다시 시도해주세요.'
const BACKUP_PATH_GUIDE = '백업 저장 경로는 운영 설정(APP_BACKUP_ROOT_PATH)을 따릅니다.'
const RESTORE_DETAIL_EMPTY_MESSAGE = '복원 검증 이력을 선택하면 상세를 확인할 수 있습니다.'
const RESTORE_UPLOADED_GUIDE = '아직 검증 완료 전 상태입니다. 검증이 끝나면 validatedAt 과 detectedItems 를 확인할 수 있습니다.'
const RESTORE_FAILED_DETECTED_ITEMS_GUIDE = '실패 상태여도 검증 완료된 ZIP 은 detectedItems 를 다시 확인할 수 있습니다.'
const RESTORE_VALIDATED_DETECTED_ITEMS_GUIDE = '검증된 항목은 그룹별 relativePaths 기준으로 확인할 수 있습니다.'
const RESTORE_PREPARATION_CONFIRMATION_TEXT = '전체 복원을 실행합니다'
const RESTORE_PREPARATION_SELECTION_GUIDE = 'VALIDATED 상태의 복원 검증 상세에서만 DATABASE 복원 실행을 진행할 수 있습니다.'
const RESTORE_PREPARATION_CONFIRMATION_ERROR = '확인 문구가 정확히 일치하지 않습니다.'
const RESTORE_EXECUTION_SCOPE_GUIDE = '현재 버전에서는 DATABASE 그룹만 실제 복원 가능합니다.'
const RESTORE_PREPARATION_LOADING_MESSAGE = '서버 기준 복원 실행 준비 상태를 계산하는 중입니다.'
const RESTORE_PREPARATION_DISPLAY_ONLY_GUIDE = 'CONFIG, SCALES, METADATA 는 검증 참고용이며 현재 체크 가능한 복원 대상이 아닙니다.'
const RESTORE_CONFIRMATION_SKIPPED_GUIDE = '현재는 복원 실행 자체가 불가하여 확인 문구를 판단하지 않습니다.'
const BACKUP_TYPE_FILTER_LABELS: Readonly<Partial<Record<BackupType, string>>> = {
  AUTO: '자동 백업',
  MANUAL: '수동 백업',
}
const BACKUP_STATUS_FILTER_LABELS: Readonly<Partial<Record<BackupStatus, string>>> = {
  SUCCESS: '성공',
  FAILED: '실패',
}
const RESTORE_STATUS_FILTER_LABELS: Readonly<Partial<Record<RestoreStatus, string>>> = {
  UPLOADED: '업로드 완료',
  VALIDATED: '검증 완료',
  PRE_BACKUP_RUNNING: '사전 백업 진행 중',
  PRE_BACKUP_FAILED: '사전 백업 실패',
  RESTORING: '복원 진행 중',
  SUCCESS: '성공',
  FAILED: '실패',
}

function getApiResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return undefined
  }

  return error.response?.data
}

function getFallbackMessage(message: string | null | undefined, fallbackMessage: string) {
  const trimmedMessage = message?.trim()
  return trimmedMessage ? trimmedMessage : fallbackMessage
}

function getListErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_LIST_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return getFallbackMessage(response.message, '관리자 권한이 필요합니다.')
    case 'INVALID_DATE_RANGE':
      return getFallbackMessage(response.message, '조회 기간을 다시 확인해주세요.')
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    default:
      return GENERIC_LIST_ERROR_MESSAGE
  }
}

function getRunErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_RUN_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
    case 'BACKUP_RUN_FORBIDDEN':
      return getFallbackMessage(response.message, '수동 백업 실행 권한이 없습니다.')
    case 'BACKUP_ALREADY_RUNNING':
      return getFallbackMessage(response.message, '이미 백업이 실행 중입니다.')
    case 'BACKUP_PATH_NOT_WRITABLE':
      return getFallbackMessage(response.message, '백업 경로를 사용할 수 없습니다.')
    case 'BACKUP_RUN_FAILED':
      return getFallbackMessage(response.message, '백업 실행에 실패했습니다.')
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    default:
      return GENERIC_RUN_ERROR_MESSAGE
  }
}

function getRestoreUploadErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_RESTORE_UPLOAD_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
    case 'RESTORE_UPLOAD_FORBIDDEN':
      return getFallbackMessage(response.message, '복원 ZIP 업로드 권한이 없습니다.')
    case 'VALIDATION_ERROR':
    case 'RESTORE_FILE_INVALID':
    case 'RESTORE_MANIFEST_INVALID':
    case 'RESTORE_UPLOAD_FAILED':
      return getFallbackMessage(response.message, GENERIC_RESTORE_UPLOAD_ERROR_MESSAGE)
    default:
      return getFallbackMessage(response.message, GENERIC_RESTORE_UPLOAD_ERROR_MESSAGE)
  }
}

function getRestoreListErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_RESTORE_LIST_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
      return getFallbackMessage(response.message, '관리자 권한이 필요합니다.')
    case 'INVALID_DATE_RANGE':
      return getFallbackMessage(response.message, '조회 기간을 다시 확인해주세요.')
    case 'VALIDATION_ERROR':
      return getFallbackMessage(response.message, GENERIC_VALIDATION_MESSAGE)
    default:
      return getFallbackMessage(response.message, GENERIC_RESTORE_LIST_ERROR_MESSAGE)
  }
}

function getRestoreDetailError(response: ApiResponse<unknown> | undefined): DetailError {
  if (!response) {
    return {
      errorCode: null,
      text: GENERIC_RESTORE_DETAIL_ERROR_MESSAGE,
    }
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
    case 'RESTORE_DETAIL_FORBIDDEN':
      return {
        errorCode: response.errorCode,
        text: getFallbackMessage(response.message, '복원 검증 상세를 조회할 권한이 없습니다.'),
      }
    case 'RESTORE_HISTORY_NOT_FOUND':
      return {
        errorCode: response.errorCode,
        text: getFallbackMessage(response.message, '복원 검증 이력을 찾을 수 없습니다.'),
      }
    case 'RESTORE_ARCHIVE_UNAVAILABLE':
      return {
        errorCode: response.errorCode,
        text: getFallbackMessage(response.message, '저장된 복원 ZIP 파일을 사용할 수 없습니다.'),
      }
    case 'RESTORE_DETAIL_FAILED':
      return {
        errorCode: response.errorCode,
        text: getFallbackMessage(response.message, GENERIC_RESTORE_DETAIL_ERROR_MESSAGE),
      }
    default:
      return {
        errorCode: response.errorCode ?? null,
        text: getFallbackMessage(response.message, GENERIC_RESTORE_DETAIL_ERROR_MESSAGE),
      }
  }
}

function getRestoreExecuteErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_RESTORE_EXECUTE_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
    case 'RESTORE_EXECUTE_FORBIDDEN':
      return getFallbackMessage(response.message, '복원 실행 권한이 없습니다.')
    case 'RESTORE_HISTORY_NOT_FOUND':
      return getFallbackMessage(response.message, '복원 검증 이력을 찾을 수 없습니다.')
    case 'RESTORE_EXECUTE_INVALID_STATUS':
      return getFallbackMessage(response.message, 'VALIDATED 상태의 복원 검증 이력만 실행할 수 있습니다.')
    case 'RESTORE_CONFIRMATION_TEXT_MISMATCH':
      return getFallbackMessage(response.message, RESTORE_PREPARATION_CONFIRMATION_ERROR)
    case 'RESTORE_ITEM_SELECTION_INVALID':
      return getFallbackMessage(response.message, 'DATABASE 복원 대상을 다시 확인해주세요.')
    case 'RESTORE_UNSUPPORTED_ITEM_TYPE':
      return getFallbackMessage(response.message, RESTORE_EXECUTION_SCOPE_GUIDE)
    case 'RESTORE_UNSUPPORTED_DATASOURCE':
      return getFallbackMessage(response.message, '현재 버전에서는 MariaDB/MySQL DATABASE 복원만 지원합니다.')
    case 'RESTORE_ARCHIVE_UNAVAILABLE':
      return getFallbackMessage(response.message, '저장된 복원 ZIP 파일을 사용할 수 없습니다.')
    default:
      return getFallbackMessage(response.message, GENERIC_RESTORE_EXECUTE_ERROR_MESSAGE)
  }
}

function getRestorePreparationErrorMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_RESTORE_DETAIL_ERROR_MESSAGE
  }

  switch (response.errorCode) {
    case 'FORBIDDEN':
    case 'RESTORE_PREPARATION_FORBIDDEN':
      return getFallbackMessage(response.message, '복원 실행 준비 상태를 조회할 권한이 없습니다.')
    case 'RESTORE_HISTORY_NOT_FOUND':
      return getFallbackMessage(response.message, '복원 검증 이력을 찾을 수 없습니다.')
    case 'RESTORE_ARCHIVE_UNAVAILABLE':
      return getFallbackMessage(response.message, '저장된 복원 ZIP 파일을 사용할 수 없습니다.')
    default:
      return getFallbackMessage(response.message, GENERIC_RESTORE_DETAIL_ERROR_MESSAGE)
  }
}

function mapDialogFieldErrors(response: ApiResponse<unknown> | undefined): DialogFieldErrors {
  return (response?.fieldErrors ?? []).reduce<DialogFieldErrors>((errors, fieldError) => {
    if (fieldError.field === 'reason') {
      errors.reason = fieldError.reason
    }

    return errors
  }, {})
}

function getBackupStatusChipStyle(status: BackupStatus): CSSProperties {
  if (status === 'SUCCESS') {
    return {
      color: '#1d6a53',
      background: '#dff1ea',
    }
  }

  return {
    color: '#9d2f2f',
    background: '#f8e1e1',
  }
}

function getRestoreStatusChipStyle(status: RestoreStatus): CSSProperties {
  switch (status) {
    case 'VALIDATED':
    case 'SUCCESS':
      return {
        color: '#1d6a53',
        background: '#dff1ea',
      }
    case 'PRE_BACKUP_RUNNING':
    case 'RESTORING':
      return {
        color: '#805200',
        background: '#fff1cf',
      }
    case 'PRE_BACKUP_FAILED':
    case 'FAILED':
      return {
        color: '#9d2f2f',
        background: '#f8e1e1',
      }
    default:
      return {
        color: '#1d537d',
        background: '#dceaf7',
      }
  }
}

function formatBackupTypeFilterOptionLabel(backupType: string) {
  const description = BACKUP_TYPE_FILTER_LABELS[backupType as BackupType]

  if (!description) {
    return backupType
  }

  return `${backupType} (${description})`
}

function formatBackupStatusFilterOptionLabel(status: string) {
  const description = BACKUP_STATUS_FILTER_LABELS[status as BackupStatus]

  if (!description) {
    return status
  }

  return `${status} (${description})`
}

function formatRestoreStatusFilterOptionLabel(status: string) {
  const description = RESTORE_STATUS_FILTER_LABELS[status as RestoreStatus]

  if (!description) {
    return status
  }

  return `${status} (${description})`
}

function buildQuery(filters: FilterState): Omit<BackupHistoryQuery, 'page' | 'size'> {
  return {
    backupType: filters.backupType || undefined,
    status: filters.status || undefined,
    dateFrom: toValidDateText(filters.dateFrom) || undefined,
    dateTo: toValidDateText(filters.dateTo) || undefined,
  }
}

function buildRestoreHistoryQuery(filters: RestoreFilterState): Omit<RestoreHistoryQuery, 'page' | 'size'> {
  return {
    status: filters.status || undefined,
    dateFrom: toValidDateText(filters.dateFrom) || undefined,
    dateTo: toValidDateText(filters.dateTo) || undefined,
  }
}

function hasInvalidDateRange(filters: DateRangeFilterState) {
  const dateFrom = toValidDateText(filters.dateFrom)
  const dateTo = toValidDateText(filters.dateTo)

  if (!dateFrom || !dateTo) {
    return false
  }

  return dateFrom > dateTo
}

function hasRestoreHistoryFilters(filters: RestoreFilterState) {
  return Boolean(filters.status || toValidDateText(filters.dateFrom) || toValidDateText(filters.dateTo))
}

function getLatestBackupTimestamp(latestBackup: BackupHistoryItem | null) {
  if (!latestBackup) {
    return '아직 백업 이력이 없습니다.'
  }

  return latestBackup.completedAt !== '-' ? latestBackup.completedAt : latestBackup.startedAt
}

function getLatestBackupPath(latestBackup: BackupHistoryItem | null) {
  if (!latestBackup || latestBackup.filePath === '-') {
    return BACKUP_PATH_GUIDE
  }

  return latestBackup.filePath
}

function formatOptionalNumber(value: number | null) {
  if (value == null) {
    return '-'
  }

  return String(value)
}

function getRestorePreparationStatusChipStyle(isReady: boolean): CSSProperties {
  if (isReady) {
    return {
      color: '#1d6a53',
      background: '#dff1ea',
    }
  }

  return {
    color: '#9d2f2f',
    background: '#f8e1e1',
  }
}

function getRestoreExecutionCapabilityChipStyle(capability: RestoreExecutionCapability): CSSProperties {
  if (capability === 'EXECUTABLE') {
    return {
      color: '#1d6a53',
      background: '#dff1ea',
    }
  }

  return {
    color: '#9d2f2f',
    background: '#f8e1e1',
  }
}

function getRestoreExecutionCapabilityLabel(capability: RestoreExecutionCapability) {
  return capability === 'EXECUTABLE' ? '실행 가능' : '실행 불가'
}

function normalizeInlineText(value: string | null) {
  return value ? value.replaceAll('\n', ' / ') : null
}

function buildRestoreUploadSuccessNotice(result: {
  fileName: string
  restoreId: number
  executionCapability: RestoreExecutionCapability
  executionBlockedReason: string | null
}) {
  const executionSummary =
    result.executionCapability === 'EXECUTABLE'
      ? '현재 버전에서 복원 실행 가능합니다.'
      : `현재 버전에서는 복원 실행이 불가합니다. 사유: ${normalizeInlineText(result.executionBlockedReason) ?? '상세 화면에서 사유를 확인해주세요.'}`

  return `${result.fileName} 업로드/검증이 완료되었습니다. ${executionSummary} restoreId ${result.restoreId} 상세를 확인하세요.`
}

function getRestoreConfirmationStatusChipStyle(status: RestoreConfirmationTextStatus): CSSProperties {
  switch (status) {
    case 'MATCHED':
      return {
        color: '#1d6a53',
        background: '#dff1ea',
      }
    case 'MISMATCHED':
      return {
        color: '#9d2f2f',
        background: '#f8e1e1',
      }
    case 'WAITING_INPUT':
      return {
        color: '#1d537d',
        background: '#dceaf7',
      }
    default:
      return {
        color: '#805200',
        background: '#fff1cf',
      }
  }
}

function getRestoreConfirmationStatusLabel(status: RestoreConfirmationTextStatus) {
  switch (status) {
    case 'MATCHED':
      return '일치'
    case 'MISMATCHED':
      return '불일치'
    case 'WAITING_INPUT':
      return '입력 대기'
    default:
      return '판단 제외'
  }
}

function getRestoreConfirmationStatusMessage(
  status: RestoreConfirmationTextStatus,
  confirmationRequiredText: string,
) {
  switch (status) {
    case 'MATCHED':
      return '서버 기준 확인 문구가 정확히 일치합니다.'
    case 'MISMATCHED':
      return RESTORE_PREPARATION_CONFIRMATION_ERROR
    case 'WAITING_INPUT':
      return `확인 문구를 ${confirmationRequiredText} 로 정확히 입력해주세요.`
    default:
      return RESTORE_CONFIRMATION_SKIPPED_GUIDE
  }
}

function getRestoreGroupAvailabilityLabel(group: RestorePreparationGroup) {
  if (group.selectable) {
    return `선택 가능 (${group.relativePaths.length}개)`
  }
  return group.relativePaths.length > 0 ? '실행 불가' : '대상 없음'
}

function getRestoreSelectedGroupSummary(
  preparationGroups: RestorePreparationGroup[],
  selectedItemTypes: RestoreExecutableItemType[],
  preparationLoaded: boolean,
) {
  if (selectedItemTypes.length > 0) {
    return selectedItemTypes.join(', ')
  }

  if (!preparationLoaded) {
    return '서버 준비 상태 확인 전'
  }

  if (preparationGroups.length === 0) {
    return '선택 가능한 그룹 계산 전'
  }

  return '선택된 그룹 없음'
}

function isRestoreExecutableItemType(value: string): value is RestoreExecutableItemType {
  return RESTORE_EXECUTABLE_ITEM_TYPES.includes(value as RestoreExecutableItemType)
}

interface RestoreDetectedItemsCardsProps {
  detectedItems: RestoreDetectedItem[]
  emptyHint: string
}

function RestoreDetectedItemsCards({ detectedItems, emptyHint }: RestoreDetectedItemsCardsProps) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <strong>detectedItems</strong>
        <span className="muted">{emptyHint}</span>
      </div>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        {RESTORE_DETECTED_ITEM_TYPES.map((itemType) => {
          const relativePaths = detectedItems.find((item) => item.itemType === itemType)?.relativePaths ?? []

          return (
            <section
              key={itemType}
              style={{
                padding: 16,
                border: '1px solid #d8e1ea',
                borderRadius: 14,
                background: '#fbfdff',
              }}
            >
              <div className="stack" style={{ gap: 10 }}>
                <strong>{itemType}</strong>
                {relativePaths.length === 0 ? (
                  <span className="muted">relativePaths 없음</span>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    {relativePaths.map((relativePath) => (
                      <li
                        key={`${itemType}-${relativePath}`}
                        style={{
                          wordBreak: 'break-word',
                        }}
                      >
                        {relativePath}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export function BackupManagementBoard() {
  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters())
  const [query, setQuery] = useState<FilterState>(() => createDefaultFilters())
  const [page, setPage] = useState(1)
  const [historyPage, setHistoryPage] = useState<BackupHistoryPage | null>(null)
  const [latestBackup, setLatestBackup] = useState<BackupHistoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reasonDraft, setReasonDraft] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [dialogFieldErrors, setDialogFieldErrors] = useState<DialogFieldErrors>({})
  const [processing, setProcessing] = useState(false)

  const restoreFileInputRef = useRef<HTMLInputElement | null>(null)
  const [restoreUploadFile, setRestoreUploadFile] = useState<File | null>(null)
  const [restoreNotice, setRestoreNotice] = useState<Notice>(null)
  const [restoreFilters, setRestoreFilters] = useState<RestoreFilterState>(() => createDefaultRestoreFilters())
  const [restoreQuery, setRestoreQuery] = useState<RestoreFilterState>(() => createDefaultRestoreFilters())
  const [restorePage, setRestorePage] = useState(1)
  const [restoreHistoryPage, setRestoreHistoryPage] = useState<RestoreHistoryPage | null>(null)
  const [restoreListLoading, setRestoreListLoading] = useState(true)
  const [restoreFilterError, setRestoreFilterError] = useState<string | null>(null)
  const [restoreListError, setRestoreListError] = useState<string | null>(null)
  const [restoreUploading, setRestoreUploading] = useState(false)
  const [selectedRestoreId, setSelectedRestoreId] = useState<number | null>(null)
  const [restoreDetail, setRestoreDetail] = useState<RestoreDetail | null>(null)
  const [restoreDetailLoading, setRestoreDetailLoading] = useState(false)
  const [restoreDetailError, setRestoreDetailError] = useState<DetailError>(null)
  const restorePreparationRequestRef = useRef(0)
  const [restorePreparation, setRestorePreparation] = useState<RestorePreparation | null>(null)
  const [restorePreparationLoading, setRestorePreparationLoading] = useState(false)
  const [restorePreparationError, setRestorePreparationError] = useState<string | null>(null)
  const [restorePreparationNotice, setRestorePreparationNotice] = useState<Notice>(null)
  const [selectedRestoreGroups, setSelectedRestoreGroups] = useState<RestoreExecutableItemType[]>([])
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('')
  const [restoreExecuting, setRestoreExecuting] = useState(false)

  const loadBackups = useCallback(async () => {
    setLoading(true)

    try {
      const [pageResponse, latestResponse] = await Promise.all([
        fetchBackupHistoryPage({
          ...buildQuery(query),
          page,
          size: PAGE_SIZE,
        }),
        fetchLatestBackupHistory(),
      ])

      setHistoryPage(pageResponse)
      setLatestBackup(latestResponse)
      setListError(null)
    } catch (error) {
      setListError(getListErrorMessage(getApiResponse(error)))
    } finally {
      setLoading(false)
    }
  }, [page, query])

  const loadRestoreHistories = useCallback(async () => {
    setRestoreListLoading(true)

    try {
      const response = await fetchRestoreHistoryPage({
        ...buildRestoreHistoryQuery(restoreQuery),
        page: restorePage,
        size: RESTORE_PAGE_SIZE,
      })

      setRestoreHistoryPage(response)
      setRestoreListError(null)
    } catch (error) {
      setRestoreHistoryPage(null)
      setRestoreListError(getRestoreListErrorMessage(getApiResponse(error)))
    } finally {
      setRestoreListLoading(false)
    }
  }, [restorePage, restoreQuery])

  const loadRestorePreparationState = useCallback(
    async (restoreId: number, selectedItemTypes: RestoreExecutableItemType[], confirmationText: string) => {
      const requestId = restorePreparationRequestRef.current + 1
      restorePreparationRequestRef.current = requestId
      setRestorePreparationLoading(true)
      setRestorePreparationError(null)

      try {
        const response = await fetchRestorePreparation(restoreId, {
          selectedItemTypes,
          confirmationText,
        })

        if (restorePreparationRequestRef.current !== requestId) {
          return
        }

        setRestorePreparation(response)
        setSelectedRestoreGroups(response.selectedItemTypes.filter(isRestoreExecutableItemType))
        setRestorePreparationError(null)
      } catch (error) {
        if (restorePreparationRequestRef.current !== requestId) {
          return
        }

        setRestorePreparationError(getRestorePreparationErrorMessage(getApiResponse(error)))
      } finally {
        if (restorePreparationRequestRef.current === requestId) {
          setRestorePreparationLoading(false)
        }
      }
    },
    [],
  )

  const loadRestoreDetailById = useCallback(async (restoreId: number) => {
    setRestoreDetailLoading(true)
    setRestoreDetail(null)
    setRestoreDetailError(null)
    setRestorePreparation(null)
    setRestorePreparationError(null)
    setRestorePreparationLoading(false)

    try {
      const response = await fetchRestoreDetail(restoreId)
      const nextSelectedGroups = response.selectedItemTypes.filter(isRestoreExecutableItemType)

      setRestoreDetail(response)
      setRestoreDetailError(null)
      setSelectedRestoreGroups(nextSelectedGroups)
      setRestoreConfirmationText('')
      await loadRestorePreparationState(restoreId, nextSelectedGroups, '')
    } catch (error) {
      setRestoreDetail(null)
      setRestoreDetailError(getRestoreDetailError(getApiResponse(error)))
      setRestorePreparation(null)
    } finally {
      setRestoreDetailLoading(false)
    }
  }, [loadRestorePreparationState])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  useEffect(() => {
    void loadRestoreHistories()
  }, [loadRestoreHistories])

  useEffect(() => {
    if (selectedRestoreId == null) {
      restorePreparationRequestRef.current += 1
      setRestoreDetail(null)
      setRestoreDetailError(null)
      setRestoreDetailLoading(false)
      setRestorePreparation(null)
      setRestorePreparationLoading(false)
      setRestorePreparationError(null)
      return
    }

    void loadRestoreDetailById(selectedRestoreId)
  }, [loadRestoreDetailById, selectedRestoreId])

  useEffect(() => {
    restorePreparationRequestRef.current += 1
    setRestorePreparationNotice(null)
    setRestorePreparation(null)
    setRestorePreparationError(null)
    setRestorePreparationLoading(false)
    setSelectedRestoreGroups([])
    setRestoreConfirmationText('')
  }, [selectedRestoreId])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (hasInvalidDateRange(filters)) {
      setFilterError(INVALID_DATE_RANGE_MESSAGE)
      return
    }

    setFilterError(null)
    setListError(null)
    setQuery({
      backupType: filters.backupType,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    })
    setPage(1)
  }

  function handleReset() {
    const nextFilters = createDefaultFilters()

    setFilters(nextFilters)
    setQuery(nextFilters)
    setFilterError(null)
    setListError(null)
    setPage(1)
  }

  function handleRestoreSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (hasInvalidDateRange(restoreFilters)) {
      setRestoreFilterError(INVALID_DATE_RANGE_MESSAGE)
      return
    }

    setRestoreFilterError(null)
    setRestoreListError(null)
    setRestoreQuery({
      status: restoreFilters.status,
      dateFrom: restoreFilters.dateFrom,
      dateTo: restoreFilters.dateTo,
    })
    setRestorePage(1)
  }

  function handleRestoreReset() {
    const nextFilters = createDefaultRestoreFilters()

    setRestoreFilters(nextFilters)
    setRestoreQuery(nextFilters)
    setRestoreFilterError(null)
    setRestoreListError(null)
    setRestorePage(1)
  }

  function openDialog() {
    if (processing) {
      return
    }

    setNotice(null)
    setDialogError(null)
    setDialogFieldErrors({})
    setReasonDraft('')
    setDialogOpen(true)
  }

  function closeDialog() {
    if (processing) {
      return
    }

    setDialogOpen(false)
    setDialogError(null)
    setDialogFieldErrors({})
    setReasonDraft('')
  }

  async function reloadAfterRun() {
    if (page === 1) {
      await loadBackups()
      return
    }

    setPage(1)
  }

  async function handleConfirmRun() {
    if (processing) {
      return
    }

    setProcessing(true)
    setNotice(null)
    setDialogError(null)
    setDialogFieldErrors({})

    try {
      const result = await runManualBackup(reasonDraft)

      setDialogOpen(false)
      setReasonDraft('')
      setNotice({
        type: 'success',
        text: `수동 백업을 실행했습니다. ${result.backupMethod} 방식으로 ${result.fileName} 이 생성되었습니다.`,
      })
      await reloadAfterRun()
    } catch (error) {
      const response = getApiResponse(error)

      setDialogError(getRunErrorMessage(response))
      setDialogFieldErrors(mapDialogFieldErrors(response))
    } finally {
      setProcessing(false)
    }
  }

  function handleRestoreFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setRestoreUploadFile(event.target.files?.[0] ?? null)
    setRestoreNotice(null)
  }

  function selectRestoreHistory(restoreId: number) {
    if (selectedRestoreId === restoreId) {
      return
    }

    setSelectedRestoreId(restoreId)
    setRestoreDetail(null)
    setRestoreDetailError(null)
    setRestoreDetailLoading(true)
  }

  async function handleRestoreUpload() {
    if (restoreUploading) {
      return
    }

    if (!restoreUploadFile) {
      setRestoreNotice({
        type: 'error',
        text: '업로드할 ZIP 파일을 선택해주세요.',
      })
      return
    }

    setRestoreUploading(true)
    setRestoreNotice(null)

    try {
      const result = await uploadRestoreZip(restoreUploadFile)

      setRestoreNotice({
        type: 'success',
        text: buildRestoreUploadSuccessNotice(result),
      })
      selectRestoreHistory(result.restoreId)
      setRestoreUploadFile(null)

      if (restoreFileInputRef.current) {
        restoreFileInputRef.current.value = ''
      }

      if (restorePage === 1) {
        await loadRestoreHistories()
      } else {
        setRestorePage(1)
      }
    } catch (error) {
      setRestoreNotice({
        type: 'error',
        text: getRestoreUploadErrorMessage(getApiResponse(error)),
      })
    } finally {
      setRestoreUploading(false)
    }
  }

  async function reloadRestoreExecutionState(restoreId: number) {
    await Promise.allSettled([loadRestoreHistories(), loadRestoreDetailById(restoreId)])
  }

  function handleRestoreGroupToggle(itemType: RestoreExecutableItemType) {
    setRestorePreparationNotice(null)
    setRestorePreparationError(null)
    const nextSelectedGroups = selectedRestoreGroups.includes(itemType)
      ? selectedRestoreGroups.filter((value) => value !== itemType)
      : [...selectedRestoreGroups, itemType]

    setSelectedRestoreGroups(nextSelectedGroups)

    if (selectedRestoreId != null) {
      void loadRestorePreparationState(selectedRestoreId, nextSelectedGroups, restoreConfirmationText)
    }
  }

  function handleRestoreConfirmationChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setRestorePreparationNotice(null)
    setRestorePreparationError(null)
    const nextConfirmationText = event.target.value

    setRestoreConfirmationText(nextConfirmationText)

    if (selectedRestoreId != null) {
      void loadRestorePreparationState(selectedRestoreId, selectedRestoreGroups, nextConfirmationText)
    }
  }

  async function handleRestorePreparationClick() {
    if (!restorePreparationReady || selectedRestoreId == null || restoreExecuting) {
      return
    }

    setRestoreExecuting(true)
    setRestorePreparationNotice(null)

    try {
      const result = await executeRestore(selectedRestoreId, {
        selectedItemTypes: activeSelectedRestoreGroups,
        confirmationText: restoreConfirmationText,
      })

      setRestorePreparationNotice({
        type: result.status === 'SUCCESS' ? 'success' : 'error',
        text: result.message,
      })
      await reloadRestoreExecutionState(selectedRestoreId)
    } catch (error) {
      setRestorePreparationNotice({
        type: 'error',
        text: getRestoreExecuteErrorMessage(getApiResponse(error)),
      })
      await reloadRestoreExecutionState(selectedRestoreId)
    } finally {
      setRestoreExecuting(false)
    }
  }

  const items = historyPage?.items ?? []
  const currentPage = historyPage?.page ?? page
  const totalPages = historyPage && historyPage.totalPages > 0 ? historyPage.totalPages : 1
  const latestBackupTimestamp = getLatestBackupTimestamp(latestBackup)
  const latestBackupPath = getLatestBackupPath(latestBackup)

  const restoreItems = restoreHistoryPage?.items ?? []
  const restoreCurrentPage = restoreHistoryPage?.page ?? restorePage
  const restoreTotalPages = restoreHistoryPage && restoreHistoryPage.totalPages > 0 ? restoreHistoryPage.totalPages : 1
  const restoreEmptyStateMessage = hasRestoreHistoryFilters(restoreQuery)
    ? RESTORE_FILTERED_EMPTY_STATE_MESSAGE
    : RESTORE_EMPTY_STATE_MESSAGE
  const restorePreparationGroups = restorePreparation?.itemGroups ?? []
  const activeSelectedRestoreGroups = restorePreparation?.selectedItemTypes.filter(isRestoreExecutableItemType) ?? []
  const restoreConfirmationStatus = restorePreparation?.confirmationTextStatus ?? 'NOT_APPLICABLE'
  const isValidatedRestoreDetail = restoreDetail?.status === 'VALIDATED'
  const restorePreparationBlockedMessage =
    selectedRestoreId == null
      ? '복원 검증 이력을 선택하면 복원 실행 준비를 시작할 수 있습니다.'
      : restoreDetailLoading
        ? '복원 검증 상세를 불러온 뒤 복원 실행 준비를 진행할 수 있습니다.'
        : restorePreparationLoading
          ? RESTORE_PREPARATION_LOADING_MESSAGE
        : restoreDetailError
          ? '복원 검증 상세를 확인할 수 없어 복원 실행 준비를 진행할 수 없습니다.'
          : restorePreparationError
            ? restorePreparationError
          : !restoreDetail
            ? '복원 검증 상세를 불러오지 못했습니다.'
            : restorePreparation?.blockedReason ?? (!isValidatedRestoreDetail ? RESTORE_PREPARATION_SELECTION_GUIDE : null)
  const restorePreparationInteractionDisabled =
    selectedRestoreId == null ||
    restoreDetailLoading ||
    !!restoreDetailError ||
    !!restorePreparationError ||
    !restoreDetail ||
    !isValidatedRestoreDetail
  const restorePreparationInputDisabled =
    restorePreparationInteractionDisabled || restoreConfirmationStatus === 'NOT_APPLICABLE'
  const restoreDisplayOnlyDetectedItems =
    restoreDetail?.detectedItems.filter((item) => !isRestoreExecutableItemType(item.itemType)) ?? []
  const restoreConfirmationMatches = restorePreparation?.confirmationTextMatched ?? false
  const restorePreparationReady = restorePreparation?.readyToExecute ?? false
  const selectedRestoreGroupCount = restorePreparation?.selectedGroupCount ?? 0
  const selectedRestoreGroupSummary = getRestoreSelectedGroupSummary(
    restorePreparationGroups,
    activeSelectedRestoreGroups,
    restorePreparation != null,
  )
  const restoreConfirmationRequiredText = restorePreparation?.confirmationRequiredText ?? RESTORE_PREPARATION_CONFIRMATION_TEXT
  const restoreConfirmationInputPlaceholder =
    restoreConfirmationStatus === 'NOT_APPLICABLE'
      ? '현재는 확인 문구 입력 대상이 아닙니다.'
      : restoreConfirmationRequiredText
  const restoreConfirmationStatusMessage = getRestoreConfirmationStatusMessage(
    restoreConfirmationStatus,
    restoreConfirmationRequiredText,
  )
  const restoreExecutionBlockingSummary =
    restorePreparationBlockedMessage ?? '서버 기준 복원 실행 차단 사유가 없습니다.'

  return (
    <div className="stack">
      <PageHeader description="최근 백업 상태를 확인하고 필요 시 수동 백업 또는 복원 검증을 진행합니다." title="백업 관리" />

      {notice ? (
        notice.type === 'success' ? (
          <div className="success-panel" role="status">
            {notice.text}
          </div>
        ) : (
          <div className="error-text" role="alert">
            {notice.text}
          </div>
        )
      ) : null}

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>최근 백업 상태</strong>
          <span className="muted">가장 최근 이력을 기준으로 백업 상태와 저장 경로를 확인합니다.</span>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <span>가장 최근 백업 시각</span>
            <strong>{latestBackupTimestamp}</strong>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span>최근 백업 상태</span>
            {latestBackup ? (
              <span className="status-chip" style={getBackupStatusChipStyle(latestBackup.status)}>
                {latestBackup.status}
              </span>
            ) : (
              <span className="muted">이력 없음</span>
            )}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span>저장 경로 안내</span>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              title={latestBackupPath}
            >
              {latestBackupPath}
            </div>
          </div>
        </div>
      </div>

      <div className="card stack" style={{ borderColor: '#d7c09b' }}>
        <div className="stack" style={{ gap: 8 }}>
          <strong>수동 백업 실행</strong>
          <p className="muted" style={{ margin: 0 }}>
            배포 전, 설정 변경 전, 척도 JSON 교체 전에는 수동 백업을 먼저 실행하는 것을 권장합니다.
          </p>
        </div>
        <div className="actions">
          <button className="danger-button" disabled={processing} onClick={openDialog} type="button">
            수동 백업 실행
          </button>
        </div>
      </div>

      <form aria-label="백업 이력 필터" className="card stack" noValidate onSubmit={handleSearch}>
        <div className="management-filter-grid">
          <label className="field">
            <span>백업 유형</span>
            <select
              aria-label="백업 유형"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  backupType: event.target.value as FilterState['backupType'],
                }))
              }
              value={filters.backupType}
            >
              <option value="">전체 유형</option>
              {BACKUP_TYPE_OPTIONS.map((backupType) => (
                <option key={backupType} value={backupType}>
                  {formatBackupTypeFilterOptionLabel(backupType)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>상태</span>
            <select
              aria-label="상태"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as FilterState['status'],
                }))
              }
              value={filters.status}
            >
              <option value="">전체 상태</option>
              {BACKUP_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatBackupStatusFilterOptionLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>시작일</span>
            <DateTextInput
              aria-label="시작일"
              onChange={(dateFrom) => setFilters((prev) => ({ ...prev, dateFrom }))}
              value={filters.dateFrom}
            />
          </label>
          <label className="field">
            <span>종료일</span>
            <DateTextInput
              aria-label="종료일"
              onChange={(dateTo) => setFilters((prev) => ({ ...prev, dateTo }))}
              value={filters.dateTo}
            />
          </label>
          <div className="actions" style={{ alignSelf: 'end' }}>
            <button className="primary-button" disabled={loading} type="submit">
              조회
            </button>
            <button className="secondary-button" disabled={loading} onClick={handleReset} type="button">
              초기화
            </button>
          </div>
        </div>

        {filterError ? (
          <div className="error-text" role="alert">
            {filterError}
          </div>
        ) : null}
      </form>

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>총 {historyPage?.totalItems ?? 0}건</strong>
          <span className="muted">백업 파일 다운로드나 삭제는 이번 화면 범위에 포함하지 않습니다.</span>
          <button className="secondary-button" disabled={loading} onClick={() => void loadBackups()} type="button">
            재조회
          </button>
        </div>

        {listError ? (
          <div className="stack" role="alert" style={{ gap: 8 }}>
            <div className="error-text">{listError}</div>
            <div className="actions">
              <button className="secondary-button" disabled={loading} onClick={() => void loadBackups()} type="button">
                다시 시도
              </button>
            </div>
          </div>
        ) : null}

        <table className="table">
          <thead>
            <tr>
              <th>백업 ID</th>
              <th>백업 유형</th>
              <th>상태</th>
              <th>파일명</th>
              <th>파일경로</th>
              <th>파일크기</th>
              <th>시작 시각</th>
              <th>완료 시각</th>
              <th>실행자</th>
              <th>실패 사유</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="muted" colSpan={10}>
                  백업 이력을 불러오는 중입니다.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="muted" colSpan={10}>
                  {EMPTY_STATE_MESSAGE}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.backupType}</td>
                  <td>
                    <span className="status-chip" style={getBackupStatusChipStyle(item.status)}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.fileName}</td>
                  <td>
                    <div
                      style={{
                        maxWidth: 260,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      title={item.filePath !== '-' ? item.filePath : undefined}
                    >
                      {item.filePath}
                    </div>
                  </td>
                  <td>{item.fileSizeLabel}</td>
                  <td>{item.startedAt}</td>
                  <td>{item.completedAt}</td>
                  <td>{item.executedByName}</td>
                  <td>
                    <div
                      style={{
                        maxWidth: 240,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      title={item.failureReason !== '-' ? item.failureReason : undefined}
                    >
                      {item.failureReason}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button className="secondary-button" disabled={loading || currentPage <= 1} onClick={() => setPage((value) => value - 1)} type="button">
            이전
          </button>
          <span className="muted">
            {currentPage} / {totalPages} 페이지
          </span>
          <button
            className="secondary-button"
            disabled={loading || !historyPage || historyPage.totalPages <= 1 || currentPage >= historyPage.totalPages}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            다음
          </button>
        </div>
      </div>

      <div className="card stack" style={{ borderColor: '#d7c09b' }}>
        <div className="stack" style={{ gap: 8 }}>
          <strong>복원 ZIP 업로드</strong>
          <p className="muted" style={{ margin: 0 }}>
            기존 관리자 화면 안에서 복원 검증 결과를 확인하고, VALIDATED 된 이력에 대해 DATABASE 복원 실행까지 이어서 진행합니다.
          </p>
        </div>

        {restoreNotice ? (
          restoreNotice.type === 'success' ? (
            <div className="success-panel" role="status">
              {restoreNotice.text}
            </div>
          ) : (
            <div className="error-text" role="alert">
              {restoreNotice.text}
            </div>
          )
        ) : null}

        <div className="field" style={{ margin: 0 }}>
          <span>복원 ZIP 파일</span>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
            }}
          >
            <input accept=".zip" disabled={restoreUploading} onChange={handleRestoreFileChange} ref={restoreFileInputRef} type="file" />
            <button className="primary-button" disabled={restoreUploading || !restoreUploadFile} onClick={() => void handleRestoreUpload()} type="button">
              {restoreUploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
          <span className="field-hint">파일 선택만 프론트에서 처리하며, ZIP 구조와 manifest 검증은 서버가 수행합니다.</span>
          {restoreUploadFile ? <span className="muted">선택한 파일: {restoreUploadFile.name}</span> : null}
        </div>
      </div>

      <form aria-label="복원 검증 이력 필터" className="card stack" noValidate onSubmit={handleRestoreSearch}>
        <div className="management-filter-grid">
          <label className="field">
            <span>상태</span>
            <select
              aria-label="상태"
              onChange={(event) =>
                setRestoreFilters((prev) => ({
                  ...prev,
                  status: event.target.value as RestoreFilterState['status'],
                }))
              }
              value={restoreFilters.status}
            >
              <option value="">전체 상태</option>
              {RESTORE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatRestoreStatusFilterOptionLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>시작일</span>
            <DateTextInput
              aria-label="시작일"
              onChange={(dateFrom) => setRestoreFilters((prev) => ({ ...prev, dateFrom }))}
              value={restoreFilters.dateFrom}
            />
          </label>
          <label className="field">
            <span>종료일</span>
            <DateTextInput
              aria-label="종료일"
              onChange={(dateTo) => setRestoreFilters((prev) => ({ ...prev, dateTo }))}
              value={restoreFilters.dateTo}
            />
          </label>
          <div className="actions" style={{ alignSelf: 'end' }}>
            <button className="primary-button" disabled={restoreListLoading} type="submit">
              조회
            </button>
            <button className="secondary-button" disabled={restoreListLoading} onClick={handleRestoreReset} type="button">
              초기화
            </button>
          </div>
        </div>

        {restoreFilterError ? (
          <div className="error-text" role="alert">
            {restoreFilterError}
          </div>
        ) : null}
      </form>

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>복원 검증 이력 {restoreHistoryPage?.totalItems ?? 0}건</strong>
          <span className="muted">상태와 기간 필터는 기존 복원 검증 이력 목록 API를 그대로 사용합니다.</span>
          <button className="secondary-button" disabled={restoreListLoading} onClick={() => void loadRestoreHistories()} type="button">
            재조회
          </button>
        </div>

        {restoreListError ? (
          <div className="stack" role="alert" style={{ gap: 8 }}>
            <div className="error-text">{restoreListError}</div>
            <div className="actions">
              <button className="secondary-button" disabled={restoreListLoading} onClick={() => void loadRestoreHistories()} type="button">
                다시 시도
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>restoreId</th>
                <th>상태</th>
                <th>실행 가능 여부</th>
                <th>파일명</th>
                <th>파일크기</th>
                <th>업로드 시각</th>
                <th>검증 시각</th>
                <th>업로드 사용자명</th>
                <th>datasourceType</th>
                <th>backupId</th>
                <th>실패 사유</th>
              </tr>
            </thead>
            <tbody>
              {restoreListLoading ? (
                <tr>
                  <td className="muted" colSpan={11}>
                    복원 검증 이력을 불러오는 중입니다.
                  </td>
                </tr>
              ) : restoreItems.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={11}>
                    {restoreEmptyStateMessage}
                  </td>
                </tr>
              ) : (
                restoreItems.map((item) => {
                  const selected = selectedRestoreId === item.id

                  return (
                    <tr
                      aria-selected={selected}
                      className="clickable-row"
                      key={item.id}
                      onClick={() => selectRestoreHistory(item.id)}
                      style={selected ? { background: '#eef8f3' } : undefined}
                    >
                      <td>{item.id}</td>
                      <td>
                        <span className="status-chip" style={getRestoreStatusChipStyle(item.status)}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ minWidth: 150 }}>
                          <span className="status-chip" style={getRestoreExecutionCapabilityChipStyle(item.executionCapability)}>
                            {getRestoreExecutionCapabilityLabel(item.executionCapability)}
                          </span>
                          {item.executionCapability === 'BLOCKED' && item.executionBlockedReason ? (
                            <div
                              className="muted"
                              style={{
                                marginTop: 6,
                                maxWidth: 220,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={item.executionBlockedReason}
                            >
                              {normalizeInlineText(item.executionBlockedReason)}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            maxWidth: 260,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                          title={item.fileName !== '-' ? item.fileName : undefined}
                        >
                          {item.fileName}
                        </div>
                      </td>
                      <td>{item.fileSizeLabel}</td>
                      <td>{item.uploadedAt}</td>
                      <td>{item.validatedAt}</td>
                      <td>{item.uploadedByName}</td>
                      <td>{item.datasourceType}</td>
                      <td>{formatOptionalNumber(item.backupId)}</td>
                      <td>
                        <div
                          style={{
                            maxWidth: 240,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                          title={item.failureReason !== '-' ? item.failureReason : undefined}
                        >
                          {item.failureReason}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button
            className="secondary-button"
            disabled={restoreListLoading || restoreCurrentPage <= 1}
            onClick={() => setRestorePage((value) => value - 1)}
            type="button"
          >
            이전
          </button>
          <span className="muted">
            {restoreCurrentPage} / {restoreTotalPages} 페이지
          </span>
          <button
            className="secondary-button"
            disabled={
              restoreListLoading ||
              !restoreHistoryPage ||
              restoreHistoryPage.totalPages <= 1 ||
              restoreCurrentPage >= restoreHistoryPage.totalPages
            }
            onClick={() => setRestorePage((value) => value + 1)}
            type="button"
          >
            다음
          </button>
        </div>
      </div>

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>선택한 복원 검증 상세</strong>
          <span className="muted">{selectedRestoreId == null ? '이력을 선택하면 상세가 열립니다.' : `선택된 restoreId: ${selectedRestoreId}`}</span>
        </div>

        {selectedRestoreId == null ? (
          <p className="muted" style={{ margin: 0 }}>
            {RESTORE_DETAIL_EMPTY_MESSAGE}
          </p>
        ) : restoreDetailLoading ? (
          <p className="muted" style={{ margin: 0 }}>
            복원 검증 상세를 불러오는 중입니다.
          </p>
        ) : restoreDetailError ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="error-text" role="alert">
              {restoreDetailError.text}
            </div>
            {restoreDetailError.errorCode ? <span className="muted">오류 코드: {restoreDetailError.errorCode}</span> : null}
          </div>
        ) : restoreDetail ? (
          <>
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <div className="field" style={{ margin: 0 }}>
                <span>restoreId</span>
                <strong>{restoreDetail.id}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>상태</span>
                <span className="status-chip" style={getRestoreStatusChipStyle(restoreDetail.status)}>
                  {restoreDetail.status}
                </span>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>실행 가능 여부</span>
                <span className="status-chip" style={getRestoreExecutionCapabilityChipStyle(restoreDetail.executionCapability)}>
                  {getRestoreExecutionCapabilityLabel(restoreDetail.executionCapability)}
                </span>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>파일명</span>
                <strong
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {restoreDetail.fileName}
                </strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>업로드 시각</span>
                <strong>{restoreDetail.uploadedAt}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>검증 시각</span>
                <strong>{restoreDetail.validatedAt}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>실행 시각</span>
                <strong>{restoreDetail.executedAt}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>업로드 사용자명</span>
                <strong>{restoreDetail.uploadedByName}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>formatVersion</span>
                <strong>{restoreDetail.formatVersion}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>datasourceType</span>
                <strong>{restoreDetail.datasourceType}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>backupId</span>
                <strong>{formatOptionalNumber(restoreDetail.backupId)}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>실행 불가 사유</span>
                <strong
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {restoreDetail.executionBlockedReason ?? '-'}
                </strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>선택된 실행 항목</span>
                <strong>{restoreDetail.selectedItemTypes.length > 0 ? restoreDetail.selectedItemTypes.join(', ') : '-'}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>preBackupId</span>
                <strong>{formatOptionalNumber(restoreDetail.preBackupId)}</strong>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span>preBackupFileName</span>
                <strong
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {restoreDetail.preBackupFileName}
                </strong>
              </div>
            </div>

            {restoreDetail.status === 'FAILED' || restoreDetail.status === 'PRE_BACKUP_FAILED' ? (
              <>
                <div
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #f0c7c7',
                    borderRadius: 14,
                    background: '#fff5f5',
                  }}
                >
                  <div className="stack" style={{ gap: 8 }}>
                    <strong style={{ color: '#9d2f2f' }}>실패 사유</strong>
                    <div
                      style={{
                        color: '#9d2f2f',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {restoreDetail.failureReason}
                    </div>
                  </div>
                </div>
                <RestoreDetectedItemsCards detectedItems={restoreDetail.detectedItems} emptyHint={RESTORE_FAILED_DETECTED_ITEMS_GUIDE} />
              </>
            ) : restoreDetail.status === 'UPLOADED' ? (
              <>
                <div
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #cfe1ee',
                    borderRadius: 14,
                    background: '#f5f9fc',
                  }}
                >
                  <span className="muted">{RESTORE_UPLOADED_GUIDE}</span>
                </div>
                <RestoreDetectedItemsCards detectedItems={restoreDetail.detectedItems} emptyHint={RESTORE_FAILED_DETECTED_ITEMS_GUIDE} />
              </>
            ) : (
              <RestoreDetectedItemsCards detectedItems={restoreDetail.detectedItems} emptyHint={RESTORE_VALIDATED_DETECTED_ITEMS_GUIDE} />
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            복원 검증 상세를 불러오지 못했습니다.
          </p>
        )}
      </div>

      <div className="card stack" style={{ borderColor: '#d7c09b' }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>복원 실행 준비</strong>
          <span className="muted">서버가 자동 백업과 DATABASE 복원 실행을 담당하고, 프론트는 선택값과 결과만 표시합니다.</span>
        </div>

        {restorePreparationNotice ? (
          restorePreparationNotice.type === 'success' ? (
            <div className="success-panel" role="status">
              {restorePreparationNotice.text}
            </div>
          ) : (
            <div className="error-text" role="alert">
              {restorePreparationNotice.text}
            </div>
          )
        ) : null}

        <section
          className="stack"
          style={{
            gap: 12,
            padding: 16,
            border: '1px solid #d8e1ea',
            borderRadius: 14,
            background: '#fbfdff',
          }}
        >
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <strong>1. 복원 대상 항목 체크박스</strong>
            <span className="muted">{RESTORE_EXECUTION_SCOPE_GUIDE}</span>
          </div>

          {restoreDisplayOnlyDetectedItems.length > 0 ? (
            <div
              style={{
                padding: '12px 14px',
                border: '1px solid #dde6ee',
                borderRadius: 12,
                background: '#f8fbfd',
              }}
            >
              <div className="stack" style={{ gap: 10 }}>
                <div className="toolbar" style={{ marginBottom: 0 }}>
                  <strong>표시 전용 detectedItems</strong>
                  <span className="muted">{RESTORE_PREPARATION_DISPLAY_ONLY_GUIDE}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {restoreDisplayOnlyDetectedItems.map((item) => (
                    <span
                      key={`display-only-${item.itemType}`}
                      className="muted"
                      style={{
                        color: '#4d6478',
                        background: '#edf4fa',
                        padding: '6px 10px',
                        borderRadius: 999,
                      }}
                    >
                      {`${item.itemType} ${item.relativePaths.length}개`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {restorePreparationBlockedMessage ? (
            <div
              style={{
                padding: '12px 14px',
                border: '1px solid #d8e1ea',
                borderRadius: 12,
                background: '#f5f9fc',
              }}
            >
              <span
                className="muted"
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {restorePreparationBlockedMessage}
              </span>
            </div>
          ) : null}

          {selectedRestoreId != null && !restoreDetailLoading && !restoreDetailError && restoreDetail && restorePreparationGroups.length > 0 ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                }}
              >
                {restorePreparationGroups.map((group) => {
                  const checked = group.selected
                  const disabled = restorePreparationInteractionDisabled || !group.selectable

                  return (
                    <label
                      key={group.itemType}
                      style={{
                        display: 'grid',
                        gap: 10,
                        padding: 16,
                        border: '1px solid #d8e1ea',
                        borderRadius: 14,
                        background: disabled ? '#f7f9fb' : '#ffffff',
                        color: disabled ? '#7c8ea1' : '#163750',
                      }}
                    >
                      <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          {group.selectable ? (
                            <input
                              checked={checked}
                              disabled={disabled}
                              onChange={() => handleRestoreGroupToggle(group.itemType as RestoreExecutableItemType)}
                              type="checkbox"
                            />
                          ) : (
                            <span
                              className="muted"
                              style={{
                                color: '#805200',
                                background: '#fff1cf',
                                padding: '4px 8px',
                                borderRadius: 999,
                              }}
                            >
                              실행 대상 유형
                            </span>
                          )}
                          <strong>{group.itemType}</strong>
                        </span>
                        <span
                          className="muted"
                          style={
                            group.selectable
                              ? undefined
                              : {
                                  color: '#805200',
                                  background: '#fff1cf',
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                }
                          }
                        >
                          {getRestoreGroupAvailabilityLabel(group)}
                        </span>
                      </div>

                      {group.relativePaths.length === 0 ? (
                        <span className="muted">relativePaths 없음</span>
                      ) : (
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            display: 'grid',
                            gap: 6,
                          }}
                        >
                          {group.relativePaths.map((relativePath) => (
                            <li
                              key={`${group.itemType}-${relativePath}`}
                              style={{
                                wordBreak: 'break-word',
                              }}
                            >
                              {relativePath}
                            </li>
                          ))}
                        </ul>
                      )}
                      {group.blockedReason ? (
                        <span
                          className="muted"
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {group.blockedReason}
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  border: '1px solid #dde6ee',
                  borderRadius: 12,
                  background: '#f8fbfd',
                }}
              >
                <div className="stack" style={{ gap: 6 }}>
                  <strong>현재 선택 {selectedRestoreGroupCount}개</strong>
                  <span className="muted">{selectedRestoreGroupSummary}</span>
                </div>
              </div>
            </>
          ) : selectedRestoreId != null && !restoreDetailLoading && !restoreDetailError && restoreDetail ? (
            <div
              style={{
                padding: '12px 14px',
                border: '1px solid #d8e1ea',
                borderRadius: 12,
                background: '#f5f9fc',
              }}
            >
              <span className="muted">서버가 선택 가능한 복원 그룹을 계산하면 여기에 표시됩니다.</span>
            </div>
          ) : null}
        </section>

        <section
          className="stack"
          style={{
            gap: 12,
            padding: 16,
            border: '1px solid #d8e1ea',
            borderRadius: 14,
            background: '#fbfdff',
          }}
        >
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <strong>2. 확인 문구 입력</strong>
            <span className="muted">정확히 일치할 때만 실행 준비 완료로 판단합니다.</span>
          </div>

          <label className="field" style={{ margin: 0 }}>
            <span>확인 문구</span>
            <textarea
              aria-label="복원 실행 확인 문구"
              disabled={restorePreparationInputDisabled}
              onChange={handleRestoreConfirmationChange}
              placeholder={restoreConfirmationInputPlaceholder}
              rows={3}
              value={restoreConfirmationText}
            />
            <span className="field-hint">{`확인 문구는 ${restoreConfirmationRequiredText} 와 정확히 일치해야 합니다.`}</span>
            {restoreConfirmationStatus === 'NOT_APPLICABLE' ? (
              <span className="muted">{RESTORE_CONFIRMATION_SKIPPED_GUIDE}</span>
            ) : restorePreparationInteractionDisabled ? (
              <span className="muted">입력 가능 상태가 되면 확인 문구를 정확히 입력해주세요.</span>
            ) : restorePreparationLoading ? (
              <span className="muted">최근 입력값을 서버 기준으로 다시 확인하는 중입니다.</span>
            ) : restoreConfirmationStatus === 'WAITING_INPUT' ? (
              <span className="muted">확인 문구를 정확히 입력해야 실행 준비 상태가 활성화됩니다.</span>
            ) : restoreConfirmationMatches ? (
              <span className="success-text">확인 문구가 정확히 일치합니다.</span>
            ) : (
              <span className="field-error">{RESTORE_PREPARATION_CONFIRMATION_ERROR}</span>
            )}
          </label>
        </section>

        <section
          className="stack"
          style={{
            gap: 12,
            padding: 16,
            border: '1px solid #d8e1ea',
            borderRadius: 14,
            background: '#fbfdff',
          }}
        >
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <strong>3. 실행 전 요약/검토</strong>
            <span className="muted">실행 시 서버가 pre-backup 이후 DATABASE 복원을 순차적으로 수행합니다.</span>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div className="field" style={{ margin: 0 }}>
              <span>restoreId</span>
              <strong>{selectedRestoreId ?? '-'}</strong>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>상태</span>
              {restoreDetail ? (
                <span className="status-chip" style={getRestoreStatusChipStyle(restoreDetail.status)}>
                  {restoreDetail.status}
                </span>
              ) : (
                <strong>-</strong>
              )}
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>fileName</span>
              <strong
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {restoreDetail?.fileName ?? '-'}
              </strong>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>datasourceType</span>
              <strong>{restoreDetail?.datasourceType ?? '-'}</strong>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>backupId</span>
              <strong>{formatOptionalNumber(restoreDetail?.backupId ?? null)}</strong>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>선택된 복원 항목 그룹</span>
              <strong
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {selectedRestoreGroupSummary}
              </strong>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>선택된 그룹 수</span>
              <strong>{selectedRestoreGroupCount}</strong>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>확인 문구 상태</span>
              <span className="status-chip" style={getRestoreConfirmationStatusChipStyle(restoreConfirmationStatus)}>
                {getRestoreConfirmationStatusLabel(restoreConfirmationStatus)}
              </span>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>실행 준비 상태</span>
              <span className="status-chip" style={getRestorePreparationStatusChipStyle(restorePreparationReady)}>
                {restorePreparationReady ? '실행 준비 가능' : '실행 준비 불가'}
              </span>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>마지막 실행 시각</span>
              <strong>{restoreDetail?.executedAt ?? '-'}</strong>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span>preBackupFileName</span>
              <strong
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {restoreDetail?.preBackupFileName ?? '-'}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                border: '1px solid #dde6ee',
                borderRadius: 12,
                background: '#f8fbfd',
              }}
            >
              <div className="stack" style={{ gap: 6 }}>
                <strong>복원 실행 차단 사유</strong>
                <span
                  className="muted"
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {restoreExecutionBlockingSummary}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                border: '1px solid #dde6ee',
                borderRadius: 12,
                background: '#f8fbfd',
              }}
            >
              <div className="stack" style={{ gap: 6 }}>
                <strong>확인 문구 상태 안내</strong>
                <span
                  className="muted"
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {restoreConfirmationStatusMessage}
                </span>
              </div>
            </div>
          </div>

          <div className="actions">
            <button
              className="danger-button"
              disabled={!restorePreparationReady || restoreExecuting}
              onClick={() => void handleRestorePreparationClick()}
              type="button"
            >
              {restoreExecuting ? '복원 실행 중...' : '복원 실행'}
            </button>
            <span className="muted">실행 중에는 중복 클릭을 막고, 완료 후 목록과 상세를 다시 불러옵니다.</span>
          </div>
        </section>
      </div>

      <ConfirmDialog
        confirmText="백업 실행"
        confirmVariant="danger"
        description="수동 백업은 즉시 실행되며, 진행 중에는 중복 실행할 수 없습니다. 실행 사유는 선택 입력이지만 남겨두는 것을 권장합니다."
        onCancel={closeDialog}
        onConfirm={() => void handleConfirmRun()}
        open={dialogOpen}
        processing={processing}
        title="수동 백업 실행 확인"
      >
        <div className="stack" style={{ gap: 12 }}>
          {dialogError ? (
            <div className="error-text" role="alert">
              {dialogError}
            </div>
          ) : null}

          <label className="field" style={{ margin: 0 }}>
            <span>실행 사유</span>
            <textarea
              aria-label="실행 사유"
              onChange={(event) => setReasonDraft(event.target.value)}
              placeholder="예: 배포 전 수동 백업"
              rows={4}
              value={reasonDraft}
            />
            <span className="field-hint">사유는 선택 입력입니다. 운영 이력 추적을 위해 작성하는 것을 권장합니다.</span>
            {dialogFieldErrors.reason ? <span className="field-error">{dialogFieldErrors.reason}</span> : null}
          </label>
        </div>
      </ConfirmDialog>
    </div>
  )
}
