import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockUseAuth = vi.fn()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/admin/api/backupManagementApi', () => ({
  BACKUP_TYPE_OPTIONS: ['AUTO', 'MANUAL'],
  BACKUP_STATUS_OPTIONS: ['SUCCESS', 'FAILED'],
  fetchBackupHistoryPage: vi.fn(),
  fetchLatestBackupHistory: vi.fn(),
  runManualBackup: vi.fn(),
}))

vi.mock('../src/features/admin/api/restoreManagementApi', () => ({
  RESTORE_DETECTED_ITEM_TYPES: ['DATABASE', 'CONFIG', 'SCALES', 'METADATA'],
  RESTORE_EXECUTABLE_ITEM_TYPES: ['DATABASE'],
  RESTORE_STATUS_OPTIONS: ['UPLOADED', 'VALIDATED', 'PRE_BACKUP_RUNNING', 'PRE_BACKUP_FAILED', 'RESTORING', 'SUCCESS', 'FAILED'],
  fetchRestoreHistoryPage: vi.fn(),
  fetchRestoreDetail: vi.fn(),
  fetchRestorePreparation: vi.fn(),
  uploadRestoreZip: vi.fn(),
  executeRestore: vi.fn(),
}))

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>대상자 목록 화면</div>,
}))

import { AppRouter } from '../src/app/router/AppRouter'
import { AdminBackupsPage } from '../src/pages/admin/AdminBackupsPage'
import {
  fetchBackupHistoryPage,
  fetchLatestBackupHistory,
  runManualBackup,
} from '../src/features/admin/api/backupManagementApi'
import {
  executeRestore,
  fetchRestoreDetail,
  fetchRestorePreparation,
  fetchRestoreHistoryPage,
  uploadRestoreZip,
} from '../src/features/admin/api/restoreManagementApi'

const mockedFetchBackupHistoryPage = vi.mocked(fetchBackupHistoryPage)
const mockedFetchLatestBackupHistory = vi.mocked(fetchLatestBackupHistory)
const mockedRunManualBackup = vi.mocked(runManualBackup)
const mockedFetchRestoreHistoryPage = vi.mocked(fetchRestoreHistoryPage)
const mockedFetchRestoreDetail = vi.mocked(fetchRestoreDetail)
const mockedFetchRestorePreparation = vi.mocked(fetchRestorePreparation)
const mockedExecuteRestore = vi.mocked(executeRestore)
const mockedUploadRestoreZip = vi.mocked(uploadRestoreZip)

function createAdminUser(role: 'ADMIN' | 'USER' = 'ADMIN') {
  return {
    id: 1,
    loginId: role === 'ADMIN' ? 'admina' : 'usera',
    name: role === 'ADMIN' ? '관리자' : '일반 사용자',
    phone: '010-0000-0000',
    positionName: '팀원',
    teamName: '정신건강팀',
    role,
    status: 'ACTIVE' as const,
  }
}

function createBackupHistoryItem(
  overrides?: Partial<Awaited<ReturnType<typeof fetchBackupHistoryPage>>['items'][number]>,
) {
  return {
    id: 41,
    backupType: 'MANUAL' as const,
    backupMethod: 'DB_DUMP',
    status: 'SUCCESS' as const,
    fileName: 'backup-20260330-090500-db-dump.sql',
    filePath: 'D:/backup/backup-20260330-090500-db-dump.sql',
    fileSizeLabel: '1.2 MB',
    startedAt: '2026-03-30T09:05:00',
    completedAt: '2026-03-30T09:05:15',
    executedByName: '관리자',
    failureReason: '-',
    ...overrides,
  }
}

function createBackupHistoryPage(
  items: Array<ReturnType<typeof createBackupHistoryItem>>,
  overrides?: Partial<Awaited<ReturnType<typeof fetchBackupHistoryPage>>>,
) {
  return {
    items,
    page: 1,
    size: 20,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  }
}

