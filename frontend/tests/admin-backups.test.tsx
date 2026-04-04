import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  fetchRestoreHistoryPage: vi.fn(),
  fetchRestoreDetail: vi.fn(),
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
  fetchRestoreHistoryPage,
} from '../src/features/admin/api/restoreManagementApi'

const mockedFetchBackupHistoryPage = vi.mocked(fetchBackupHistoryPage)
const mockedFetchLatestBackupHistory = vi.mocked(fetchLatestBackupHistory)
const mockedRunManualBackup = vi.mocked(runManualBackup)
const mockedFetchRestoreHistoryPage = vi.mocked(fetchRestoreHistoryPage)
const mockedFetchRestoreDetail = vi.mocked(fetchRestoreDetail)
const mockedExecuteRestore = vi.mocked(executeRestore)

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
  mockedExecuteRestore.mockReset()
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

    await user.selectOptions(screen.getByLabelText('백업 유형'), 'AUTO')
    await user.selectOptions(screen.getByLabelText('상태'), 'FAILED')
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-03-31' } })
    await user.click(screen.getByRole('button', { name: '조회' }))

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

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-03-01' } })
    await user.click(screen.getByRole('button', { name: '조회' }))

    expect(await screen.findByText('조회 기간을 다시 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.')).toBeTruthy()
    expect(mockedFetchBackupHistoryPage).toHaveBeenCalledTimes(1)
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

    expect(await screen.findByText('db/database.sql')).toBeTruthy()
    expect(screen.getByText('현재 버전 복원 제외')).toBeTruthy()

    const executeButton = screen.getByRole('button', { name: '복원 실행' })
    expect(executeButton).toBeDisabled()

    await user.type(screen.getByLabelText('복원 실행 확인 문구'), '전체 복원을 실행합니다')
    expect(screen.getByRole('button', { name: '복원 실행' })).toBeEnabled()
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
    })

    expect(await screen.findByText('복원 실행이 완료되었습니다.')).toBeTruthy()
    expect(await screen.findByText('backup-20260404-091000-snapshot-full-v1.zip')).toBeTruthy()
  })
})
