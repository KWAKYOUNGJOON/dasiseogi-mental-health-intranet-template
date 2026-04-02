import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ClientCreatePage } from '../src/pages/clients/ClientCreatePage'
import type { AuthUser } from '../src/features/auth/api/authApi'
import { createClient, duplicateCheck } from '../src/features/clients/api/clientApi'
import type { ApiResponse } from '../src/shared/types/api'

interface MockAuthValue {
  user: AuthUser | null
  initialized: boolean
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

interface DeferredPromise<T> {
  promise: Promise<T>
  reject: (reason?: unknown) => void
  resolve: (value: T) => void
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

vi.mock('../src/features/clients/api/clientApi', () => ({
  createClient: vi.fn(),
  duplicateCheck: vi.fn(),
}))

const mockedCreateClient = vi.mocked(createClient)
const mockedDuplicateCheck = vi.mocked(duplicateCheck)

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: 7,
    loginId: 'usera',
    name: '김담당',
    phone: '010-0000-0000',
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

function createDeferredPromise<T>(): DeferredPromise<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, reject, resolve }
}

function createApiError(response: ApiResponse<null>) {
  return {
    isAxiosError: true,
    response: {
      data: response,
    },
  }
}

function renderClientCreatePage() {
  return render(
    <MemoryRouter>
      <ClientCreatePage />
    </MemoryRouter>,
  )
}

async function fillClientCreateForm(user: ReturnType<typeof userEvent.setup>, overrides?: { phone?: string }) {
  await user.type(screen.getByLabelText(/^이름/), '김대상')
  await user.type(screen.getByLabelText(/^생년월일/), '1990-01-02')

  if (overrides?.phone) {
    await user.type(screen.getByLabelText(/^연락처/), overrides.phone)
  }
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockedCreateClient.mockReset()
  mockedDuplicateCheck.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
})

afterEach(() => {
  cleanup()
})

