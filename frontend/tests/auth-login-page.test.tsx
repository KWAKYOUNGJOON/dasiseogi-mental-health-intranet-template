import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { AuthUser } from '../src/features/auth/api/authApi'
import { AppRouter } from '../src/app/router/AppRouter'
import { LoginPage } from '../src/pages/auth/LoginPage'
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

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>대상자 목록 화면</div>,
}))

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: 1,
    loginId: 'usera',
    name: '일반 사용자',
    phone: '010-0000-0000',
    positionName: '상담사',
    teamName: '정신건강팀',
    role: 'USER',
    status: 'ACTIVE',
    ...overrides,
  }
}

function createGuestAuthValue(overrides?: Partial<MockAuthValue>): MockAuthValue {
  return {
    user: null,
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

function renderLoginPage(initialEntries: string[] = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoginPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createGuestAuthValue())
})

afterEach(() => {
  cleanup()
})

describe('auth login page', () => {
  it('renders the login page and keeps the signup request link', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeTruthy()
    expect(screen.getByLabelText('아이디')).toBeTruthy()
    expect(screen.getByLabelText('비밀번호')).toBeTruthy()

    const signupLink = screen.getByRole('link', { name: '회원가입 신청' })

    expect(signupLink).toBeTruthy()
    expect(signupLink.getAttribute('href')).toBe('/signup')
  })

  it('shows the signup requested notice from the query string', () => {
    renderLoginPage(['/login?notice=signup-requested'])

    expect(screen.getByText('가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.')).toBeTruthy()
  })

  it('blocks login requests and shows required field errors when inputs are empty', async () => {
    const user = userEvent.setup()

    renderLoginPage()

    const loginIdInput = screen.getByLabelText('아이디')
    const passwordInput = screen.getByLabelText('비밀번호')

    await user.clear(loginIdInput)
    await user.clear(passwordInput)
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(mockLogin).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    expect(screen.getByText('아이디를 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeTruthy()
  })

  it('updates the validation message as the user fixes each required field', async () => {
    const user = userEvent.setup()

    renderLoginPage()

    const loginIdInput = screen.getByLabelText('아이디')
    const passwordInput = screen.getByLabelText('비밀번호')

    await user.clear(loginIdInput)
    await user.clear(passwordInput)
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await user.type(loginIdInput, 'usera')

    await waitFor(() => {
      expect(screen.queryByText('아이디를 입력해주세요.')).toBeNull()
    })
    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')

    await user.type(passwordInput, 'Test1234!')

    await waitFor(() => {
      expect(screen.queryByText('비밀번호를 입력해주세요.')).toBeNull()
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the existing login submit behavior and prevents duplicate submits', async () => {
    const deferredLogin = createDeferredPromise<void>()
    const user = userEvent.setup()

    mockLogin.mockReturnValue(deferredLogin.promise)

    renderLoginPage()

    const loginIdInput = screen.getByLabelText('아이디')
    const passwordInput = screen.getByLabelText('비밀번호')

    await user.clear(loginIdInput)
    await user.type(loginIdInput, 'usera')
    await user.clear(passwordInput)
    await user.type(passwordInput, 'Test1234!')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('usera', 'Test1234!')
    })

    expect(screen.getByRole('button', { name: '로그인 중...' }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: '로그인 중...' }))
    expect(mockLogin).toHaveBeenCalledTimes(1)

    deferredLogin.resolve(undefined)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/clients')
    })
  })

  it('keeps the existing server failure message handling', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValue(
      createApiError({
        success: false,
        data: null,
        message: '아이디 또는 비밀번호를 확인해주세요.',
        errorCode: 'LOGIN_FAILED',
        fieldErrors: [],
      }),
    )

    renderLoginPage()
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('아이디 또는 비밀번호를 확인해주세요.')
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows the default failure message when the server message is missing', async () => {
    const user = userEvent.setup()

    mockLogin.mockRejectedValue(new Error('network'))

    renderLoginPage()
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('로그인에 실패했습니다.')
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('keeps GuestOnly redirect behavior for authenticated users', async () => {
    mockUseAuth.mockReturnValue(createGuestAuthValue({ user: createUser() }))

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByText('대상자 목록 화면')).toBeTruthy()
  })
})
