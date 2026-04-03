import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'
import {
  fetchSessionDetail,
  markSessionMisentered,
  type SessionDetail,
} from '../src/features/assessment/api/assessmentApi'
import { AssessmentSessionDetailPage } from '../src/pages/assessment/AssessmentSessionDetailPage'

const mockUseAuth = vi.fn<() => { user: AuthUser | null }>()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/assessment/api/assessmentApi', () => ({
  fetchSessionDetail: vi.fn(),
  markSessionMisentered: vi.fn(),
}))

const mockedFetchSessionDetail = vi.mocked(fetchSessionDetail)
const mockedMarkSessionMisentered = vi.mocked(markSessionMisentered)

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

function createSessionDetail(overrides?: Partial<SessionDetail>): SessionDetail {
  return {
    id: 501,
    sessionNo: 'AS-20260331-0001',
    status: 'COMPLETED',
    sessionDate: '2026-03-31',
    sessionStartedAt: '2026-03-31T09:00:00',
    sessionCompletedAt: '2026-03-31T09:20:00',
    performedById: 7,
    performedByName: '김담당',
    clientId: 42,
    clientNo: 'CL-00042',
    clientName: '김대상',
    clientBirthDate: '1990-01-02',
    clientGender: 'MALE',
    memo: '세션 참고 메모',
    misenteredAt: null,
    misenteredById: null,
    misenteredByName: null,
    misenteredReason: null,
    hasAlert: true,
    scales: [
      {
        sessionScaleId: 9001,
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        displayOrder: 1,
        totalScore: 8,
        resultLevel: '중등도',
        hasAlert: false,
        answers: [
          {
            questionNo: 1,
            questionKey: 'q1',
            questionText: '기분이 가라앉거나 우울했다.',
            answerValue: '2',
            answerLabel: '절반 이상',
            scoreValue: 2,
          },
        ],
        alerts: [],
      },
      {
        sessionScaleId: 9002,
        scaleCode: 'GAD7',
        scaleName: 'GAD-7',
        displayOrder: 2,
        totalScore: 11,
        resultLevel: '고위험',
        hasAlert: true,
        answers: [
          {
            questionNo: 1,
            questionKey: 'q1',
            questionText: '최근 2주 동안 불안했다.',
            answerValue: '3',
            answerLabel: '거의 매일',
            scoreValue: 3,
          },
        ],
        alerts: [
          {
            id: 3001,
            scaleCode: 'GAD7',
            alertType: 'HIGH_RISK',
            alertCode: 'GAD7_HIGH_RISK',
            alertMessage: '불안 수준 확인 필요',
            questionNo: null,
            triggerValue: null,
          },
        ],
      },
    ],
    alerts: [
      {
        id: 3001,
        scaleCode: 'GAD7',
        alertType: 'HIGH_RISK',
        alertCode: 'GAD7_HIGH_RISK',
        alertMessage: '불안 수준 확인 필요',
        questionNo: null,
        triggerValue: null,
      },
    ],
    ...overrides,
  }
}

