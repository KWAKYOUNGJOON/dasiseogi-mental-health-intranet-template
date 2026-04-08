import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ClientCreatePage } from '../src/pages/clients/ClientCreatePage'
import { ClientEditPage } from '../src/pages/clients/ClientEditPage'
import type { AuthUser } from '../src/features/auth/api/authApi'
import { fetchAdminUsers } from '../src/features/admin/api/adminApi'
import { fetchClientDetail, type ClientDetail } from '../src/features/clients/api/clientApi'

interface MockAuthValue {
  user: AuthUser | null
  initialized: boolean
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const EXPECTED_GENDER_OPTIONS = [
  { value: 'MALE', label: '남성' },
  { value: 'FEMALE', label: '여성' },
  { value: 'OTHER', label: '기타' },
  { value: 'UNKNOWN', label: '미상' },
]

const mockNavigate = vi.fn<(to: string) => void>()
const mockLogin = vi.fn<(loginId: string, password: string) => Promise<void>>()
const mockLogout = vi.fn<() => Promise<void>>()
const mockRefresh = vi.fn<() => Promise<void>>()
const mockUseAuth = vi.fn<() => MockAuthValue>()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../src/features/admin/api/adminApi', () => ({
  fetchAdminUsers: vi.fn(),
}))

vi.mock('../src/features/clients/api/clientApi', () => ({
  createClient: vi.fn(),
  duplicateCheck: vi.fn(),
  fetchClientDetail: vi.fn(),
  updateClient: vi.fn(),
}))

const mockedFetchAdminUsers = vi.mocked(fetchAdminUsers)
const mockedFetchClientDetail = vi.mocked(fetchClientDetail)

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: 7,
    loginId: 'worker01',
    name: '김담당',
    phone: '010-1111-1111',
    positionName: '상담사',
    teamName: '정신건강팀',
    role: 'USER',
    status: 'ACTIVE',
    ...overrides,
  }
}

function createAuthValue(overrides?: Partial<MockAuthValue>): MockAuthValue {
  return {
    user: createUser(),
    initialized: true,
    login: mockLogin,
    logout: mockLogout,
    refresh: mockRefresh,
    ...overrides,
  }
}

function createClientDetail(overrides?: Partial<ClientDetail>): ClientDetail {
  return {
    id: 42,
    clientNo: 'CL-00042',
    name: '김대상',
    gender: 'MALE',
    birthDate: '1990-01-02',
    phone: '010-1111-2222',
    registeredAt: '2026-04-01T09:00:00',
    createdById: 7,
    createdByName: '김담당',
    primaryWorkerId: 7,
    primaryWorkerName: '김담당',
    status: 'ACTIVE',
    misregisteredAt: null,
    misregisteredById: null,
    misregisteredByName: null,
    misregisteredReason: null,
    recentSessions: [],
    ...overrides,
  }
}

function getSelectOptions(labelText: RegExp) {
  const select = screen.getByLabelText(labelText)

  return within(select).getAllByRole('option').map((option) => ({
    value: option.getAttribute('value'),
    label: option.textContent,
  }))
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockUseAuth.mockReset()
  mockedFetchAdminUsers.mockReset()
  mockedFetchClientDetail.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
  mockedFetchAdminUsers.mockResolvedValue({
    items: [],
    page: 1,
    size: 100,
    totalItems: 0,
    totalPages: 0,
  })
  mockedFetchClientDetail.mockResolvedValue(createClientDetail())
})

afterEach(() => {
  cleanup()
})

describe('client gender options', () => {
  it('keeps the existing gender option order and labels on the create form', () => {
    render(
      <MemoryRouter>
        <ClientCreatePage />
      </MemoryRouter>,
    )

    expect(getSelectOptions(/^성별/)).toEqual(EXPECTED_GENDER_OPTIONS)
  })

  it('keeps the existing gender option order and labels on the edit form', async () => {
    render(
      <MemoryRouter initialEntries={['/clients/42/edit']}>
        <Routes>
          <Route element={<ClientEditPage />} path="/clients/:clientId/edit" />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockedFetchClientDetail).toHaveBeenCalledWith(42)
    })

    await screen.findByLabelText(/^성별/)

    expect(getSelectOptions(/^성별/)).toEqual(EXPECTED_GENDER_OPTIONS)
  })
})
