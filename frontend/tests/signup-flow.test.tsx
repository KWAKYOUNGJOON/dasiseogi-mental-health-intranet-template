import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from '../src/app/router/AppRouter'
import { createSignupRequest } from '../src/features/auth/api/signupRequestApi'
import { SignupRequestForm } from '../src/features/auth/components/SignupRequestForm'

const mockUseAuth = vi.fn()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/auth/api/signupRequestApi', () => ({
  createSignupRequest: vi.fn(),
}))

const mockedCreateSignupRequest = vi.mocked(createSignupRequest)

function renderSignupRequestForm() {
  return render(
    <MemoryRouter>
      <SignupRequestForm />
    </MemoryRouter>,
  )
}

async function fillSignupRequestForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^이름/), '김지원')
  await user.type(screen.getByLabelText(/아이디/), 'jwkim')
  await user.type(screen.getByLabelText(/비밀번호/), 'Test1234!')
  await user.type(screen.getByLabelText(/^연락처/), '010-2222-3333')
  await user.type(screen.getByLabelText(/^직책/), '사회복지사')
  await user.type(screen.getByLabelText(/^소속 팀/), '정신건강팀')
  await user.type(screen.getByLabelText(/가입 신청 메모/), '신규 입사자 계정 요청')
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: null,
    initialized: true,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  })
  mockedCreateSignupRequest.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('signup flow', () => {
  it('navigates to /signup from the login page', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRouter />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: '회원가입 신청' }))

    expect(screen.getByRole('heading', { name: '회원가입 신청' })).toBeTruthy()
  })

  it('shows validation errors when required fields are empty', async () => {
    const user = userEvent.setup()

    renderSignupRequestForm()

    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    expect(mockedCreateSignupRequest).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    expect(screen.getByText('이름을 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('아이디를 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('비밀번호를 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('연락처를 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('직책을 입력해주세요.')).toBeTruthy()
    expect(screen.getByText('소속 팀을 입력해주세요.')).toBeTruthy()
  })

  it('submits the signup request and shows a success message', async () => {
    const user = userEvent.setup()
    mockedCreateSignupRequest.mockResolvedValue({
      requestId: 10,
      userId: 25,
      requestStatus: 'PENDING',
    })

    renderSignupRequestForm()
    await fillSignupRequestForm(user)
    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    await waitFor(() => {
      expect(mockedCreateSignupRequest).toHaveBeenCalledTimes(1)
    })

    expect(mockedCreateSignupRequest).toHaveBeenCalledWith({
      name: '김지원',
      loginId: 'jwkim',
      password: 'Test1234!',
      phone: '010-2222-3333',
      positionName: '사회복지사',
      teamName: '정신건강팀',
      requestMemo: '신규 입사자 계정 요청',
    })
    expect(screen.getByRole('heading', { name: '회원가입 신청 완료' })).toBeTruthy()
    expect(screen.getByText('가입 신청이 접수되었습니다. 관리자 승인 후 로그인 가능합니다.')).toBeTruthy()
    expect(screen.getByRole('link', { name: '로그인 화면으로 이동' })).toBeTruthy()
  })

  it('maps server fieldErrors to the related fields', async () => {
    const user = userEvent.setup()
    mockedCreateSignupRequest.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          success: false,
          data: null,
          message: '입력값을 다시 확인해주세요.',
          errorCode: 'VALIDATION_ERROR',
          fieldErrors: [
            { field: 'loginId', reason: '이미 사용 중인 아이디입니다.' },
            { field: 'teamName', reason: '소속 팀을 다시 확인해주세요.' },
          ],
        },
      },
    })

    renderSignupRequestForm()
    await fillSignupRequestForm(user)
    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('입력값을 다시 확인해주세요.')
    })

    expect(screen.getByText('이미 사용 중인 아이디입니다.')).toBeTruthy()
    expect(screen.getByText('소속 팀을 다시 확인해주세요.')).toBeTruthy()
  })

  it('shows a representative top-level error message for server business errors', async () => {
    const user = userEvent.setup()
    mockedCreateSignupRequest.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          success: false,
          data: null,
          message: '이미 사용 중인 아이디입니다.',
          errorCode: 'LOGIN_ID_DUPLICATED',
          fieldErrors: [],
        },
      },
    })

    renderSignupRequestForm()
    await fillSignupRequestForm(user)
    await user.click(screen.getByRole('button', { name: '가입 신청' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('이미 사용 중인 아이디입니다.')
    })
  })
})
