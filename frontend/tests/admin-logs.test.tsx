import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockUseAuth = vi.fn()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/admin/api/activityLogManagementApi', () => ({
  ACTIVITY_LOG_ACTION_OPTIONS: [
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
  ],
  ACTIVITY_LOG_PAGE_SIZE_OPTIONS: [20, 50, 100],
  DEFAULT_ACTIVITY_LOG_PAGE_SIZE: 20,
  fetchActivityLogPage: vi.fn(),
}))

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>대상자 목록 화면</div>,
}))

import { AppRouter } from '../src/app/router/AppRouter'
import { AdminLogsPage } from '../src/pages/admin/AdminLogsPage'
import { fetchActivityLogPage } from '../src/features/admin/api/activityLogManagementApi'

const mockedFetchActivityLogPage = vi.mocked(fetchActivityLogPage)

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

function createActivityLogItem(
  overrides?: Partial<Awaited<ReturnType<typeof fetchActivityLogPage>>['items'][number]>,
) {
  return {
    id: 101,
    occurredAt: '2026-03-30T10:15:00',
    userLabel: '관리자 (#1)',
    ipAddress: '127.0.0.1',
    actionType: 'USER_ROLE_CHANGE',
    target: '사용자 #7 (USER #7)',
    description: '사용자 역할 변경: ADMIN',
    ...overrides,
  }
}

function createActivityLogPage(
  items: Array<ReturnType<typeof createActivityLogItem>>,
  overrides?: Partial<Awaited<ReturnType<typeof fetchActivityLogPage>>>,
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

function renderAdminLogsPage() {
  return render(
    <MemoryRouter>
      <AdminLogsPage />
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
  mockedFetchActivityLogPage.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('admin logs', () => {
  it('renders the activity log list when the admin page opens', async () => {
    mockedFetchActivityLogPage.mockResolvedValue(createActivityLogPage([createActivityLogItem()]))

    renderAdminLogsPage()

    await waitFor(() => {
      expect(mockedFetchActivityLogPage).toHaveBeenCalledWith({
        dateFrom: undefined,
        dateTo: undefined,
        userId: undefined,
        actionType: undefined,
        page: 1,
        size: 20,
      })
    })

    expect(screen.getByRole('heading', { name: '로그 확인' })).toBeTruthy()
    expect(screen.getByText(/관리자/)).toBeTruthy()
    expect(screen.getByRole('cell', { name: /USER_ROLE_CHANGE/ })).toBeTruthy()
    expect(screen.getByText('사용자 역할 변경: ADMIN')).toBeTruthy()
  })

  it('applies date, userId, actionType, and page size filters to the list request', async () => {
    const user = userEvent.setup()

    mockedFetchActivityLogPage
      .mockResolvedValueOnce(createActivityLogPage([createActivityLogItem()]))
      .mockResolvedValueOnce(createActivityLogPage([createActivityLogItem({ id: 102, actionType: 'LOGIN' })]))

    renderAdminLogsPage()

    await screen.findByText('사용자 역할 변경: ADMIN')

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-03-31' } })
    fireEvent.change(screen.getByLabelText('사용자 ID'), { target: { value: '7' } })
    await user.selectOptions(screen.getByLabelText('기능 유형'), 'LOGIN')
    await user.selectOptions(screen.getByLabelText('페이지 크기'), '50')
    await user.click(screen.getByRole('button', { name: '조회' }))

    await waitFor(() => {
      expect(mockedFetchActivityLogPage).toHaveBeenLastCalledWith({
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
        userId: 7,
        actionType: 'LOGIN',
        page: 1,
        size: 50,
      })
    })
  })

  it('blocks the request and shows a validation message when the date range is invalid', async () => {
    const user = userEvent.setup()

    mockedFetchActivityLogPage.mockResolvedValue(createActivityLogPage([createActivityLogItem()]))

    renderAdminLogsPage()

    await screen.findByText('사용자 역할 변경: ADMIN')

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-03-01' } })
    await user.click(screen.getByRole('button', { name: '조회' }))

    expect(await screen.findByText('조회 기간을 다시 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.')).toBeTruthy()
    expect(mockedFetchActivityLogPage).toHaveBeenCalledTimes(1)
  })

  it('shows a representative server error message and retries the request', async () => {
    const user = userEvent.setup()

    mockedFetchActivityLogPage
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            data: null,
            message: '조회 기간을 다시 확인해주세요.',
            errorCode: 'INVALID_DATE_RANGE',
            fieldErrors: [],
          },
        },
      })
      .mockResolvedValueOnce(createActivityLogPage([createActivityLogItem({ id: 103, description: '로그인 성공' })]))

    renderAdminLogsPage()

    expect(await screen.findByText('조회 기간을 다시 확인해주세요.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => {
      expect(mockedFetchActivityLogPage).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('로그인 성공')).toBeTruthy()
  })

  it('renders safe placeholders when target or description is missing', async () => {
    mockedFetchActivityLogPage.mockResolvedValue(
      createActivityLogPage([createActivityLogItem({ id: 104, target: '-', description: '-' })]),
    )

    renderAdminLogsPage()

    const placeholderCells = await screen.findAllByRole('cell', { name: '-' })

    expect(placeholderCells.length).toBeGreaterThanOrEqual(2)
  })

  it('shows an empty state when the list is empty', async () => {
    mockedFetchActivityLogPage.mockResolvedValue(createActivityLogPage([]))

    renderAdminLogsPage()

    expect(await screen.findByText('조건에 맞는 로그가 없습니다.')).toBeTruthy()
  })

  it('blocks non-admin users from accessing the activity log page', async () => {
    mockUseAuth.mockReturnValue({
      user: createAdminUser('USER'),
      initialized: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin/logs']}>
        <AppRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByText('대상자 목록 화면')).toBeTruthy()
    expect(mockedFetchActivityLogPage).not.toHaveBeenCalled()
  })
})
