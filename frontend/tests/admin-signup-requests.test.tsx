import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockUseAuth = vi.fn()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/admin/api/signupRequestManagementApi', () => ({
  DEFAULT_SIGNUP_REQUEST_PAGE_SIZE: 20,
  SIGNUP_REQUEST_PAGE_SIZE_OPTIONS: [20, 50, 100],
  SIGNUP_REQUEST_STATUS_OPTIONS: ['PENDING', 'APPROVED', 'REJECTED'],
  fetchSignupRequestPage: vi.fn(),
  approveSignupRequest: vi.fn(),
  rejectSignupRequest: vi.fn(),
}))

vi.mock('../src/pages/clients/ClientListPage', () => ({
  ClientListPage: () => <div>대상자 목록 화면</div>,
}))

import { AppRouter } from '../src/app/router/AppRouter'
import { AdminSignupRequestsPage } from '../src/pages/admin/AdminSignupRequestsPage'
import {
  approveSignupRequest,
  fetchSignupRequestPage,
  rejectSignupRequest,
} from '../src/features/admin/api/signupRequestManagementApi'

const mockedFetchSignupRequestPage = vi.mocked(fetchSignupRequestPage)
const mockedApproveSignupRequest = vi.mocked(approveSignupRequest)
const mockedRejectSignupRequest = vi.mocked(rejectSignupRequest)

function createAdminUser(role: 'ADMIN' | 'USER' = 'ADMIN') {
  return {
    id: 1,
    loginId: role === 'ADMIN' ? 'admina' : 'usera',
    name: role === 'ADMIN' ? '관리자' : '일반 사용자',
    phone: '010-0000-0000',
    positionName: '팀원',
    teamName: '정신건강팀',
    role,
    status: 'ACTIVE' as const,
  }
}

function createSignupRequestItem(overrides?: Partial<Awaited<ReturnType<typeof fetchSignupRequestPage>>['items'][number]>) {
  return {
    id: 10,
    submittedAt: '2026-03-30 09:00',
    applicantName: '김지원',
    loginId: 'jwkim',
    contact: '010-2222-3333',
    positionOrRole: '사회복지사',
    teamName: '정신건강팀',
    requestNote: '신규 입사자 계정 요청',
    status: 'PENDING' as const,
    canProcess: true,
    ...overrides,
  }
}

function createSignupRequestPage(
  items: Array<ReturnType<typeof createSignupRequestItem>>,
  overrides?: Partial<Awaited<ReturnType<typeof fetchSignupRequestPage>>>,
) {
  return {
    items,
    page: 1,
    size: 20,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  }
}

function renderAdminSignupRequestsPage() {
  return render(
    <MemoryRouter>
      <AdminSignupRequestsPage />
    </MemoryRouter>,
  )
}

