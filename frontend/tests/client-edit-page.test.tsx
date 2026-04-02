import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ClientEditPage } from '../src/pages/clients/ClientEditPage'
import type { AuthUser } from '../src/features/auth/api/authApi'
import { fetchAdminUsers } from '../src/features/admin/api/adminApi'
import { fetchClientDetail, updateClient, type ClientDetail } from '../src/features/clients/api/clientApi'
import type { ApiResponse } from '../src/shared/types/api'

interface MockAuthValue {
  user: AuthUser | null
  initialized: boolean
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

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
const mockedUpdateClient = vi.mocked(updateClient)

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: 1,
    loginId: 'admin01',
    name: '관리자',
    phone: '010-0000-0000',
    positionName: '팀장',
    teamName: '정신건강팀',
    role: 'ADMIN',
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

function createApiError(response: ApiResponse<null>) {
  return {
    isAxiosError: true,
    response: {
      data: response,
    },
  }
}

function renderClientEditPage() {
  return render(
    <MemoryRouter initialEntries={['/clients/42/edit']}>
      <Routes>
        <Route element={<ClientEditPage />} path="/clients/:clientId/edit" />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockUseAuth.mockReset()
  mockedFetchAdminUsers.mockReset()
  mockedFetchClientDetail.mockReset()
  mockedUpdateClient.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
  mockedFetchClientDetail.mockResolvedValue(createClientDetail())
  mockedFetchAdminUsers.mockResolvedValue({
    items: [
      {
        userId: 7,
        name: '김담당',
        loginId: 'worker01',
        phone: '010-1111-1111',
        role: 'USER',
        status: 'ACTIVE',
        approvedAt: '2026-03-01T09:00:00',
        lastLoginAt: '2026-04-01T08:30:00',
      },
      {
        userId: 8,
        name: '이담당',
        loginId: 'worker02',
        phone: '010-2222-2222',
        role: 'USER',
        status: 'ACTIVE',
        approvedAt: '2026-03-01T09:00:00',
        lastLoginAt: '2026-04-01T08:40:00',
      },
    ],
    page: 1,
    size: 100,
    totalItems: 2,
    totalPages: 1,
  })
})

afterEach(() => {
  cleanup()
})

describe('client edit page', () => {
  it('renders the edit form with the existing client values', async () => {
    renderClientEditPage()

    await waitFor(() => {
      expect(mockedFetchClientDetail).toHaveBeenCalledWith(42)
    })

    expect(screen.getByRole('heading', { name: '대상자 정보 수정' })).toBeTruthy()
    expect((screen.getByLabelText(/^이름/) as HTMLInputElement).value).toBe('김대상')
    expect((screen.getByLabelText(/^성별/) as HTMLSelectElement).value).toBe('MALE')
    expect((screen.getByLabelText(/^생년월일/) as HTMLInputElement).value).toBe('1990-01-02')
    expect((screen.getByLabelText(/^연락처/) as HTMLInputElement).value).toBe('010-1111-2222')
    expect((screen.getByLabelText(/^담당자/) as HTMLSelectElement).value).toBe('7')
  })

  it('shows field-level validation errors under the inputs when required values are missing or invalid', async () => {
    const user = userEvent.setup()

    renderClientEditPage()

    const nameInput = (await screen.findByLabelText(/^이름/)) as HTMLInputElement
    const birthDateInput = screen.getByLabelText(/^생년월일/) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/^연락처/) as HTMLInputElement

    await user.clear(nameInput)
    await user.clear(birthDateInput)
    await user.clear(phoneInput)
    await user.type(phoneInput, '01012')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(mockedUpdateClient).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')

    const nameError = screen.getByText('이름을 입력해주세요.')
    const birthDateError = screen.getByText('생년월일을 입력해주세요.')
    const phoneError = screen.getByText('연락처 형식을 확인해주세요.')

    expect(nameInput.getAttribute('aria-invalid')).toBe('true')
    expect(nameInput.getAttribute('aria-describedby')).toContain(nameError.id)
    expect(birthDateInput.getAttribute('aria-invalid')).toBe('true')
    expect(birthDateInput.getAttribute('aria-describedby')).toContain(birthDateError.id)
    expect(phoneInput.getAttribute('aria-invalid')).toBe('true')
    expect(phoneInput.getAttribute('aria-describedby')).toContain(phoneError.id)
  })

  it('maps server fieldErrors to the matching inputs and clears a field error when that value changes', async () => {
    const user = userEvent.setup()

    mockedUpdateClient.mockRejectedValueOnce(
      createApiError({
        success: false,
        data: null,
        message: '입력값을 다시 확인해주세요.',
        errorCode: 'VALIDATION_ERROR',
        fieldErrors: [
          { field: 'name', reason: '이름을 입력해주세요.' },
          { field: 'gender', reason: '성별을 다시 확인해주세요.' },
          { field: 'birthDate', reason: '생년월일 형식을 다시 확인해주세요.' },
          { field: 'phone', reason: '연락처 형식을 확인해주세요.' },
          { field: 'primaryWorkerId', reason: '담당자를 선택해주세요.' },
        ],
      }),
    )

    renderClientEditPage()

    const nameInput = (await screen.findByLabelText(/^이름/)) as HTMLInputElement
    const genderSelect = screen.getByLabelText(/^성별/) as HTMLSelectElement
    const birthDateInput = screen.getByLabelText(/^생년월일/) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/^연락처/) as HTMLInputElement
    const primaryWorkerSelect = screen.getByLabelText(/^담당자/) as HTMLSelectElement

    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    })

