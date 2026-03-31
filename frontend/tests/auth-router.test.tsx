import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'

type MockAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'auth-check-error'

interface MockAuthValue {
  authNotice?: 'session-expired' | null
  user: AuthUser | null
  initialized: boolean
  status?: MockAuthStatus
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

interface DeferredPromise<T> {
  promise: Promise<T>
  reject: (reason?: unknown) => void
  resolve: (value: T) => void
}

const mockUseAuth = vi.fn<() => MockAuthValue>()
const mockLogin = vi.fn<(loginId: string, password: string) => Promise<void>>()
const mockLogout = vi.fn<() => Promise<void>>()
const mockRefresh = vi.fn<() => Promise<void>>()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/pages/auth/LoginPage', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    LoginPage: () => {
      const location = actual.useLocation()
      return <div>{`로그인 페이지${location.search}`}</div>
    },
  }
})

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>보호된 화면</div>,
}))

import { AppRouter } from '../src/app/router/AppRouter'

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

function createDeferredPromise<T>(): DeferredPromise<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, reject, resolve }
}

function createAuthValue(overrides?: Partial<MockAuthValue>): MockAuthValue {
  return {
    authNotice: null,
    user: null,
    initialized: true,
    status: 'unauthenticated',
    login: mockLogin,
    logout: mockLogout,
    refresh: mockRefresh,
    ...overrides,
  }
}

function renderRouter(initialEntries: string[] = ['/clients']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppRouter />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockUseAuth.mockReset()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('auth router', () => {
  it('shows the loading screen while auth initialization is still in progress', () => {
    mockUseAuth.mockReturnValue(
      createAuthValue({
        initialized: false,
        status: 'loading',
      }),
    )

    renderRouter()

    expect(screen.getByText('초기화 중...')).toBeTruthy()
  })

  it('renders protected routes when the session is authenticated', async () => {
    mockUseAuth.mockReturnValue(
      createAuthValue({
        user: createUser(),
        status: 'authenticated',
      }),
    )

    renderRouter()

    expect(await screen.findByText('보호된 화면')).toBeTruthy()
  })

  it('redirects unauthenticated protected routes to the login page', async () => {
    mockUseAuth.mockReturnValue(
      createAuthValue({
        user: null,
        status: 'unauthenticated',
      }),
    )

    renderRouter()

    expect(await screen.findByText('로그인 페이지')).toBeTruthy()
  })

  it('redirects session-expired protected routes to the login page with a dedicated notice query string', async () => {
    mockUseAuth.mockReturnValue(
      createAuthValue({
        authNotice: 'session-expired',
        user: null,
        status: 'unauthenticated',
      }),
    )

    renderRouter()

    expect(await screen.findByText('로그인 페이지?notice=session-expired')).toBeTruthy()
  })

  it('keeps the auth-check-error screen instead of redirecting to login, and allows retry', async () => {
    const deferredRefresh = createDeferredPromise<void>()
    const user = userEvent.setup()

    mockRefresh.mockReturnValue(deferredRefresh.promise)
    mockUseAuth.mockReturnValue(
      createAuthValue({
        user: null,
        status: 'auth-check-error',
      }),
    )

    renderRouter()

    expect(screen.getByRole('alert').textContent).toBe('처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    expect(screen.queryByText('로그인 페이지')).toBeNull()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: '다시 시도 중...' }).hasAttribute('disabled')).toBe(true)

    deferredRefresh.resolve(undefined)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    })
  })
})
