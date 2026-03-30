import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockUseAuth = vi.fn()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/admin/api/userManagementApi', () => ({
  DEFAULT_USER_MANAGEMENT_PAGE_SIZE: 20,
  USER_MANAGEMENT_PAGE_SIZE_OPTIONS: [20, 50],
  fetchUserManagementPage: vi.fn(),
  updateUserManagementRole: vi.fn(),
  updateUserManagementStatus: vi.fn(),
}))

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>대상자 목록 화면</div>,
}))

import { AppRouter } from '../src/app/router/AppRouter'
import { AdminUsersPage } from '../src/pages/admin/AdminUsersPage'
import {
  fetchUserManagementPage,
  updateUserManagementRole,
  updateUserManagementStatus,
} from '../src/features/admin/api/userManagementApi'

const mockedFetchUserManagementPage = vi.mocked(fetchUserManagementPage)
const mockedUpdateUserManagementRole = vi.mocked(updateUserManagementRole)
const mockedUpdateUserManagementStatus = vi.mocked(updateUserManagementStatus)

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

function createManagedUserItem(
  overrides?: Partial<Awaited<ReturnType<typeof fetchUserManagementPage>>['items'][number]>,
) {
  return {
    id: 7,
    name: '홍길동',
    loginId: 'honggildong',
    contact: '010-1111-2222',
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    approvedAt: '2026-03-25 09:00',
    lastLoginAt: '2026-03-29 15:40',
    ...overrides,
  }
}