function createDeferredPromise<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void
  let rejectPromise!: (reason?: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  }
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: createAdminUser(),
    initialized: true,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  })
  mockedFetchSignupRequestPage.mockReset()
  mockedApproveSignupRequest.mockReset()
  mockedRejectSignupRequest.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('admin signup requests', () => {
  it('renders the signup request list with the default pending filter', async () => {
    mockedFetchSignupRequestPage.mockResolvedValue(createSignupRequestPage([createSignupRequestItem()]))

    renderAdminSignupRequestsPage()

    await waitFor(() => {
      expect(mockedFetchSignupRequestPage).toHaveBeenCalledWith({ status: 'PENDING', page: 1, size: 20 })
    })

    expect(screen.getByRole('heading', { name: '회원가입 승인' })).toBeTruthy()
    expect(screen.getByText('김지원')).toBeTruthy()
    expect(screen.getByText('jwkim')).toBeTruthy()
    expect(screen.getByText('신규 입사자 계정 요청')).toBeTruthy()
    const signupRequestRow = screen.getByText('jwkim').closest('tr')
    expect(signupRequestRow).toBeTruthy()
    expect(within(signupRequestRow as HTMLElement).getByText('승인 대기')).toBeTruthy()

    const statusSelect = screen.getByLabelText('상태') as HTMLSelectElement
    expect(
      Array.from(statusSelect.options).map((option) => ({
        label: option.text,
        value: option.value,
      })),
    ).toEqual([
      { label: '승인 대기', value: 'PENDING' },
      { label: '승인 완료', value: 'APPROVED' },
      { label: '반려', value: 'REJECTED' },
    ])
  })

  it('applies filters on search and restores defaults on reset', async () => {
    const user = userEvent.setup()

    mockedFetchSignupRequestPage.mockResolvedValue(createSignupRequestPage([createSignupRequestItem()]))

    renderAdminSignupRequestsPage()

    await screen.findByText('김지원')
    await user.selectOptions(screen.getByLabelText('상태'), 'APPROVED')
    await user.selectOptions(screen.getByLabelText('페이지 크기'), '50')
    await user.click(screen.getByRole('button', { name: '조회' }))

    await waitFor(() => {
      expect(mockedFetchSignupRequestPage).toHaveBeenLastCalledWith({ status: 'APPROVED', page: 1, size: 50 })
    })

    await user.click(screen.getByRole('button', { name: '초기화' }))

    await waitFor(() => {
      expect(mockedFetchSignupRequestPage).toHaveBeenLastCalledWith({ status: 'PENDING', page: 1, size: 20 })
    })
    expect((screen.getByLabelText('상태') as HTMLSelectElement).value).toBe('PENDING')
    expect((screen.getByLabelText('페이지 크기') as HTMLSelectElement).value).toBe('20')
  })

  it('keeps the pending signup request approval flow stable through processing lock and refreshed list state', async () => {
    const user = userEvent.setup()
    const deferredApproval = createDeferredPromise<{
      requestId: number
      userId: number
      requestStatus: 'APPROVED'
      userStatus: 'ACTIVE'
    }>()

    mockedFetchSignupRequestPage
      .mockResolvedValueOnce(createSignupRequestPage([createSignupRequestItem()]))
      .mockResolvedValueOnce(createSignupRequestPage([]))
    mockedApproveSignupRequest.mockReturnValueOnce(deferredApproval.promise)

    renderAdminSignupRequestsPage()

    const requestName = await screen.findByText('김지원')
    const requestRow = requestName.closest('tr')

    expect(requestRow).toBeTruthy()
    expect(within(requestRow as HTMLTableRowElement).getByText('승인 대기')).toBeTruthy()
    expect(mockedFetchSignupRequestPage).toHaveBeenCalledWith({ status: 'PENDING', page: 1, size: 20 })

    await user.click(within(requestRow as HTMLTableRowElement).getByRole('button', { name: '승인' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('처리 메모'), '승인 메모')
    await user.click(within(dialog).getByRole('button', { name: '승인' }))

    await waitFor(() => {
      expect(mockedApproveSignupRequest).toHaveBeenCalledTimes(1)
    })

    expect(mockedApproveSignupRequest).toHaveBeenCalledWith(10, { processNote: '승인 메모' })

    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: '처리 중...' }).hasAttribute('disabled')).toBe(true)
    })

    deferredApproval.resolve({
      requestId: 10,
      userId: 25,
      requestStatus: 'APPROVED',
      userStatus: 'ACTIVE',
    })

    await waitFor(() => {
      expect(mockedFetchSignupRequestPage).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByText('가입 신청을 승인했습니다.')).toBeTruthy()
    expect(screen.getByText('조건에 맞는 가입 신청이 없습니다.')).toBeTruthy()
    expect(screen.queryByText('김지원')).toBeNull()
    expect(screen.queryByRole('button', { name: '승인' })).toBeNull()
  })

  it('moves back to page 1 after rejection when the current page is not the first page', async () => {
    const user = userEvent.setup()

    mockedFetchSignupRequestPage
      .mockResolvedValueOnce(createSignupRequestPage([createSignupRequestItem()], { totalItems: 2, totalPages: 2 }))
      .mockResolvedValueOnce(createSignupRequestPage([createSignupRequestItem({ id: 11 })], { page: 2, totalItems: 2, totalPages: 2 }))
      .mockResolvedValueOnce(createSignupRequestPage([], { page: 1, totalItems: 0, totalPages: 0 }))
    mockedRejectSignupRequest.mockResolvedValue({
      requestId: 11,
      userId: 25,
      requestStatus: 'REJECTED',
      userStatus: 'REJECTED',
    })

    renderAdminSignupRequestsPage()

    await screen.findByText('김지원')
    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(await screen.findByText(/2\s*\/\s*2 페이지/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '반려' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('처리 메모'), '소속 확인 필요')
    await user.click(within(dialog).getByRole('button', { name: '반려' }))

    await waitFor(() => {
      expect(mockedRejectSignupRequest).toHaveBeenCalledWith(11, { processNote: '소속 확인 필요' })
    })
    await waitFor(() => {
      expect(mockedFetchSignupRequestPage).toHaveBeenLastCalledWith({ status: 'PENDING', page: 1, size: 20 })
    })

    expect(await screen.findByText(/1\s*\/\s*1 페이지/)).toBeTruthy()
  })

  it('shows a representative server error message and retries the list request', async () => {
    const user = userEvent.setup()

    mockedFetchSignupRequestPage
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            data: null,
            message: '관리자 권한이 필요합니다.',
            errorCode: 'FORBIDDEN',
            fieldErrors: [],
          },
        },
      })
      .mockResolvedValueOnce(createSignupRequestPage([createSignupRequestItem({ id: 12, applicantName: '박서연' })]))

    renderAdminSignupRequestsPage()

    expect(await screen.findByText('관리자 권한이 필요합니다.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => {
      expect(mockedFetchSignupRequestPage).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('박서연')).toBeTruthy()
  })

  it('shows a processed error message when the request was already handled elsewhere', async () => {
    const user = userEvent.setup()

    mockedFetchSignupRequestPage
      .mockResolvedValueOnce(createSignupRequestPage([createSignupRequestItem()]))
      .mockResolvedValueOnce(createSignupRequestPage([]))
    mockedApproveSignupRequest.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          success: false,
          data: null,
          message: '이미 처리된 가입 신청입니다.',
          errorCode: 'SIGNUP_REQUEST_ALREADY_PROCESSED',
          fieldErrors: [],
        },
      },
    })

    renderAdminSignupRequestsPage()

    await user.click(await screen.findByRole('button', { name: '승인' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }))

    await waitFor(() => {
      expect(mockedApproveSignupRequest).toHaveBeenCalledWith(10, { processNote: '' })
    })

    expect(await screen.findByText('이미 처리된 가입 신청입니다.')).toBeTruthy()
    expect(screen.getByText('조건에 맞는 가입 신청이 없습니다.')).toBeTruthy()
  })

  it('shows an empty state when there are no matching signup requests', async () => {
    mockedFetchSignupRequestPage.mockResolvedValue(createSignupRequestPage([]))

    renderAdminSignupRequestsPage()

    expect(await screen.findByText('조건에 맞는 가입 신청이 없습니다.')).toBeTruthy()
  })

  it('blocks non-admin users from accessing the approval page', async () => {
    mockUseAuth.mockReturnValue({
      user: createAdminUser('USER'),
      initialized: true,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin/signup-requests']}>
        <AppRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByText('대상자 목록 화면')).toBeTruthy()
    expect(mockedFetchSignupRequestPage).not.toHaveBeenCalled()
  })
})
