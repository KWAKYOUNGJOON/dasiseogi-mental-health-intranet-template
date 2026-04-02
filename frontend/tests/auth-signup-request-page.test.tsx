import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from '../src/app/router/AppRouter'
import { createSignupRequest, type CreateSignupRequestResponse } from '../src/features/auth/api/signupRequestApi'
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

const mockLogin = vi.fn<(loginId: string, password: string) => Promise<void>>()
const mockLogout = vi.fn<() => Promise<void>>()
const mockRefresh = vi.fn<() => Promise<void>>()
const mockUseAuth = vi.fn<() => MockAuthValue>()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/auth/api/signupRequestApi', () => ({
  createSignupRequest: vi.fn(),
}))

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>대상자 목록 화면</div>,
}))

const mockedCreateSignupRequest = vi.mocked(createSignupRequest)

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

function renderSignupRequestPage(initialEntries: string[] = ['/signup']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppRouter />
    </MemoryRouter>,
  )
}

async function fillSignupRequestForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^이름/), '김지원')
  await user.type(screen.getByLabelText(/^아이디/), 'jwkim')
  await user.type(screen.getByLabelText(/^비밀번호/, { selector: 'input#signup-request-password' }), 'Test1234!')
  await user.type(screen.getByLabelText(/^비밀번호 확인/, { selector: 'input#signup-request-passwordConfirm' }), 'Test1234!')
  await user.type(screen.getByLabelText(/^연락처/), '01022223333')
  await user.type(screen.getByLabelText(/^직책 또는 역할/), '사회복지사')
  await user.type(screen.getByLabelText(/^소속 팀/), '정신건강팀')
  await user.type(screen.getByLabelText(/^가입 신청 메모/), '신규 입사자 계정 요청')
}

beforeEach(() => {
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockedCreateSignupRequest.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createGuestAuthValue())
})

afterEach(() => {
  cleanup()
})

