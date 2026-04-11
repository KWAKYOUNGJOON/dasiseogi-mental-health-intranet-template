import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppMetadataProvider } from '../src/app/providers/AppMetadataProvider'
import { LoginPage } from '../src/pages/auth/LoginPage'
import { SignupRequestPage } from '../src/pages/auth/SignupRequestPage'
import { AdminUsersPage } from '../src/pages/admin/AdminUsersPage'
import { fetchAppMetadata } from '../src/features/app-metadata/api/appMetadataApi'
import { fetchUserManagementPage } from '../src/features/admin/api/userManagementApi'

const mockUseAuth = vi.fn()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/app-metadata/api/appMetadataApi', () => ({
  fetchAppMetadata: vi.fn(),
}))

vi.mock('../src/features/admin/api/userManagementApi', () => ({
  DEFAULT_USER_MANAGEMENT_PAGE_SIZE: 20,
  USER_MANAGEMENT_PAGE_SIZE_OPTIONS: [20, 50],
  fetchUserManagementPage: vi.fn(),
  updateUserManagementPositionName: vi.fn(),
  updateUserManagementRole: vi.fn(),
  updateUserManagementStatus: vi.fn(),
}))

const mockedFetchAppMetadata = vi.mocked(fetchAppMetadata)
const mockedFetchUserManagementPage = vi.mocked(fetchUserManagementPage)

function createGuestAuthValue() {
  return {
    user: null,
    initialized: true,
    status: 'unauthenticated' as const,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  }
}

function createAdminAuthValue() {
  return {
    user: {
      id: 1,
      loginId: 'admina',
      name: '관리자',
      phone: '010-0000-0000',
      positionName: '팀장',
      teamName: '정신건강팀',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
    },
    initialized: true,
    status: 'authenticated' as const,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  }
}

function renderWithMetadata(ui: ReactNode) {
  return render(
    <AppMetadataProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </AppMetadataProvider>,
  )
}

beforeEach(() => {
  mockedFetchAppMetadata.mockReset()
  mockedFetchUserManagementPage.mockReset()
  mockUseAuth.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('app metadata consumers', () => {
  it('renders the login title from backend app metadata', async () => {
    mockUseAuth.mockReturnValue(createGuestAuthValue())
    mockedFetchAppMetadata.mockResolvedValue({
      organizationName: '기관 메타데이터 제목',
      positionNames: ['센터장', '코디네이터', '실무자'],
    })

    renderWithMetadata(<LoginPage />)

    expect(await screen.findByRole('heading', { name: '기관 메타데이터 제목' })).toBeTruthy()
  })

  it('renders signup position options from backend app metadata', async () => {
    mockUseAuth.mockReturnValue(createGuestAuthValue())
    mockedFetchAppMetadata.mockResolvedValue({
      organizationName: '기관 메타데이터 제목',
      positionNames: ['센터장', '코디네이터', '실무자'],
    })

    renderWithMetadata(<SignupRequestPage />)

    const positionSelect = (await screen.findByLabelText(/^직책 또는 역할/)) as HTMLSelectElement
    expect(Array.from(positionSelect.options).map((option) => option.value)).toEqual(['', '센터장', '코디네이터', '실무자'])
  })

  it('renders admin position options from backend app metadata', async () => {
    mockUseAuth.mockReturnValue(createAdminAuthValue())
    mockedFetchAppMetadata.mockResolvedValue({
      organizationName: '기관 메타데이터 제목',
      positionNames: ['센터장', '코디네이터', '실무자'],
    })
    mockedFetchUserManagementPage.mockResolvedValue({
      items: [
        {
          id: 7,
          name: '홍길동',
          loginId: 'honggildong',
          contact: '010-1111-2222',
          positionName: '코디네이터',
          role: 'USER',
          status: 'ACTIVE',
          approvedAt: '2026-03-25 09:00',
          lastLoginAt: '2026-03-29 15:40',
        },
      ],
      page: 1,
      size: 20,
      totalItems: 1,
      totalPages: 1,
    })

    renderWithMetadata(<AdminUsersPage />)

    await waitFor(() => {
      expect(mockedFetchUserManagementPage).toHaveBeenCalled()
    })

    const positionSelect = (await screen.findByLabelText('홍길동 직책 변경 값')) as HTMLSelectElement
    expect(Array.from(positionSelect.options).map((option) => option.value)).toEqual(['센터장', '코디네이터', '실무자'])
    expect(positionSelect.value).toBe('코디네이터')
  })
})