function createManagedUserPage(
  items: Array<ReturnType<typeof createManagedUserItem>>,
  overrides?: Partial<Awaited<ReturnType<typeof fetchUserManagementPage>>>,
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

function renderAdminUsersPage() {
  return render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: createAdminUser(),
    initialized: true,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  })
  mockedFetchUserManagementPage.mockReset()
  mockedUpdateUserManagementRole.mockReset()
  mockedUpdateUserManagementStatus.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('admin users', () => {
  it('renders the user list when the admin page opens', async () => {
    mockedFetchUserManagementPage.mockResolvedValue(createManagedUserPage([createManagedUserItem()]))

    renderAdminUsersPage()

    await waitFor(() => {
      expect(mockedFetchUserManagementPage).toHaveBeenCalledWith({
        keyword: undefined,
        role: undefined,
        status: undefined,
        page: 1,
        size: 20,
      })
    })

    expect(screen.getByRole('heading', { name: '사용자 관리' })).toBeTruthy()
    expect(screen.getByText('홍길동')).toBeTruthy()
    expect(screen.getByText('honggildong')).toBeTruthy()
    expect(screen.getByText('010-1111-2222')).toBeTruthy()
    expect(screen.getByText('2026-03-25 09:00')).toBeTruthy()
    expect(screen.getByText('2026-03-29 15:40')).toBeTruthy()
  })

  it('applies filters on search and restores defaults on reset', async () => {
    const user = userEvent.setup()

    mockedFetchUserManagementPage.mockResolvedValue(createManagedUserPage([createManagedUserItem()]))

    renderAdminUsersPage()

    await screen.findByText('홍길동')

    await user.type(screen.getByLabelText('검색어'), '김지원')
    await user.selectOptions(screen.getByLabelText('권한 필터'), 'ADMIN')
    await user.selectOptions(screen.getByLabelText('상태 필터'), 'INACTIVE')
    await user.selectOptions(screen.getByLabelText('페이지 크기'), '50')
    await user.click(screen.getByRole('button', { name: '조회' }))

    await waitFor(() => {
      expect(mockedFetchUserManagementPage).toHaveBeenLastCalledWith({
        keyword: '김지원',
        role: 'ADMIN',
        status: 'INACTIVE',
        page: 1,
        size: 50,
      })
    })

    await user.click(screen.getByRole('button', { name: '초기화' }))

    await waitFor(() => {
      expect(mockedFetchUserManagementPage).toHaveBeenLastCalledWith({
        keyword: undefined,
        role: undefined,
        status: undefined,
        page: 1,
        size: 20,
      })
    })
    expect((screen.getByLabelText('검색어') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('권한 필터') as HTMLSelectElement).value).toBe('')
    expect((screen.getByLabelText('상태 필터') as HTMLSelectElement).value).toBe('')
    expect((screen.getByLabelText('페이지 크기') as HTMLSelectElement).value).toBe('20')
  })

  it('calls the role patch API and refreshes the list after a role change', async () => {
    const user = userEvent.setup()

    mockedFetchUserManagementPage
      .mockResolvedValueOnce(createManagedUserPage([createManagedUserItem({ role: 'USER' })]))
      .mockResolvedValueOnce(createManagedUserPage([createManagedUserItem({ role: 'ADMIN' })]))
    mockedUpdateUserManagementRole.mockResolvedValue({
      userId: 7,
      role: 'ADMIN',
      status: 'ACTIVE',
    })

    renderAdminUsersPage()

    const row = (await screen.findByText('홍길동')).closest('tr')
    if (!row) {
      throw new Error('사용자 행을 찾을 수 없습니다.')
    }

    await user.selectOptions(within(row).getByLabelText('홍길동 역할 변경 값'), 'ADMIN')
    await user.click(within(row).getByRole('button', { name: '역할 변경' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '변경 적용' }))

    await waitFor(() => {
      expect(mockedUpdateUserManagementRole).toHaveBeenCalledWith(7, 'ADMIN')
    })
    await waitFor(() => {
      expect(mockedFetchUserManagementPage).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByText('홍길동 사용자의 역할을 관리자로 변경했습니다.')).toBeTruthy()
  })

  it('moves back to page 1 after a status change when the current page is not the first page', async () => {
    const user = userEvent.setup()

    mockedFetchUserManagementPage
      .mockResolvedValueOnce(createManagedUserPage([createManagedUserItem()], { totalItems: 2, totalPages: 2 }))
      .mockResolvedValueOnce(
        createManagedUserPage(
          [createManagedUserItem({ id: 8, name: '이하늘', loginId: 'leehaneul', status: 'ACTIVE' })],
          { page: 2, totalItems: 2, totalPages: 2 },
        ),
      )
      .mockResolvedValueOnce(createManagedUserPage([], { page: 1, totalItems: 0, totalPages: 0 }))
    mockedUpdateUserManagementStatus.mockResolvedValue({
      userId: 8,
      role: 'USER',
      status: 'INACTIVE',
    })

    renderAdminUsersPage()

    await screen.findByText('홍길동')
    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(await screen.findByText(/2\s*\/\s*2 페이지/)).toBeTruthy()

    const row = (await screen.findByText('이하늘')).closest('tr')
    if (!row) {
      throw new Error('사용자 행을 찾을 수 없습니다.')
    }

    await user.selectOptions(within(row).getByLabelText('이하늘 상태 변경 값'), 'INACTIVE')
    await user.click(within(row).getByRole('button', { name: '상태 변경' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '변경 적용' }))

    await waitFor(() => {
      expect(mockedUpdateUserManagementStatus).toHaveBeenCalledWith(8, 'INACTIVE')
    })
    await waitFor(() => {
      expect(mockedFetchUserManagementPage).toHaveBeenLastCalledWith({
        keyword: undefined,
        role: undefined,
        status: undefined,
        page: 1,
        size: 20,
      })
    })

    expect(await screen.findByText(/1\s*\/\s*1 페이지/)).toBeTruthy()
    expect(screen.getByText('이하늘 사용자의 상태를 비활성으로 변경했습니다.')).toBeTruthy()
  })

  it('shows a representative server error message when an update fails', async () => {
    const user = userEvent.setup()

    mockedFetchUserManagementPage.mockResolvedValue(createManagedUserPage([createManagedUserItem()]))
    mockedUpdateUserManagementStatus.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          success: false,
          data: null,
          message: '마지막 활성 관리자 계정은 비활성화할 수 없습니다.',
          errorCode: 'LAST_ACTIVE_ADMIN_REQUIRED',
          fieldErrors: [],
        },
      },
    })

    renderAdminUsersPage()

    const row = (await screen.findByText('홍길동')).closest('tr')
    if (!row) {
      throw new Error('사용자 행을 찾을 수 없습니다.')
    }

    await user.selectOptions(within(row).getByLabelText('홍길동 상태 변경 값'), 'INACTIVE')
    await user.click(within(row).getByRole('button', { name: '상태 변경' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '변경 적용' }))

    await waitFor(() => {
      expect(mockedUpdateUserManagementStatus).toHaveBeenCalledWith(7, 'INACTIVE')
    })

    expect(await screen.findByText('마지막 활성 관리자 계정은 비활성화할 수 없습니다.')).toBeTruthy()
  })

  it('shows a representative list error message and retries the list request', async () => {
    const user = userEvent.setup()

    mockedFetchUserManagementPage
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            data: null,
            message: '관리자 권한이 필요합니다.',
            errorCode: 'FORBIDDEN',
            fieldErrors: [],
          },
        },
      })
      .mockResolvedValueOnce(createManagedUserPage([createManagedUserItem({ id: 9, name: '박서연' })]))

    renderAdminUsersPage()

    expect(await screen.findByText('관리자 권한이 필요합니다.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => {
      expect(mockedFetchUserManagementPage).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('박서연')).toBeTruthy()
  })

  it('normalizes null and empty values to a dash', async () => {
    mockedFetchUserManagementPage.mockResolvedValue(
      createManagedUserPage([
        createManagedUserItem({
          contact: '-',
          approvedAt: '-',
          lastLoginAt: '-',
        }),
      ]),
    )

    renderAdminUsersPage()

    const row = (await screen.findByText('홍길동')).closest('tr')
    if (!row) {
      throw new Error('사용자 행을 찾을 수 없습니다.')
    }

    expect(within(row).getAllByText('-').length).toBeGreaterThanOrEqual(3)
  })

  it('does not provide a status select for pending users', async () => {
    mockedFetchUserManagementPage.mockResolvedValue(
      createManagedUserPage([createManagedUserItem({ status: 'PENDING' })]),
    )

    renderAdminUsersPage()

    const row = (await screen.findByText('홍길동')).closest('tr')
    if (!row) {
      throw new Error('사용자 행을 찾을 수 없습니다.')
    }

    expect(within(row).queryByLabelText('홍길동 상태 변경 값')).toBeNull()
    expect(within(row).getByText('현재 상태에서는 변경할 수 없습니다.')).toBeTruthy()
  })

  it('shows an empty state when the list is empty', async () => {
    mockedFetchUserManagementPage.mockResolvedValue(createManagedUserPage([]))

    renderAdminUsersPage()

    expect(await screen.findByText('조건에 맞는 사용자가 없습니다.')).toBeTruthy()
  })

  it('blocks non-admin users from accessing the user management page', async () => {
    mockUseAuth.mockReturnValue({
      user: createAdminUser('USER'),
      initialized: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AppRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByText('대상자 목록 화면')).toBeTruthy()
    expect(mockedFetchUserManagementPage).not.toHaveBeenCalled()
  })
})