describe('auth signup request page', () => {
  it('renders the signup request form and login return entry', () => {
    renderSignupRequestPage()

    expect(screen.getByRole('heading', { name: '회원가입 신청' })).toBeTruthy()
    expect(screen.getByLabelText(/^이름/)).toBeTruthy()
    expect(screen.getByLabelText(/^아이디/)).toBeTruthy()
    expect(screen.getByLabelText(/^비밀번호/, { selector: 'input#signup-request-password' })).toBeTruthy()
    expect(screen.getByLabelText(/^비밀번호 확인/, { selector: 'input#signup-request-passwordConfirm' })).toBeTruthy()
    expect(screen.getByLabelText(/^연락처/)).toBeTruthy()
    expect(screen.getByLabelText(/^직책 또는 역할/)).toBeTruthy()
    expect(screen.getByLabelText(/^소속 팀/)).toBeTruthy()
    expect(screen.getByLabelText(/^가입 신청 메모/)).toBeTruthy()
    expect(document.querySelectorAll('.field-required-mark')).toHaveLength(7)
    expect((screen.getByLabelText(/^이름/) as HTMLInputElement).required).toBe(true)
    expect((screen.getByLabelText(/^가입 신청 메모/) as HTMLTextAreaElement).required).toBe(false)
    expect(screen.getByRole('link', { name: '로그인으로 돌아가기' }).getAttribute('href')).toBe('/login')
  })

  it('keeps GuestOnly redirect behavior when an authenticated user opens /signup', async () => {
    mockUseAuth.mockReturnValue(createGuestAuthValue({ user: createUser() }))

    renderSignupRequestPage()

    expect(await screen.findByText('대상자 목록 화면')).toBeTruthy()
    expect(mockedCreateSignupRequest).not.toHaveBeenCalled()
  })

  it('shows immediate client validation errors when required values are missing', async () => {
    const user = userEvent.setup()

    renderSignupRequestPage()

    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    expect(mockedCreateSignupRequest).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    expect(screen.getByText('이름을 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('아이디를 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('비밀번호 확인을 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('연락처를 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('직책 또는 역할을 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('소속 팀을 입력해주세요.')).toBeTruthy()
  })

  it('prevents submission and shows a clear message when password confirmation does not match', async () => {
    const user = userEvent.setup()

    renderSignupRequestPage()

    await user.type(screen.getByLabelText(/^이름/), '김지원')
    await user.type(screen.getByLabelText(/^아이디/), 'jwkim')
    await user.type(screen.getByLabelText(/^비밀번호/, { selector: 'input#signup-request-password' }), 'Test1234!')
    await user.type(screen.getByLabelText(/^비밀번호 확인/, { selector: 'input#signup-request-passwordConfirm' }), 'Test9999!')
    await user.type(screen.getByLabelText(/^연락처/), '01022223333')
    await user.type(screen.getByLabelText(/^직책 또는 역할/), '사회복지사')
    await user.type(screen.getByLabelText(/^소속 팀/), '정신건강팀')

    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    expect(mockedCreateSignupRequest).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeTruthy()
  })

  it('toggles password visibility for each password field', async () => {
    const user = userEvent.setup()

    renderSignupRequestPage()

    const passwordInput = screen.getByLabelText(/^비밀번호/, {
      selector: 'input#signup-request-password',
    }) as HTMLInputElement
    const passwordConfirmInput = screen.getByLabelText(/^비밀번호 확인/, {
      selector: 'input#signup-request-passwordConfirm',
    }) as HTMLInputElement

    expect(passwordInput.type).toBe('password')
    expect(passwordConfirmInput.type).toBe('password')

    await user.click(screen.getByRole('button', { name: '비밀번호 보기' }))
    expect(passwordInput.type).toBe('text')
    expect(passwordConfirmInput.type).toBe('password')

    await user.click(screen.getByRole('button', { name: '비밀번호 확인 보기' }))
    expect(passwordConfirmInput.type).toBe('text')

    await user.click(screen.getByRole('button', { name: '비밀번호 숨기기' }))
    await user.click(screen.getByRole('button', { name: '비밀번호 확인 숨기기' }))
    expect(passwordInput.type).toBe('password')
    expect(passwordConfirmInput.type).toBe('password')
  })

  it('formats the phone number as the user types and strips non-digit characters', async () => {
    const user = userEvent.setup()

    renderSignupRequestPage()

    const phoneInput = screen.getByLabelText(/^연락처/) as HTMLInputElement

    await user.type(phoneInput, '010abc2222!3333')

    expect(phoneInput.value).toBe('010-2222-3333')
  })

  it('formats 02 phone numbers with a natural domestic pattern', async () => {
    const user = userEvent.setup()

    renderSignupRequestPage()

    const phoneInput = screen.getByLabelText(/^연락처/) as HTMLInputElement

    await user.type(phoneInput, '0212345678')

    expect(phoneInput.value).toBe('02-1234-5678')
  })

  it('submits once and returns to /login?notice=signup-requested after success', async () => {
    const deferredRequest = createDeferredPromise<CreateSignupRequestResponse>()
    const user = userEvent.setup()

    mockedCreateSignupRequest.mockReturnValue(deferredRequest.promise)

    renderSignupRequestPage()
    await fillSignupRequestForm(user)

    const submitButton = screen.getByRole('button', { name: '가입 신청' })

    await user.click(submitButton)

    await waitFor(() => {
      expect(mockedCreateSignupRequest).toHaveBeenCalledWith({
        name: '김지원',
        loginId: 'jwkim',
        password: 'Test1234!',
        phone: '010-2222-3333',
        positionName: '사회복지사',
        teamName: '정신건강팀',
        requestMemo: '신규 입사자 계정 요청',
      })
    })

    expect(screen.getByRole('button', { name: '신청 중...' }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: '신청 중...' }))
    expect(mockedCreateSignupRequest).toHaveBeenCalledTimes(1)

    deferredRequest.resolve({
      requestId: 10,
      userId: 25,
      requestStatus: 'PENDING',
    })

    expect(await screen.findByText('가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy()
  }, 10000)

  it('maps server fieldErrors to matching inputs and shows the validation summary', async () => {
    const user = userEvent.setup()

    mockedCreateSignupRequest.mockRejectedValue(
      createApiError({
        success: false,
        data: null,
        message: '요청이 올바르지 않습니다.',
        errorCode: 'VALIDATION_ERROR',
        fieldErrors: [
          { field: 'loginId', reason: '이미 사용 중인 아이디입니다.' },
          { field: 'teamName', reason: '소속 팀을 다시 확인해주세요.' },
        ],
      }),
    )

    renderSignupRequestPage()
    await fillSignupRequestForm(user)
    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    })

    const loginIdInput = screen.getByLabelText(/^아이디/)
    const loginIdError = screen.getByText('이미 사용 중인 아이디입니다.')

    expect(loginIdInput.getAttribute('aria-invalid')).toBe('true')
    expect(loginIdInput.getAttribute('aria-describedby')).toContain(loginIdError.id)
    expect(screen.getByText('소속 팀을 다시 확인해주세요.')).toBeTruthy()
  }, 10000)

  it('shows duplicate login guidance for duplicate-family errors', async () => {
    const user = userEvent.setup()

    mockedCreateSignupRequest.mockRejectedValue(
      createApiError({
        success: false,
        data: null,
        message: null,
        errorCode: 'LOGIN_ID_DUPLICATED',
        fieldErrors: [],
      }),
    )

    renderSignupRequestPage()
    await fillSignupRequestForm(user)
    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('이미 사용 중인 아이디입니다.')
    })
    expect(screen.getAllByText('이미 사용 중인 아이디입니다.')).toHaveLength(2)
  })

  it('shows a generic failure message for unknown server errors', async () => {
    const user = userEvent.setup()

    mockedCreateSignupRequest.mockRejectedValue(
      createApiError({
        success: false,
        data: null,
        message: null,
        errorCode: 'UNEXPECTED_ERROR',
        fieldErrors: [],
      }),
    )

    renderSignupRequestPage()
    await fillSignupRequestForm(user)
    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('회원가입 신청에 실패했습니다. 잠시 후 다시 시도해주세요.')
    })
  })
})