describe('client create page', () => {
  it('renders the thin page shell with the client create form fields', () => {
    renderClientCreatePage()

    expect(screen.getByRole('heading', { name: '대상자 등록' })).toBeTruthy()
    expect(screen.getByLabelText(/^이름/)).toBeTruthy()
    expect(screen.getByLabelText(/^성별/)).toBeTruthy()
    expect(screen.getByLabelText(/^생년월일/)).toBeTruthy()
    expect(screen.getByLabelText(/^연락처/)).toBeTruthy()
    expect((screen.getByLabelText(/^담당자/) as HTMLInputElement).value).toBe('김담당')
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy()
  })

  it('navigates to the client list without calling apis when cancel is clicked', async () => {
    const user = userEvent.setup()

    renderClientCreatePage()

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(mockNavigate).toHaveBeenCalledWith('/clients')
    expect(mockedCreateClient).not.toHaveBeenCalled()
    expect(mockedDuplicateCheck).not.toHaveBeenCalled()
  })

  it('blocks submit when required values are missing or the phone format is invalid', async () => {
    const user = userEvent.setup()

    renderClientCreatePage()

    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(mockedCreateClient).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    expect(screen.getByText('이름을 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('생년월일을 입력해주세요.')).toBeTruthy()

    await user.type(screen.getByLabelText(/^이름/), '김대상')
    await user.type(screen.getByLabelText(/^생년월일/), '1990-01-02')
    await user.type(screen.getByLabelText(/^연락처/), '01012')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(mockedCreateClient).not.toHaveBeenCalled()
    expect(screen.getByText('연락처 형식을 확인해주세요.')).toBeTruthy()
  })

  it('renders duplicate candidates with the existing warning message', async () => {
    const user = userEvent.setup()

    mockedDuplicateCheck.mockResolvedValue({
      isDuplicate: true,
      candidates: [
        {
          id: 11,
          clientNo: 'CL-00011',
          name: '김대상',
          birthDate: '1990-01-02',
          gender: 'MALE',
          primaryWorkerName: '기존 담당자',
          status: 'ACTIVE',
        },
        {
          id: 12,
          clientNo: 'CL-00012',
          name: '김대상',
          birthDate: '1990-01-02',
          gender: 'FEMALE',
          primaryWorkerName: '오등록 담당자',
          status: 'MISREGISTERED',
        },
      ],
    })

    renderClientCreatePage()
    await fillClientCreateForm(user)
    await user.click(screen.getByRole('button', { name: '중복 확인' }))

    await waitFor(() => {
      expect(mockedDuplicateCheck).toHaveBeenCalledWith({
        name: '김대상',
        birthDate: '1990-01-02',
      })
    })

    expect(screen.getByText('동일 이름/생년월일 대상자가 이미 있습니다. 계속 등록할 수 있습니다.')).toBeTruthy()
    const duplicateCandidateTable = screen.getByRole('table', { name: '중복 후보 목록' })
    const tableScope = within(duplicateCandidateTable)

    expect(tableScope.getByRole('columnheader', { name: '사례번호' })).toBeTruthy()
    expect(tableScope.getByRole('columnheader', { name: '담당자' })).toBeTruthy()
    expect(tableScope.getByText('CL-00011')).toBeTruthy()
    expect(tableScope.getByText('기존 담당자')).toBeTruthy()
    expect(tableScope.getByText('활성')).toBeTruthy()
    expect(tableScope.getByText('CL-00012')).toBeTruthy()
    expect(tableScope.getByText('오등록 담당자')).toBeTruthy()
    expect(tableScope.getByText('오등록')).toBeTruthy()
  })

  it('hides the duplicate candidate list when the duplicate check has no matches', async () => {
    const user = userEvent.setup()

    mockedDuplicateCheck.mockResolvedValue({
      isDuplicate: false,
      candidates: [],
    })

    renderClientCreatePage()
    await fillClientCreateForm(user)
    await user.click(screen.getByRole('button', { name: '중복 확인' }))

    await waitFor(() => {
      expect(mockedDuplicateCheck).toHaveBeenCalledWith({
        name: '김대상',
        birthDate: '1990-01-02',
      })
    })

    expect(screen.getByText('중복 후보가 없습니다.')).toBeTruthy()
    expect(screen.queryByRole('table', { name: '중복 후보 목록' })).toBeNull()
  })

  it('clears the previous duplicate candidates when the identifying fields change and checks again', async () => {
    const user = userEvent.setup()

    mockedDuplicateCheck.mockResolvedValueOnce({
      isDuplicate: true,
      candidates: [
        {
          id: 11,
          clientNo: 'CL-00011',
          name: '김대상',
          birthDate: '1990-01-02',
          gender: 'MALE',
          primaryWorkerName: '기존 담당자',
          status: 'ACTIVE',
        },
      ],
    })
    mockedDuplicateCheck.mockResolvedValueOnce({
      isDuplicate: false,
      candidates: [],
    })

    renderClientCreatePage()
    await fillClientCreateForm(user)
    await user.click(screen.getByRole('button', { name: '중복 확인' }))

    await waitFor(() => {
      expect(screen.getByText('CL-00011')).toBeTruthy()
    })

    await user.clear(screen.getByLabelText(/^이름/))
    await user.type(screen.getByLabelText(/^이름/), '이새대상')

    expect(screen.queryByText('CL-00011')).toBeNull()
    expect(screen.queryByRole('table', { name: '중복 후보 목록' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '중복 확인' }))

    await waitFor(() => {
      expect(mockedDuplicateCheck).toHaveBeenLastCalledWith({
        name: '이새대상',
        birthDate: '1990-01-02',
      })
    })

    expect(screen.getByText('중복 후보가 없습니다.')).toBeTruthy()
    expect(screen.queryByText('CL-00011')).toBeNull()
  })

  it('submits once and keeps the existing success navigation', async () => {
    const deferredCreate = createDeferredPromise<{ clientNo: string; id: number }>()
    const user = userEvent.setup()

    mockedDuplicateCheck.mockResolvedValue({
      isDuplicate: true,
      candidates: [
        {
          id: 11,
          clientNo: 'CL-00011',
          name: '김대상',
          birthDate: '1990-01-02',
          gender: 'MALE',
          primaryWorkerName: '기존 담당자',
          status: 'ACTIVE',
        },
      ],
    })
    mockedCreateClient.mockReturnValue(deferredCreate.promise)

    renderClientCreatePage()
    await fillClientCreateForm(user, { phone: '010-1111-2222' })
    await user.click(screen.getByRole('button', { name: '중복 확인' }))

    await waitFor(() => {
      expect(screen.getByText('동일 이름/생년월일 대상자가 이미 있습니다. 계속 등록할 수 있습니다.')).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockedCreateClient).toHaveBeenCalledWith({
        name: '김대상',
        gender: 'MALE',
        birthDate: '1990-01-02',
        phone: '010-1111-2222',
        primaryWorkerId: 7,
      })
    })

    expect(screen.getByRole('button', { name: '저장 중...' }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: '저장 중...' }))
    expect(mockedCreateClient).toHaveBeenCalledTimes(1)

    deferredCreate.resolve({
      id: 42,
      clientNo: 'CL-00042',
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/clients/42')
    })
  })

  it('maps server fieldErrors and shows the representative error message', async () => {
    const user = userEvent.setup()

    mockedCreateClient.mockRejectedValue(
      createApiError({
        success: false,
        data: null,
        message: '입력값을 다시 확인해주세요.',
        errorCode: 'VALIDATION_ERROR',
        fieldErrors: [
          { field: 'phone', reason: '연락처 형식을 확인해주세요.' },
          { field: 'birthDate', reason: '생년월일을 다시 확인해주세요.' },
        ],
      }),
    )

    renderClientCreatePage()
    await fillClientCreateForm(user, { phone: '010-1111-2222' })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    })

    const phoneInput = screen.getByLabelText(/^연락처/)
    const phoneError = screen.getByText('연락처 형식을 확인해주세요.')

    expect(phoneInput.getAttribute('aria-invalid')).toBe('true')
    expect(phoneInput.getAttribute('aria-describedby')).toContain(phoneError.id)
    expect(screen.getByText('생년월일을 다시 확인해주세요.')).toBeTruthy()
  })
})
