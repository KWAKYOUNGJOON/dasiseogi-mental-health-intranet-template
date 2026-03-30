import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'
import { MemoryRouter } from 'react-router-dom'
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

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>대상자 목록 화면</div>,
}))

import { AppRouter } from '../src/app/router/AppRouter'
import { LoginPage } from '../src/pages/auth/LoginPage'

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

function renderLoginPage() {
  return render(
    <MemoryRouter>
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

describe('auth login to signup navigation', () => {
  it('renders the signup request entry on the login page', () => {
    renderLoginPage()

    const signupLink = screen.getByRole('link', { name: '회원가입 신청' })

    expect(signupLink).toBeTruthy()
    expect(signupLink.getAttribute('href')).toBe('/signup')
    expect(screen.getByText('계정이 없으면 회원가입 신청 후 관리자 승인을 받아주세요.')).toBeTruthy()
  })

  it('navigates to /signup when the signup request link is clicked', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRouter />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: '회원가입 신청' }))

    expect(await screen.findByRole('heading', { name: '회원가입 신청' })).toBeTruthy()
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

  it('keeps the existing login submit behavior intact', async () => {
    const user = userEvent.setup()

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
    expect(mockNavigate).toHaveBeenCalledWith('/clients')
    expect(screen.queryByText('로그인에 실패했습니다.')).toBeNull()
  })

  it('preserves the login failure message handling', async () => {
    const user = userEvent.setup()
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      message: '아이디 또는 비밀번호를 확인해주세요.',
      errorCode: 'LOGIN_FAILED',
      fieldErrors: [],
    }

    mockLogin.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: response,
      },
    })

    renderLoginPage()

    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => {
      expect(screen.getByText('아이디 또는 비밀번호를 확인해주세요.')).toBeTruthy()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