function createRestoreHistoryItem(
  overrides?: Partial<Awaited<ReturnType<typeof fetchRestoreHistoryPage>>['items'][number]>,
) {
  return {
    id: 71,
    status: 'VALIDATED' as const,
    fileName: 'restore-validated.zip',
    fileSizeLabel: '2.0 MB',
    uploadedAt: '2026-04-04 09:00',
    validatedAt: '2026-04-04 09:05',
    uploadedByName: '관리자',
    formatVersion: 'FULL_BACKUP_ZIP_V1',
    datasourceType: 'MYSQL',
    backupId: 9001,
    failureReason: '-',
    executionCapability: 'EXECUTABLE' as const,
    executionBlockedReason: null,
    ...overrides,
  }
}

function createRestoreHistoryPage(
  items: Array<ReturnType<typeof createRestoreHistoryItem>>,
  overrides?: Partial<Awaited<ReturnType<typeof fetchRestoreHistoryPage>>>,
) {
  return {
    items,
    page: 1,
    size: 20,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  }
}

function createRestoreDetail(
  overrides?: Partial<Awaited<ReturnType<typeof fetchRestoreDetail>>>,
) {
  return {
    id: 71,
    status: 'VALIDATED' as const,
    fileName: 'restore-validated.zip',
    uploadedAt: '2026-04-04 09:00',
    validatedAt: '2026-04-04 09:05',
    executedAt: '-',
    uploadedByName: '관리자',
    formatVersion: 'FULL_BACKUP_ZIP_V1',
    datasourceType: 'MYSQL',
    backupId: 9001,
    selectedItemTypes: [],
    preBackupId: null,
    preBackupFileName: '-',
    failureReason: '-',
    detectedItems: [
      { itemType: 'DATABASE', relativePaths: ['db/database.sql'] },
      { itemType: 'CONFIG', relativePaths: ['config/application.yml'] },
      { itemType: 'SCALES', relativePaths: ['scales/test-scale.json'] },
      { itemType: 'METADATA', relativePaths: ['metadata/summary.json'] },
    ],
    executionCapability: 'EXECUTABLE' as const,
    executionBlockedReason: null,
    ...overrides,
  }
}

function createRestoreUploadResult(
  overrides?: Partial<Awaited<ReturnType<typeof uploadRestoreZip>>>,
) {
  return {
    restoreId: 71,
    status: 'VALIDATED' as const,
    fileName: 'restore-validated.zip',
    validatedAt: '2026-04-04 09:05',
    formatVersion: 'FULL_BACKUP_ZIP_V1',
    datasourceType: 'MYSQL',
    backupId: 9001,
    detectedItems: [
      { itemType: 'DATABASE', relativePaths: ['db/database.sql'] },
      { itemType: 'CONFIG', relativePaths: ['config/application.yml'] },
    ],
    failureReason: '-',
    executionCapability: 'EXECUTABLE' as const,
    executionBlockedReason: null,
    ...overrides,
  }
}

function createRestorePreparation(
  overrides?: Partial<Awaited<ReturnType<typeof fetchRestorePreparation>>>,
) {
  return {
    restoreId: 71,
    status: 'VALIDATED' as const,
    confirmationRequiredText: '전체 복원을 실행합니다',
    confirmationTextStatus: 'WAITING_INPUT' as const,
    itemGroups: [
      {
        itemType: 'DATABASE',
        relativePaths: ['db/database.sql'],
        selectable: true,
        selected: false,
        blockedReason: null,
      },
    ],
    selectedItemTypes: [],
    selectedGroupCount: 0,
    confirmationTextMatched: false,
    readyToExecute: false,
    blockedReason: '복원 대상 항목을 하나 이상 선택해주세요.',
    ...overrides,
  }
}

function renderAdminBackupsPage() {
  return render(
    <MemoryRouter>
      <AdminBackupsPage />
    </MemoryRouter>,
  )
}

function getBackupFilterForm() {
  return screen.getByRole('form', { name: '백업 이력 필터' })
}

