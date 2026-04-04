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
  executeRestore,
  fetchRestoreDetail,
  fetchRestoreHistoryPage,
  uploadRestoreZip,
  type RestoreDetectedItem,
  type RestoreDetail,
  type RestoreDetectedItemType,
  type RestoreExecutableItemType,
  type RestoreHistoryPage,
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

function createDefaultFilters(): FilterState {
  return {
    backupType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  }
}

const PAGE_SIZE = 20
const RESTORE_PAGE_SIZE = 20
const EMPTY_STATE_MESSAGE = '조건에 맞는 백업 이력이 없습니다.'
const RESTORE_EMPTY_STATE_MESSAGE = '등록된 복원 검증 이력이 없습니다.'
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
const RESTORE_PREPARATION_EMPTY_GROUPS_GUIDE = 'detectedItems 에 DATABASE 항목이 없어 실제 복원을 실행할 수 없습니다.'
const RESTORE_PREPARATION_CONFIRMATION_GUIDE = `확인 문구는 ${RESTORE_PREPARATION_CONFIRMATION_TEXT} 와 정확히 일치해야 합니다.`
const RESTORE_PREPARATION_CONFIRMATION_ERROR = '확인 문구가 정확히 일치하지 않습니다.'
const RESTORE_EXECUTION_SCOPE_GUIDE = '현재 버전에서는 DATABASE 그룹만 실제 복원 가능합니다.'
const RESTORE_EXECUTION_EXCLUDED_BADGE = '현재 버전 복원 제외'
const BACKUP_TYPE_FILTER_LABELS: Readonly<Partial<Record<BackupType, string>>> = {
  AUTO: '자동 백업',
  MANUAL: '수동 백업',
}
const BACKUP_STATUS_FILTER_LABELS: Readonly<Partial<Record<BackupStatus, string>>> = {
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

function buildQuery(filters: FilterState): Omit<BackupHistoryQuery, 'page' | 'size'> {
  return {
    backupType: filters.backupType || undefined,
    status: filters.status || undefined,
    dateFrom: toValidDateText(filters.dateFrom) || undefined,
    dateTo: toValidDateText(filters.dateTo) || undefined,
  }
}

function hasInvalidDateRange(filters: FilterState) {
  const dateFrom = toValidDateText(filters.dateFrom)
  const dateTo = toValidDateText(filters.dateTo)

  if (!dateFrom || !dateTo) {
    return false
  }

  return dateFrom > dateTo
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

function getRestoreGroupRelativePaths(detectedItems: RestoreDetectedItem[], itemType: RestoreDetectedItemType) {
  return detectedItems.find((item) => item.itemType === itemType)?.relativePaths ?? []
}

function getDefaultSelectedRestoreGroups(detectedItems: RestoreDetectedItem[]) {
  return RESTORE_EXECUTABLE_ITEM_TYPES.filter((itemType) => getRestoreGroupRelativePaths(detectedItems, itemType).length > 0)
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
  const [restorePage, setRestorePage] = useState(1)
  const [restoreHistoryPage, setRestoreHistoryPage] = useState<RestoreHistoryPage | null>(null)
  const [restoreListLoading, setRestoreListLoading] = useState(true)
  const [restoreListError, setRestoreListError] = useState<string | null>(null)
  const [restoreUploading, setRestoreUploading] = useState(false)
  const [selectedRestoreId, setSelectedRestoreId] = useState<number | null>(null)
  const [restoreDetail, setRestoreDetail] = useState<RestoreDetail | null>(null)
  const [restoreDetailLoading, setRestoreDetailLoading] = useState(false)
  const [restoreDetailError, setRestoreDetailError] = useState<DetailError>(null)
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
  }, [restorePage])

  const loadRestoreDetailById = useCallback(async (restoreId: number) => {
    setRestoreDetailLoading(true)
    setRestoreDetail(null)
    setRestoreDetailError(null)

    try {
      const response = await fetchRestoreDetail(restoreId)

      setRestoreDetail(response)
      setRestoreDetailError(null)
    } catch (error) {
      setRestoreDetail(null)
      setRestoreDetailError(getRestoreDetailError(getApiResponse(error)))
    } finally {
      setRestoreDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  useEffect(() => {
    void loadRestoreHistories()
  }, [loadRestoreHistories])

  useEffect(() => {
    if (selectedRestoreId == null) {
      setRestoreDetail(null)
      setRestoreDetailError(null)
      setRestoreDetailLoading(false)
      return
    }

    void loadRestoreDetailById(selectedRestoreId)
  }, [loadRestoreDetailById, selectedRestoreId])

  useEffect(() => {
    setRestorePreparationNotice(null)
    setSelectedRestoreGroups([])
    setRestoreConfirmationText('')
  }, [selectedRestoreId])

  useEffect(() => {
    if (!restoreDetail || restoreDetail.id !== selectedRestoreId || restoreDetail.status !== 'VALIDATED') {
      setSelectedRestoreGroups([])
      return
    }

    setSelectedRestoreGroups(getDefaultSelectedRestoreGroups(restoreDetail.detectedItems))
  }, [restoreDetail, selectedRestoreId])

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
        text: `${result.fileName} 업로드가 완료되었습니다. restoreId ${result.restoreId} 상세를 확인하세요.`,
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
    setSelectedRestoreGroups((prev) =>
      prev.includes(itemType) ? prev.filter((value) => value !== itemType) : [...prev, itemType],
    )
  }

  function handleRestoreConfirmationChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setRestorePreparationNotice(null)
    setRestoreConfirmationText(event.target.value)
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
  const restoreDetectedItems = restoreDetail?.detectedItems ?? []
  const executableRestoreGroups = getDefaultSelectedRestoreGroups(restoreDetectedItems)
  const activeSelectedRestoreGroups = selectedRestoreGroups.filter((itemType) => executableRestoreGroups.includes(itemType))
  const persistedSelectedRestoreGroups = restoreDetail?.selectedItemTypes ?? []
  const isValidatedRestoreDetail = restoreDetail?.status === 'VALIDATED'
  const restorePreparationBlockedMessage =
    selectedRestoreId == null
      ? '복원 검증 이력을 선택하면 복원 실행 준비를 시작할 수 있습니다.'
      : restoreDetailLoading
        ? '복원 검증 상세를 불러온 뒤 복원 실행 준비를 진행할 수 있습니다.'
        : restoreDetailError
          ? '복원 검증 상세를 확인할 수 없어 복원 실행 준비를 진행할 수 없습니다.'
          : !restoreDetail
            ? '복원 검증 상세를 불러오지 못했습니다.'
            : !isValidatedRestoreDetail
              ? RESTORE_PREPARATION_SELECTION_GUIDE
              : executableRestoreGroups.length === 0
                ? RESTORE_PREPARATION_EMPTY_GROUPS_GUIDE
                : null
  const restorePreparationInputDisabled =
    selectedRestoreId == null ||
    restoreDetailLoading ||
    !!restoreDetailError ||
    !restoreDetail ||
    !isValidatedRestoreDetail ||
    executableRestoreGroups.length === 0
  const restoreConfirmationMatches = restoreConfirmationText === RESTORE_PREPARATION_CONFIRMATION_TEXT
  const restorePreparationReady =
    isValidatedRestoreDetail && activeSelectedRestoreGroups.length > 0 && restoreConfirmationMatches
  const selectedRestoreGroupCount =
    activeSelectedRestoreGroups.length > 0 ? activeSelectedRestoreGroups.length : persistedSelectedRestoreGroups.length
  const selectedRestoreGroupSummary =
    activeSelectedRestoreGroups.length > 0
      ? activeSelectedRestoreGroups.join(', ')
      : persistedSelectedRestoreGroups.length > 0
        ? persistedSelectedRestoreGroups.join(', ')
        : '선택된 그룹 없음'

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

      <form className="card stack" noValidate onSubmit={handleSearch}>
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

      <div className="card stack">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <strong>복원 검증 이력 {restoreHistoryPage?.totalItems ?? 0}건</strong>
          <span className="muted">기본 정렬과 필터는 서버 기본값을 그대로 사용합니다.</span>
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
                  <td className="muted" colSpan={10}>
                    복원 검증 이력을 불러오는 중입니다.
                  </td>
                </tr>
              ) : restoreItems.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={10}>
                    {RESTORE_EMPTY_STATE_MESSAGE}
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

          {restorePreparationBlockedMessage ? (
            <div
              style={{
                padding: '12px 14px',
                border: '1px solid #d8e1ea',
                borderRadius: 12,
                background: '#f5f9fc',
              }}
            >
              <span className="muted">{restorePreparationBlockedMessage}</span>
            </div>
          ) : null}

          {selectedRestoreId != null && !restoreDetailLoading && !restoreDetailError && restoreDetail ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                }}
              >
                {RESTORE_DETECTED_ITEM_TYPES.map((itemType) => {
                  const relativePaths = getRestoreGroupRelativePaths(restoreDetectedItems, itemType)
                  const executable = RESTORE_EXECUTABLE_ITEM_TYPES.includes(itemType as RestoreExecutableItemType)
                  const checked = executable && activeSelectedRestoreGroups.includes(itemType as RestoreExecutableItemType)
                  const disabled = restorePreparationInputDisabled || relativePaths.length === 0 || !executable

                  return (
                    <label
                      key={itemType}
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
                          <input
                            checked={checked}
                            disabled={disabled}
                            onChange={() => handleRestoreGroupToggle(itemType as RestoreExecutableItemType)}
                            type="checkbox"
                          />
                          <strong>{itemType}</strong>
                        </span>
                        <span
                          className="muted"
                          style={
                            executable
                              ? undefined
                              : {
                                  color: '#805200',
                                  background: '#fff1cf',
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                }
                          }
                        >
                          {executable ? `${relativePaths.length}개` : RESTORE_EXECUTION_EXCLUDED_BADGE}
                        </span>
                      </div>

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
                      {!executable && relativePaths.length > 0 ? <span className="muted">{RESTORE_EXECUTION_SCOPE_GUIDE}</span> : null}
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
              placeholder={RESTORE_PREPARATION_CONFIRMATION_TEXT}
              rows={3}
              value={restoreConfirmationText}
            />
            <span className="field-hint">{RESTORE_PREPARATION_CONFIRMATION_GUIDE}</span>
            {restorePreparationInputDisabled ? (
              <span className="muted">입력 가능 상태가 되면 확인 문구를 정확히 입력해주세요.</span>
            ) : restoreConfirmationText.length === 0 ? (
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
              <span>확인 문구 일치 여부</span>
              <span className="status-chip" style={getRestorePreparationStatusChipStyle(restoreConfirmationMatches)}>
                {restoreConfirmationMatches ? '일치' : '불일치'}
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
