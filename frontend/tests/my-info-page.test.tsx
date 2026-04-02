import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'
import type { ApiResponse } from '../src/shared/types/api'

interface MockAuthValue {
  user: AuthUser | null
  initialized: boolean
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const mockLogin = vi.fn<(loginId: string, password: string) => Promise<void>>()
const mockLogout = vi.fn<() => Promise<void>>()
const mockRefresh = vi.fn<() => Promise<void>>()
const mockUseAuth = vi.fn<() => MockAuthValue>()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/auth/api/authApi', () => ({
  updateMyProfile: vi.fn(),
}))

import { updateMyProfile } from '../src/features/auth/api/authApi'
import { MyInfoPage } from '../src/pages/account/MyInfoPage'

const mockedUpdateMyProfile = vi.mocked(updateMyProfile)

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: 7,
    loginId: 'usera',
    name: '김지원',
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

function createApiError(response: ApiResponse<null>) {
  return {
    isAxiosError: true,
    response: {
      data: response,
    },
  }
}

beforeEach(() => {
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockUseAuth.mockReset()
  mockedUpdateMyProfile.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
})

afterEach(() => {
  cleanup()
})

describe('my info page', () => {
  it('renders the current user information and keeps protected fields read-only', () => {
    render(<MyInfoPage />)

    expect(screen.getByRole('heading', { name: '내 정보' })).toBeTruthy()
    expect((screen.getByLabelText('아이디') as HTMLInputElement).value).toBe('usera')
    expect((screen.getByLabelText('권한') as HTMLInputElement).value).toBe('일반 사용자')
    expect((screen.getByLabelText('계정 상태') as HTMLInputElement).value).toBe('활성')
    expect((screen.getByLabelText(/^이름/) as HTMLInputElement).value).toBe('김지원')
    expect((screen.getByLabelText(/^직책 또는 역할/) as HTMLInputElement).value).toBe('상담사')
    expect((screen.getByLabelText(/^소속 팀/) as HTMLInputElement).value).toBe('정신건강팀')
  })

  it('submits the whitelisted fields only and shows a success message', async () => {
    const user = userEvent.setup()

    mockedUpdateMyProfile.mockResolvedValue(
      createUser({
        name: '김지원 수정',
        phone: '010-9999-8888',
        positionName: '선임 상담사',
        teamName: '통합지원팀',
      }),
    )

    render(<MyInfoPage />)

    const nameInput = screen.getByLabelText(/^이름/) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/^연락처/) as HTMLInputElement
    const positionInput = screen.getByLabelText(/^직책 또는 역할/) as HTMLInputElement
    const teamInput = screen.getByLabelText(/^소속 팀/) as HTMLInputElement

    await user.clear(nameInput)
    await user.type(nameInput, '김지원 수정')
    await user.clear(phoneInput)
    await user.type(phoneInput, '01099998888')
    await user.clear(positionInput)
    await user.type(positionInput, '선임 상담사')
    await user.clear(teamInput)
    await user.type(teamInput, '통합지원팀')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockedUpdateMyProfile).toHaveBeenCalledWith({
        name: '김지원 수정',
        phone: '010-9999-8888',
        positionName: '선임 상담사',
        teamName: '통합지원팀',
      })
    })

    expect(phoneInput.value).toBe('010-9999-8888')
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText('회원정보가 수정되었습니다.')).toBeTruthy()
  })

  it('blocks submit when the required name is missing or the phone format is invalid', async () => {
    const user = userEvent.setup()

    render(<MyInfoPage />)

    await user.clear(screen.getByLabelText(/^이름/))
    await user.clear(screen.getByLabelText(/^연락처/))
    await user.type(screen.getByLabelText(/^연락처/), '01012')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(mockedUpdateMyProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    expect(screen.getByText('이름을 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('연락처 형식을 확인해주세요.')).toBeTruthy()
  })

  it('maps server field errors onto the matching inputs', async () => {
    const user = userEvent.setup()

    mockedUpdateMyProfile.mockRejectedValue(
      createApiError({
        success: false,
        data: null,
        message: '입력값을 다시 확인해주세요.',
        errorCode: 'VALIDATION_ERROR',
        fieldErrors: [
          { field: 'phone', reason: '연락처 형식을 확인해주세요.' },
          { field: 'teamName', reason: '소속 팀은 100자 이하로 입력해주세요.' },
        ],
      }),
    )

    render(<MyInfoPage />)

    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    })

    expect(screen.getByLabelText(/^연락처/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('연락처 형식을 확인해주세요.')).toBeTruthy()
    expect(screen.getByText('소속 팀은 100자 이하로 입력해주세요.')).toBeTruthy()
  })
})