function getRestoreFilterForm() {
  return screen.getByRole('form', { name: '복원 검증 이력 필터' })
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: createAdminUser(),
    initialized: true,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  })
  mockedFetchBackupHistoryPage.mockReset()
  mockedFetchLatestBackupHistory.mockReset()
  mockedRunManualBackup.mockReset()
  mockedFetchRestoreHistoryPage.mockReset()
  mockedFetchRestoreDetail.mockReset()
  mockedFetchRestorePreparation.mockReset()
  mockedExecuteRestore.mockReset()
  mockedUploadRestoreZip.mockReset()
  mockedFetchRestoreHistoryPage.mockResolvedValue(createRestoreHistoryPage([]))
})

afterEach(() => {
  cleanup()
})

describe('admin backups', () => {
  it('renders the backup history list when the admin page opens', async () => {
    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())

    renderAdminBackupsPage()

    await waitFor(() => {
      expect(mockedFetchBackupHistoryPage).toHaveBeenCalledWith({
        backupType: undefined,
        status: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        page: 1,
        size: 20,
      })
    })

    expect(await screen.findByRole('heading', { name: '백업 관리' })).toBeTruthy()
    expect(screen.getByText('backup-20260330-090500-db-dump.sql')).toBeTruthy()
    expect(screen.getAllByText('D:/backup/backup-20260330-090500-db-dump.sql').length).toBeGreaterThan(0)
    expect(screen.getByText('1.2 MB')).toBeTruthy()
  })

  it('applies backupType, status, and date filters to the list request', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage
      .mockResolvedValueOnce(createBackupHistoryPage([createBackupHistoryItem()]))
      .mockResolvedValueOnce(createBackupHistoryPage([createBackupHistoryItem({ id: 42, backupType: 'AUTO', status: 'FAILED' })]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())

    renderAdminBackupsPage()

    await screen.findByText('backup-20260330-090500-db-dump.sql')

    const backupFilterForm = getBackupFilterForm()

    await user.selectOptions(within(backupFilterForm).getByLabelText('백업 유형'), 'AUTO')
    await user.selectOptions(within(backupFilterForm).getByLabelText('상태'), 'FAILED')
    fireEvent.change(within(backupFilterForm).getByLabelText('시작일'), { target: { value: '2026-03-01' } })
    fireEvent.change(within(backupFilterForm).getByLabelText('종료일'), { target: { value: '2026-03-31' } })
    await user.click(within(backupFilterForm).getByRole('button', { name: '조회' }))

    await waitFor(() => {
      expect(mockedFetchBackupHistoryPage).toHaveBeenLastCalledWith({
        backupType: 'AUTO',
        status: 'FAILED',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
        page: 1,
        size: 20,
      })
    })
  })

  it('blocks the request and shows a validation message when the date range is invalid', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())

    renderAdminBackupsPage()

    await screen.findByText('backup-20260330-090500-db-dump.sql')

    const backupFilterForm = getBackupFilterForm()

    fireEvent.change(within(backupFilterForm).getByLabelText('시작일'), { target: { value: '2026-04-01' } })
    fireEvent.change(within(backupFilterForm).getByLabelText('종료일'), { target: { value: '2026-03-01' } })
    await user.click(within(backupFilterForm).getByRole('button', { name: '조회' }))

    expect(await screen.findByText('조회 기간을 다시 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.')).toBeTruthy()
    expect(mockedFetchBackupHistoryPage).toHaveBeenCalledTimes(1)
  })

  it('applies restore status/date filters with the existing restore history API params and resets the page to 1', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())
    mockedFetchRestoreHistoryPage
      .mockResolvedValueOnce(createRestoreHistoryPage([createRestoreHistoryItem()], { totalItems: 3, totalPages: 3 }))
      .mockResolvedValueOnce(createRestoreHistoryPage([createRestoreHistoryItem({ id: 72 })], { page: 2, totalItems: 3, totalPages: 3 }))
      .mockResolvedValueOnce(createRestoreHistoryPage([createRestoreHistoryItem({ id: 73, status: 'FAILED' as const })], { totalItems: 1, totalPages: 1 }))

    renderAdminBackupsPage()

    const restoreHistoryCard = (await screen.findByText('복원 검증 이력 3건')).closest('.card')
    expect(restoreHistoryCard).toBeTruthy()

    await user.click(within(restoreHistoryCard as HTMLElement).getByRole('button', { name: '다음' }))

    await waitFor(() => {
      expect(mockedFetchRestoreHistoryPage).toHaveBeenNthCalledWith(2, {
        page: 2,
        size: 20,
      })
    })

    const restoreFilterForm = getRestoreFilterForm()

    await user.selectOptions(within(restoreFilterForm).getByLabelText('상태'), 'FAILED')
    fireEvent.change(within(restoreFilterForm).getByLabelText('시작일'), { target: { value: '2026-04-01' } })
    fireEvent.change(within(restoreFilterForm).getByLabelText('종료일'), { target: { value: '2026-04-30' } })
    await user.click(within(restoreFilterForm).getByRole('button', { name: '조회' }))

    await waitFor(() => {
      expect(mockedFetchRestoreHistoryPage).toHaveBeenLastCalledWith({
        status: 'FAILED',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-30',
        page: 1,
        size: 20,
      })
    })
  })

  it('blocks the restore history request and shows a validation message when the restore date range is invalid', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())
    mockedFetchRestoreHistoryPage.mockResolvedValue(createRestoreHistoryPage([createRestoreHistoryItem()]))

    renderAdminBackupsPage()

    await screen.findByText('restore-validated.zip')

    const restoreFilterForm = getRestoreFilterForm()

    fireEvent.change(within(restoreFilterForm).getByLabelText('시작일'), { target: { value: '2026-04-30' } })
    fireEvent.change(within(restoreFilterForm).getByLabelText('종료일'), { target: { value: '2026-04-01' } })
    await user.click(within(restoreFilterForm).getByRole('button', { name: '조회' }))

    expect(await within(restoreFilterForm).findByText('조회 기간을 다시 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.')).toBeTruthy()
    expect(mockedFetchRestoreHistoryPage).toHaveBeenCalledTimes(1)
  })

  it('opens the confirmation modal and refreshes the list after a manual backup run', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage
      .mockResolvedValueOnce(createBackupHistoryPage([createBackupHistoryItem()]))
      .mockResolvedValueOnce(createBackupHistoryPage([createBackupHistoryItem({ id: 43, fileName: 'backup-20260330-101500-db-dump.sql' })]))
    mockedFetchLatestBackupHistory
      .mockResolvedValueOnce(createBackupHistoryItem())
      .mockResolvedValueOnce(createBackupHistoryItem({ id: 43, fileName: 'backup-20260330-101500-db-dump.sql' }))
    mockedRunManualBackup.mockResolvedValue({
      backupId: 43,
      backupType: 'MANUAL',
      backupMethod: 'DB_DUMP',
      datasourceType: 'MARIADB',
      preflightSummary: 'datasource=MARIADB',
      status: 'SUCCESS',
      fileName: 'backup-20260330-101500-db-dump.sql',
      filePath: 'D:/backup/backup-20260330-101500-db-dump.sql',
    })

    renderAdminBackupsPage()

    await screen.findByText('backup-20260330-090500-db-dump.sql')

    await user.click(screen.getByRole('button', { name: '수동 백업 실행' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()

    await user.type(screen.getByLabelText('실행 사유'), '배포 전 수동 백업')
    await user.click(screen.getByRole('button', { name: '백업 실행' }))

    await waitFor(() => {
      expect(mockedRunManualBackup).toHaveBeenCalledWith('배포 전 수동 백업')
    })
    await waitFor(() => {
      expect(mockedFetchBackupHistoryPage).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByText('수동 백업을 실행했습니다. DB_DUMP 방식으로 backup-20260330-101500-db-dump.sql 이 생성되었습니다.')).toBeTruthy()
    expect(await screen.findByText('backup-20260330-101500-db-dump.sql')).toBeTruthy()
  })

  it('shows a representative error message and retries the history request', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            data: null,
            message: '입력값을 다시 확인해주세요.',
            errorCode: 'VALIDATION_ERROR',
            fieldErrors: [],
          },
        },
      })
      .mockResolvedValueOnce(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())

    renderAdminBackupsPage()

    expect(await screen.findByText('입력값을 다시 확인해주세요.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => {
      expect(mockedFetchBackupHistoryPage).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('backup-20260330-090500-db-dump.sql')).toBeTruthy()
  })

  it('shows an empty state when the list is empty', async () => {
    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([]))
    mockedFetchLatestBackupHistory.mockResolvedValue(null)

    renderAdminBackupsPage()

    expect(await screen.findByText('조건에 맞는 백업 이력이 없습니다.')).toBeTruthy()
  })

  it('blocks non-admin users from accessing the backup page', async () => {
    mockUseAuth.mockReturnValue({
      user: createAdminUser('USER'),
      initialized: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin/backups']}>
        <AppRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByText('대상자 목록 화면')).toBeTruthy()
    expect(mockedFetchBackupHistoryPage).not.toHaveBeenCalled()
  })

  it('shows the server blocked reason when the uploaded restore zip is incompatible', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())
    mockedFetchRestoreHistoryPage.mockResolvedValue(createRestoreHistoryPage([createRestoreHistoryItem({
      fileName: 'backup-20260404-173219-snapshot-full-v1.zip',
      datasourceType: 'H2',
      backupId: 4,
    })]))
    mockedFetchRestoreDetail.mockResolvedValue(createRestoreDetail({
      fileName: 'backup-20260404-173219-snapshot-full-v1.zip',
      datasourceType: 'H2',
      backupId: 4,
      executionCapability: 'BLOCKED',
      executionBlockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.\n업로드한 ZIP datasourceType=H2 는 현재 버전에서 지원하지 않습니다.',
      detectedItems: [
        { itemType: 'CONFIG', relativePaths: ['config/application.yml'] },
        { itemType: 'SCALES', relativePaths: ['scales/test-scale.json'] },
        { itemType: 'METADATA', relativePaths: ['metadata/summary.json'] },
      ],
    }))
    mockedFetchRestorePreparation.mockResolvedValue(createRestorePreparation({
      confirmationTextStatus: 'NOT_APPLICABLE',
      itemGroups: [
        {
          itemType: 'DATABASE',
          relativePaths: [],
          selectable: false,
          selected: false,
          blockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.\n업로드한 ZIP datasourceType=H2 는 현재 버전에서 지원하지 않습니다.',
        },
      ],
      blockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.\n업로드한 ZIP datasourceType=H2 는 현재 버전에서 지원하지 않습니다.',
    }))

    renderAdminBackupsPage()

    await screen.findByText('backup-20260404-173219-snapshot-full-v1.zip')

    await user.click(screen.getByText('backup-20260404-173219-snapshot-full-v1.zip'))

    expect(await screen.findByText('표시 전용 detectedItems')).toBeTruthy()

    const restoreDetailCard = screen.getByText('선택한 복원 검증 상세').closest('.card')
    expect(restoreDetailCard).toBeTruthy()

    const restoreDetailScope = within(restoreDetailCard as HTMLElement)
    expect(restoreDetailScope.getByText('실행 가능 여부')).toBeTruthy()
    expect(restoreDetailScope.getByText('실행 불가 사유')).toBeTruthy()
    expect(restoreDetailScope.getAllByText('VALIDATED').length).toBeGreaterThan(0)
    expect(restoreDetailScope.getAllByText('실행 불가').length).toBeGreaterThan(0)

    expect(screen.getByText('CONFIG 1개')).toBeTruthy()
    expect(screen.getByText('SCALES 1개')).toBeTruthy()
    expect(screen.getByText('METADATA 1개')).toBeTruthy()
    expect(screen.getByText('실행 대상 유형')).toBeTruthy()
    expect(screen.getByText('대상 없음')).toBeTruthy()
    expect(screen.getByText('판단 제외')).toBeTruthy()
    expect(screen.getByText('복원 실행 차단 사유')).toBeTruthy()
    expect((await screen.findAllByText(/db\/database\.sql/)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/datasourceType=H2/)).length).toBeGreaterThan(0)
    expect(screen.getByText('확인 문구 상태 안내')).toBeTruthy()
    expect((await screen.findAllByText('현재는 복원 실행 자체가 불가하여 확인 문구를 판단하지 않습니다.')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('복원 실행 확인 문구')).toBeDisabled()
    expect(screen.queryByText('확인 문구가 정확히 일치하지 않습니다.')).toBeNull()
    expect(screen.getAllByText('선택된 그룹 없음').length).toBeGreaterThan(0)
    expect(screen.getByText('실행 준비 불가')).toBeTruthy()
  })

  it('shows validated status and blocked execution capability separately in the restore history list', async () => {
    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())
    mockedFetchRestoreHistoryPage.mockResolvedValue(createRestoreHistoryPage([createRestoreHistoryItem({
      fileName: 'backup-20260404-173219-snapshot-full-v1.zip',
      datasourceType: 'H2',
      backupId: 4,
      executionCapability: 'BLOCKED',
      executionBlockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.\n업로드한 ZIP datasourceType=H2 는 현재 버전에서 지원하지 않습니다.',
    })]))

    renderAdminBackupsPage()

    const restoreRow = (await screen.findByText('backup-20260404-173219-snapshot-full-v1.zip')).closest('tr')
    expect(screen.getByRole('columnheader', { name: '실행 가능 여부' })).toBeTruthy()
    expect(restoreRow).toBeTruthy()

    const restoreRowScope = within(restoreRow as HTMLElement)
    expect(restoreRowScope.getByText('VALIDATED')).toBeTruthy()
    expect(restoreRowScope.getByText('실행 불가')).toBeTruthy()
    expect(restoreRowScope.getByText(/db\/database\.sql/)).toBeTruthy()
    expect(restoreRowScope.getByText(/datasourceType=H2/)).toBeTruthy()
  })

  it('shows upload validation success together with blocked execution capability notice', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())
    mockedFetchRestoreHistoryPage
      .mockResolvedValueOnce(createRestoreHistoryPage([]))
      .mockResolvedValueOnce(createRestoreHistoryPage([createRestoreHistoryItem({
        id: 72,
        fileName: 'backup-20260404-173219-snapshot-full-v1.zip',
        datasourceType: 'H2',
        backupId: 4,
      })]))
    mockedUploadRestoreZip.mockResolvedValue(createRestoreUploadResult({
      restoreId: 72,
      fileName: 'backup-20260404-173219-snapshot-full-v1.zip',
      datasourceType: 'H2',
      backupId: 4,
      executionCapability: 'BLOCKED',
      executionBlockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.',
    }))
    mockedFetchRestoreDetail.mockResolvedValue(createRestoreDetail({
      id: 72,
      fileName: 'backup-20260404-173219-snapshot-full-v1.zip',
      datasourceType: 'H2',
      backupId: 4,
      executionCapability: 'BLOCKED',
      executionBlockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.',
      detectedItems: [
        { itemType: 'CONFIG', relativePaths: ['config/application.yml'] },
        { itemType: 'SCALES', relativePaths: ['scales/test-scale.json'] },
        { itemType: 'METADATA', relativePaths: ['metadata/summary.json'] },
      ],
    }))
    mockedFetchRestorePreparation.mockResolvedValue(createRestorePreparation({
      restoreId: 72,
      confirmationTextStatus: 'NOT_APPLICABLE',
      itemGroups: [
        {
          itemType: 'DATABASE',
          relativePaths: [],
          selectable: false,
          selected: false,
          blockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.',
        },
      ],
      blockedReason: '업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.',
    }))

    const view = renderAdminBackupsPage()
    await screen.findByText('backup-20260330-090500-db-dump.sql')

    const fileInput = view.container.querySelector('input[type="file"]')
    expect(fileInput).toBeTruthy()
    await user.upload(fileInput as HTMLInputElement, new File(['zip'], 'backup-20260404-173219-snapshot-full-v1.zip', { type: 'application/zip' }))
    await user.click(screen.getByRole('button', { name: '업로드' }))

    expect(await screen.findByText(/업로드\/검증이 완료되었습니다\./)).toBeTruthy()
    expect(screen.getByText(/현재 버전에서는 복원 실행이 불가합니다\./)).toBeTruthy()
    expect(screen.getByText(/restoreId 72 상세를 확인하세요\./)).toBeTruthy()
  })

  it('shows confirmation mismatch separately when restore is otherwise selectable', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())
    mockedFetchRestoreHistoryPage.mockResolvedValue(createRestoreHistoryPage([createRestoreHistoryItem()]))
    mockedFetchRestoreDetail.mockResolvedValue(createRestoreDetail())
    mockedFetchRestorePreparation
      .mockResolvedValueOnce(createRestorePreparation())
      .mockResolvedValueOnce(createRestorePreparation({
        itemGroups: [
          {
            itemType: 'DATABASE',
            relativePaths: ['db/database.sql'],
            selectable: true,
            selected: true,
            blockedReason: null,
          },
        ],
        selectedItemTypes: ['DATABASE'],
        selectedGroupCount: 1,
        blockedReason: '확인 문구를 입력해주세요.',
      }))
      .mockResolvedValueOnce(createRestorePreparation({
        itemGroups: [
          {
            itemType: 'DATABASE',
            relativePaths: ['db/database.sql'],
            selectable: true,
            selected: true,
            blockedReason: null,
          },
        ],
        confirmationTextStatus: 'MISMATCHED',
        selectedItemTypes: ['DATABASE'],
        selectedGroupCount: 1,
        blockedReason: '확인 문구는 정확히 전체 복원을 실행합니다 이어야 합니다.',
      }))

    renderAdminBackupsPage()

    await screen.findByText('restore-validated.zip')

    await user.click(screen.getByText('restore-validated.zip'))
    await user.click(await screen.findByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('복원 실행 확인 문구'), { target: { value: '틀린 문구' } })

    expect(await screen.findByText('불일치')).toBeTruthy()
    expect(screen.getByText('복원 실행 차단 사유')).toBeTruthy()
    expect(screen.getByText('확인 문구 상태 안내')).toBeTruthy()
    expect((await screen.findAllByText('확인 문구는 정확히 전체 복원을 실행합니다 이어야 합니다.')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('확인 문구가 정확히 일치하지 않습니다.').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('복원 실행 확인 문구')).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '복원 실행' })).toBeDisabled()
  })

  it('executes restore through the existing preparation block and reloads list/detail', async () => {
    const user = userEvent.setup()

    mockedFetchBackupHistoryPage.mockResolvedValue(createBackupHistoryPage([createBackupHistoryItem()]))
    mockedFetchLatestBackupHistory.mockResolvedValue(createBackupHistoryItem())
    mockedFetchRestoreHistoryPage
      .mockResolvedValueOnce(createRestoreHistoryPage([createRestoreHistoryItem()]))
      .mockResolvedValueOnce(createRestoreHistoryPage([createRestoreHistoryItem({ status: 'SUCCESS' as const })]))
    mockedFetchRestoreDetail
      .mockResolvedValueOnce(createRestoreDetail())
      .mockResolvedValueOnce(
        createRestoreDetail({
          status: 'SUCCESS' as const,
          executedAt: '2026-04-04 09:10',
          selectedItemTypes: ['DATABASE'],
          preBackupId: 8001,
          preBackupFileName: 'backup-20260404-091000-snapshot-full-v1.zip',
        }),
      )
    mockedFetchRestorePreparation
      .mockResolvedValueOnce(createRestorePreparation())
      .mockResolvedValueOnce(createRestorePreparation({
        itemGroups: [
          {
            itemType: 'DATABASE',
            relativePaths: ['db/database.sql'],
            selectable: true,
            selected: true,
            blockedReason: null,
          },
        ],
        confirmationTextStatus: 'MISMATCHED',
        selectedItemTypes: ['DATABASE'],
        selectedGroupCount: 1,
        blockedReason: '확인 문구는 정확히 전체 복원을 실행합니다 이어야 합니다.',
      }))
      .mockResolvedValueOnce(createRestorePreparation({
        itemGroups: [
          {
            itemType: 'DATABASE',
            relativePaths: ['db/database.sql'],
            selectable: true,
            selected: true,
            blockedReason: null,
          },
        ],
        confirmationTextStatus: 'MATCHED',
        selectedItemTypes: ['DATABASE'],
        selectedGroupCount: 1,
        confirmationTextMatched: true,
        readyToExecute: true,
        blockedReason: null,
      }))
      .mockResolvedValueOnce(createRestorePreparation({
        status: 'SUCCESS' as const,
        itemGroups: [
          {
            itemType: 'DATABASE',
            relativePaths: ['db/database.sql'],
            selectable: false,
            selected: true,
            blockedReason: 'VALIDATED 상태의 복원 검증 상세에서만 DATABASE 복원 실행을 진행할 수 있습니다.',
          },
        ],
        confirmationTextStatus: 'NOT_APPLICABLE',
        selectedItemTypes: ['DATABASE'],
        selectedGroupCount: 1,
        confirmationTextMatched: false,
        readyToExecute: false,
        blockedReason: 'VALIDATED 상태의 복원 검증 상세에서만 DATABASE 복원 실행을 진행할 수 있습니다.',
      }))
    mockedExecuteRestore.mockResolvedValue({
      restoreId: 71,
      status: 'SUCCESS',
      executedAt: '2026-04-04 09:10',
      selectedItemTypes: ['DATABASE'],
      preBackupId: 8001,
      preBackupFileName: 'backup-20260404-091000-snapshot-full-v1.zip',
      message: '복원 실행이 완료되었습니다.',
      failureReason: '-',
    })

    renderAdminBackupsPage()

    await screen.findByText('restore-validated.zip')

    await user.click(screen.getByText('restore-validated.zip'))

    expect((await screen.findAllByText('db/database.sql')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('복원 대상 항목을 하나 이상 선택해주세요.')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('선택된 그룹 없음').length).toBeGreaterThan(0)

    const executeButton = screen.getByRole('button', { name: '복원 실행' })
    expect(executeButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('복원 실행 확인 문구'), { target: { value: '전체 복원을 실행합니다' } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '복원 실행' })).toBeEnabled()
    })
    await user.click(executeButton)

    await waitFor(() => {
      expect(mockedExecuteRestore).toHaveBeenCalledWith(71, {
        selectedItemTypes: ['DATABASE'],
        confirmationText: '전체 복원을 실행합니다',
      })
    })
    await waitFor(() => {
      expect(mockedFetchRestoreHistoryPage).toHaveBeenCalledTimes(2)
      expect(mockedFetchRestoreDetail).toHaveBeenCalledTimes(2)
      expect(mockedFetchRestorePreparation).toHaveBeenCalledTimes(4)
    })

    expect(await screen.findByText('복원 실행이 완료되었습니다.')).toBeTruthy()
    expect((await screen.findAllByText('backup-20260404-091000-snapshot-full-v1.zip')).length).toBeGreaterThan(0)
  })
})
