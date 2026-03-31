import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'

const mockFetchMeOrNull = vi.fn<() => Promise<AuthUser | null>>()
const mockLoginApi = vi.fn<(loginId: string, password: string) => Promise<{ sessionTimeoutMinutes: number; user: AuthUser }>>()
const mockLogoutApi = vi.fn<() => Promise<void>>()
const mockBeginAuthenticatedSession = vi.fn()
const mockEndAuthenticatedSession = vi.fn()

let sessionExpirationListener: (() => void) | undefined

vi.mock('../src/features/auth/api/authApi', () => ({
  fetchMeOrNull: () => mockFetchMeOrNull(),
  login: (loginId: string, password: string) => mockLoginApi(loginId, password),
  logout: () => mockLogoutApi(),
}))

vi.mock('../src/shared/api/interceptors', () => ({
  beginAuthenticatedSession: () => mockBeginAuthenticatedSession(),
  endAuthenticatedSession: () => mockEndAuthenticatedSession(),
  subscribeToSessionExpiration: (listener: () => void) => {
    sessionExpirationListener = listener

    return () => {
      if (sessionExpirationListener === listener) {
        sessionExpirationListener = undefined
      }
    }
  },
}))

import { AuthProvider, useAuth } from '../src/app/providers/AuthProvider'

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

function createRequestError(status: number) {
  return {
    isAxiosError: true,
    response: {
      status,
    },
  }
}

function AuthStateProbe() {
  const { authNotice, initialized, login, logout, refresh, status, user } = useAuth()

  return (
    <div>
      <div>{`initialized:${initialized ? 'yes' : 'no'}`}</div>
      <div>{`status:${status}`}</div>
      <div>{`notice:${authNotice ?? 'none'}`}</div>
      <div>{`user:${user?.loginId ?? 'guest'}`}</div>
      <button onClick={() => void login('usera', 'Test1234!')} type="button">
        login
      </button>
      <button onClick={() => void refresh()} type="button">
        refresh
      </button>
      <button onClick={() => void logout()} type="button">
        logout
      </button>
    </div>
  )
}

describe('auth provider', () => {
  beforeEach(() => {
    mockFetchMeOrNull.mockReset()
    mockLoginApi.mockReset()
    mockLogoutApi.mockReset()
    mockBeginAuthenticatedSession.mockReset()
    mockEndAuthenticatedSession.mockReset()
    sessionExpirationListener = undefined
    mockLoginApi.mockResolvedValue({
      sessionTimeoutMinutes: 30,
      user: createUser(),
    })
    mockLogoutApi.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('transitions to unauthenticated when the initial auth check resolves with no session user', async () => {
    mockFetchMeOrNull.mockResolvedValue(null)

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('status:loading')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('status:unauthenticated')).toBeTruthy()
    })

    expect(screen.getByText('initialized:yes')).toBeTruthy()
    expect(screen.getByText('notice:none')).toBeTruthy()
    expect(screen.getByText('user:guest')).toBeTruthy()
    expect(mockFetchMeOrNull).toHaveBeenCalledTimes(1)
  })

  it('keeps a distinct auth-check-error state when the initial auth check fails with 500', async () => {
    mockFetchMeOrNull.mockRejectedValue(createRequestError(500))

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:auth-check-error')).toBeTruthy()
    })

    expect(screen.queryByText('status:unauthenticated')).toBeNull()
    expect(screen.getByText('initialized:yes')).toBeTruthy()
  })

  it('keeps a distinct auth-check-error state when the initial auth check fails with a network error', async () => {
    mockFetchMeOrNull.mockRejectedValue(new Error('network'))

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:auth-check-error')).toBeTruthy()
    })

    expect(screen.queryByText('status:unauthenticated')).toBeNull()
    expect(screen.getByText('initialized:yes')).toBeTruthy()
  })

  it('updates the session user after a successful login', async () => {
    const user = userEvent.setup()

    mockFetchMeOrNull.mockResolvedValue(null)

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:unauthenticated')).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => {
      expect(screen.getByText('status:authenticated')).toBeTruthy()
    })

    expect(mockLoginApi).toHaveBeenCalledWith('usera', 'Test1234!')
    expect(screen.getByText('user:usera')).toBeTruthy()
  })

  it('clears the authenticated session and exposes a session-expired notice when a protected api request returns 401', async () => {
    mockFetchMeOrNull.mockResolvedValue(createUser())

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:authenticated')).toBeTruthy()
    })

    await act(async () => {
      sessionExpirationListener?.()
    })

    await waitFor(() => {
      expect(screen.getByText('status:unauthenticated')).toBeTruthy()
    })

    expect(screen.getByText('notice:session-expired')).toBeTruthy()
    expect(screen.getByText('user:guest')).toBeTruthy()
  })

  it('recovers from auth-check-error when retry succeeds', async () => {
    const user = userEvent.setup()

    mockFetchMeOrNull.mockRejectedValueOnce(createRequestError(500)).mockResolvedValueOnce(createUser())

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('status:auth-check-error')).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: 'refresh' }))

    await waitFor(() => {
      expect(screen.getByText('status:authenticated')).toBeTruthy()
    })

    expect(screen.getByText('user:usera')).toBeTruthy()
  })
})