function createAxiosError(options: {
  status: number
  errorCode: string
  message: string
}) {
  return {
    isAxiosError: true,
    response: {
      status: options.status,
      data: {
        success: false,
        data: null,
        message: options.message,
        errorCode: options.errorCode,
        fieldErrors: [],
      },
    },
  }
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

function renderAssessmentSessionDetailPage(initialEntry = '/assessments/sessions/501') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/assessment-records" element={<div>검사기록 목록 화면</div>} />
        <Route path="/assessments/sessions/:sessionId" element={<AssessmentSessionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetchSessionDetail.mockReset()
  mockedMarkSessionMisentered.mockReset()
  mockedFetchSessionDetail.mockResolvedValue(createSessionDetail())
  mockedMarkSessionMisentered.mockResolvedValue({
    sessionId: 501,
    status: 'MISENTERED',
    misenteredAt: '2026-03-31T10:00:00',
  })
  mockUseAuth.mockReset()
  mockUseAuth.mockReturnValue({ user: createUser() })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('assessment session detail page', () => {
  it('renders the session detail view with session info, memo, alerts, and answers', async () => {
    renderAssessmentSessionDetailPage()

    expect(await screen.findByRole('heading', { name: '세션 상세' })).toBeTruthy()
    expect(screen.getByText('AS-20260331-0001')).toBeTruthy()
    expect(screen.getByText('CL-00042')).toBeTruthy()
    expect(screen.getByText('김대상')).toBeTruthy()
    expect(screen.getByText('세션 참고 메모')).toBeTruthy()
    expect(screen.getAllByText('불안 수준 확인 필요').length).toBeGreaterThan(0)
    expect(screen.getByText('최근 2주 동안 불안했다.')).toBeTruthy()
    expect(screen.getByText('2026-03-31 09:20:00')).toBeTruthy()
    expect(screen.queryByText('2026-03-31T09:20:00')).toBeNull()
  })

  it('keeps the requested highlightScaleCode emphasis on the matching scale card', async () => {
    renderAssessmentSessionDetailPage('/assessments/sessions/501?highlightScaleCode=GAD7')

    const highlightedCard = await screen.findByTestId('session-scale-GAD7')
    const normalCard = screen.getByTestId('session-scale-PHQ9')

    expect(highlightedCard.getAttribute('data-highlighted')).toBe('true')
    expect(normalCard.getAttribute('data-highlighted')).toBe('false')
  })

  it('uses the provided assessment record return path when it is valid', async () => {
    renderAssessmentSessionDetailPage(
      '/assessments/sessions/501?highlightScaleCode=GAD7&returnTo=%2Fassessment-records%3FclientName%3D%EA%B9%80%EB%8C%80%EC%83%81%26page%3D2',
    )

    const backLink = await screen.findByRole('link', { name: '검사기록 목록으로 돌아가기' })

    expect(backLink.getAttribute('href')).toBe('/assessment-records?clientName=김대상&page=2')
  })

  it('falls back to the default assessment record list path for direct entry or invalid returnTo values', async () => {
    renderAssessmentSessionDetailPage('/assessments/sessions/501?returnTo=%2Fclients%3Fpage%3D2')

    const backLink = await screen.findByRole('link', { name: '검사기록 목록으로 돌아가기' })

    expect(backLink.getAttribute('href')).toBe('/assessment-records')
  })

  it('shows a differentiated error state when session detail loading fails', async () => {
    mockedFetchSessionDetail.mockRejectedValueOnce(
      createAxiosError({
        status: 404,
        errorCode: 'SESSION_NOT_FOUND',
        message: '요청한 세션을 찾을 수 없습니다.',
      }),
    )

    renderAssessmentSessionDetailPage()

    expect(await screen.findByText('세션을 찾을 수 없습니다.')).toBeTruthy()
    expect(screen.getByText('요청한 세션을 찾을 수 없습니다.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('recovers after retrying the session detail request', async () => {
    const user = userEvent.setup()

    mockedFetchSessionDetail
      .mockRejectedValueOnce(
        createAxiosError({
          status: 500,
          errorCode: 'UNEXPECTED_ERROR',
          message: '세션 상세 조회 실패',
        }),
      )
      .mockResolvedValueOnce(createSessionDetail())

    renderAssessmentSessionDetailPage()

    expect(await screen.findByText('세션 상세를 불러오지 못했습니다.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('세션 참고 메모')).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByText('세션 상세를 불러오지 못했습니다.')).toBeNull()
    })
  })

  it('shows the misentered action button for the session author', async () => {
    renderAssessmentSessionDetailPage()

    expect(await screen.findByRole('button', { name: '오입력 처리' })).toBeTruthy()
  })

  it('shows the misentered action button for an admin even when not the author', async () => {
    mockUseAuth.mockReturnValue({
      user: createUser({
        id: 99,
        role: 'ADMIN',
        name: '관리자',
      }),
    })
    mockedFetchSessionDetail.mockResolvedValueOnce(createSessionDetail({ performedById: 7 }))

    renderAssessmentSessionDetailPage()

    expect(await screen.findByRole('button', { name: '오입력 처리' })).toBeTruthy()
  })

  it('hides the misentered action button for a non-author regular user', async () => {
    mockUseAuth.mockReturnValue({
      user: createUser({
        id: 99,
        role: 'USER',
      }),
    })
    mockedFetchSessionDetail.mockResolvedValueOnce(createSessionDetail({ performedById: 7 }))

    renderAssessmentSessionDetailPage()

    await screen.findByText('김대상')
    expect(screen.queryByRole('button', { name: '오입력 처리' })).toBeNull()
  })

  it('blocks misentered confirmation when the reason contains only whitespace', async () => {
    const user = userEvent.setup()

    renderAssessmentSessionDetailPage()

    await user.click(await screen.findByRole('button', { name: '오입력 처리' }))

    const dialog = screen.getByRole('dialog')
    const reasonField = within(dialog).getByRole('textbox')
    const confirmButton = within(dialog).getByRole('button', { name: '오입력 처리' })

    await user.type(reasonField, '   ')

    expect(confirmButton.hasAttribute('disabled')).toBe(true)
  })

  it('prevents duplicate misentered requests while processing is in progress', async () => {
    const user = userEvent.setup()
    const deferred = createDeferredPromise<{
      sessionId: number
      status: string
      misenteredAt: string
    }>()

    mockedFetchSessionDetail
      .mockResolvedValueOnce(createSessionDetail())
      .mockResolvedValueOnce(
        createSessionDetail({
          status: 'MISENTERED',
          misenteredAt: '2026-03-31T10:00:00',
          misenteredById: 7,
          misenteredByName: '김담당',
          misenteredReason: '중복 입력',
        }),
      )
    mockedMarkSessionMisentered.mockReturnValueOnce(deferred.promise)

    renderAssessmentSessionDetailPage()

    await user.click(await screen.findByRole('button', { name: '오입력 처리' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox'), '중복 입력')
    await user.click(within(dialog).getByRole('button', { name: '오입력 처리' }))

    await waitFor(() => {
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: '처리 중...' }).hasAttribute('disabled')).toBe(true)
    })

    expect(mockedMarkSessionMisentered).toHaveBeenCalledTimes(1)

    deferred.resolve({
      sessionId: 501,
      status: 'MISENTERED',
      misenteredAt: '2026-03-31T10:00:00',
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('refreshes the detail view and reflects MISENTERED metadata after a successful action', async () => {
    const user = userEvent.setup()

    mockedFetchSessionDetail
      .mockResolvedValueOnce(createSessionDetail())
      .mockResolvedValueOnce(
        createSessionDetail({
          status: 'MISENTERED',
          misenteredAt: '2026-03-31T10:05:00',
          misenteredById: 7,
          misenteredByName: '김담당',
          misenteredReason: '잘못된 대상자 입력',
        }),
      )

    renderAssessmentSessionDetailPage()

    await user.click(await screen.findByRole('button', { name: '오입력 처리' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox'), '잘못된 대상자 입력')
    await user.click(within(dialog).getByRole('button', { name: '오입력 처리' }))

    expect(await screen.findByText('오입력 처리되었습니다.')).toBeTruthy()
    expect(screen.getByText('MISENTERED')).toBeTruthy()
    expect(screen.getByText('2026-03-31 10:05:00')).toBeTruthy()
    expect(screen.getAllByText('김담당').length).toBeGreaterThan(0)
    expect(screen.getByText('잘못된 대상자 입력')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: '오입력 처리' })).toBeNull()
  })

  it('does not show the misentered action button when the session is already MISENTERED', async () => {
    mockedFetchSessionDetail.mockResolvedValueOnce(
      createSessionDetail({
        status: 'MISENTERED',
        misenteredAt: '2026-03-31T10:05:00',
        misenteredById: 7,
        misenteredByName: '김담당',
        misenteredReason: '기존 오입력 사유',
      }),
    )

    renderAssessmentSessionDetailPage()

    expect(await screen.findByText('기존 오입력 사유')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '오입력 처리' })).toBeNull()
  })

  it('opens the print view route from the detail page only after the session is loaded', async () => {
    const user = userEvent.setup()
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderAssessmentSessionDetailPage()

    await user.click(await screen.findByRole('button', { name: '출력' }))

    expect(windowOpenSpy).toHaveBeenCalledWith(
      '/assessments/sessions/501/print',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('keeps the screen stable when the server reports SESSION_ALREADY_MISENTERED', async () => {
    const user = userEvent.setup()

    mockedFetchSessionDetail
      .mockResolvedValueOnce(createSessionDetail())
      .mockResolvedValueOnce(
        createSessionDetail({
          status: 'MISENTERED',
          misenteredAt: '2026-03-31T10:07:00',
          misenteredById: 7,
          misenteredByName: '김담당',
          misenteredReason: '이미 처리됨',
        }),
      )
    mockedMarkSessionMisentered.mockRejectedValueOnce(
      createAxiosError({
        status: 409,
        errorCode: 'SESSION_ALREADY_MISENTERED',
        message: '이 세션은 이미 오입력 처리되었습니다.',
      }),
    )

    renderAssessmentSessionDetailPage()

    await user.click(await screen.findByRole('button', { name: '오입력 처리' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox'), '이미 처리된 사유')
    await user.click(within(dialog).getByRole('button', { name: '오입력 처리' }))

    expect(await screen.findByText('이 세션은 이미 오입력 처리되었습니다.')).toBeTruthy()
    expect(screen.getByText('이미 처리됨')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: '오입력 처리' })).toBeNull()
  })
})