    const nameError = screen.getByText('이름을 입력해주세요.')
    const genderError = screen.getByText('성별을 다시 확인해주세요.')
    const birthDateError = screen.getByText('생년월일 형식을 다시 확인해주세요.')
    const phoneError = screen.getByText('연락처 형식을 확인해주세요.')
    const primaryWorkerError = screen.getByText('담당자를 선택해주세요.')

    expect(nameInput.getAttribute('aria-invalid')).toBe('true')
    expect(nameInput.getAttribute('aria-describedby')).toContain(nameError.id)
    expect(genderSelect.getAttribute('aria-invalid')).toBe('true')
    expect(genderSelect.getAttribute('aria-describedby')).toContain(genderError.id)
    expect(birthDateInput.getAttribute('aria-invalid')).toBe('true')
    expect(birthDateInput.getAttribute('aria-describedby')).toContain(birthDateError.id)
    expect(phoneInput.getAttribute('aria-invalid')).toBe('true')
    expect(phoneInput.getAttribute('aria-describedby')).toContain(phoneError.id)
    expect(primaryWorkerSelect.getAttribute('aria-invalid')).toBe('true')
    expect(primaryWorkerSelect.getAttribute('aria-describedby')).toContain(primaryWorkerError.id)

    await user.clear(phoneInput)
    await user.type(phoneInput, '010-9999-8888')

    expect(screen.queryByText('연락처 형식을 확인해주세요.')).toBeNull()
    expect(phoneInput.getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByText('이름을 입력해주세요.')).toBeTruthy()
  })

  it('keeps the existing success navigation after saving', async () => {
    const user = userEvent.setup()

    mockedUpdateClient.mockResolvedValue(
      createClientDetail({
        name: '김대상 수정',
        phone: '010-9999-8888',
        primaryWorkerId: 8,
        primaryWorkerName: '이담당',
      }),
    )

    renderClientEditPage()

    const nameInput = (await screen.findByLabelText(/^이름/)) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/^연락처/) as HTMLInputElement
    const primaryWorkerSelect = screen.getByLabelText(/^담당자/) as HTMLSelectElement

    await user.clear(nameInput)
    await user.type(nameInput, '김대상 수정')
    await user.clear(phoneInput)
    await user.type(phoneInput, '010-9999-8888')
    await user.selectOptions(primaryWorkerSelect, '8')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockedUpdateClient).toHaveBeenCalledWith(42, {
        name: '김대상 수정',
        gender: 'MALE',
        birthDate: '1990-01-02',
        phone: '010-9999-8888',
        primaryWorkerId: 8,
      })
    })

    expect(mockNavigate).toHaveBeenCalledWith('/clients/42')
  })
})
