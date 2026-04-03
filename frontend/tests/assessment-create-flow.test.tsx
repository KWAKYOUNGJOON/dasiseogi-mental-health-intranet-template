import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from '../src/app/router/AppRouter'
import type { AuthUser } from '../src/features/auth/api/authApi'
import {
  createAssessmentSession,
  fetchScaleDetail,
  fetchScales,
  fetchSessionDetail,
  fetchSessionPrintData,
  markSessionMisentered,
  type ScaleDetail,
  type ScaleListItem,
  type SessionDetail,
  type SessionPrintData,
} from '../src/features/assessment/api/assessmentApi'
import { useAssessmentDraftStore } from '../src/features/assessment/store/assessmentDraftStore'
import {
  fetchClientDetail,
  fetchClients,
  markClientMisregistered,
  type ClientDetail,
  type ClientListPage,
} from '../src/features/clients/api/clientApi'

interface MockAuthValue {
  authNotice?: 'session-expired' | null
  user: AuthUser | null
  initialized: boolean
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'auth-check-error'
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

vi.mock('../src/features/clients/api/clientApi', () => ({
  createClient: vi.fn(),
  duplicateCheck: vi.fn(),
  fetchClientDetail: vi.fn(),
  fetchClients: vi.fn(),
  markClientMisregistered: vi.fn(),
  updateClient: vi.fn(),
}))

vi.mock('../src/features/assessment/api/assessmentApi', () => ({
  createAssessmentSession: vi.fn(),
  fetchAssessmentRecords: vi.fn(),
  fetchScaleDetail: vi.fn(),
  fetchScales: vi.fn(),
  fetchSessionDetail: vi.fn(),
  fetchSessionPrintData: vi.fn(),
  markSessionMisentered: vi.fn(),
}))

const mockedCreateAssessmentSession = vi.mocked(createAssessmentSession)
const mockedFetchClientDetail = vi.mocked(fetchClientDetail)
const mockedFetchClients = vi.mocked(fetchClients)
const mockedFetchScaleDetail = vi.mocked(fetchScaleDetail)
const mockedFetchScales = vi.mocked(fetchScales)
const mockedFetchSessionDetail = vi.mocked(fetchSessionDetail)
const mockedFetchSessionPrintData = vi.mocked(fetchSessionPrintData)
const mockedMarkSessionMisentered = vi.mocked(markSessionMisentered)
const mockedMarkClientMisregistered = vi.mocked(markClientMisregistered)

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
    authNotice: null,
    user: createUser(),
    initialized: true,
    status: 'authenticated',
    login: mockLogin,
    logout: mockLogout,
    refresh: mockRefresh,
    ...overrides,
  }
}

function createClientListPage(
  items: ClientListPage['items'],
  overrides?: Partial<ClientListPage>,
): ClientListPage {
  return {
    items,
    page: 1,
    size: 20,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  }
}

function createClientDetail(overrides?: Partial<ClientDetail>): ClientDetail {
  return {
    id: 42,
    clientNo: 'CL-00042',
    name: '김대상',
    gender: 'MALE',
    birthDate: '1990-01-02',
    phone: '010-1111-2222',
    registeredAt: '2026-03-31T09:00:00',
    createdById: 7,
    createdByName: '김담당',
    primaryWorkerId: 7,
    primaryWorkerName: '김담당',
    status: 'ACTIVE',
    misregisteredAt: null,
    misregisteredById: null,
    misregisteredByName: null,
    misregisteredReason: null,
    recentSessions: [],
    ...overrides,
  }
}

function createScaleListItem(overrides?: Partial<ScaleListItem>): ScaleListItem {
  return {
    scaleCode: 'PHQ9',
    scaleName: 'PHQ-9',
    displayOrder: 1,
    isActive: true,
    implemented: true,
    ...overrides,
  }
}

function createScaleDetail(overrides?: Partial<ScaleDetail>): ScaleDetail {
  return {
    scaleCode: 'PHQ9',
    scaleName: 'PHQ-9',
    displayOrder: 1,
    questionCount: 2,
    screeningThreshold: null,
    questions: [
      {
        questionNo: 1,
        questionKey: 'phq9_q1',
        questionText: '기분이 가라앉거나 우울감을 느꼈다.',
        reverseScored: false,
        options: [
          { value: '0', label: '전혀 아니다', score: 0 },
          { value: '1', label: '며칠 동안', score: 1 },
        ],
      },
      {
        questionNo: 2,
        questionKey: 'phq9_q2',
        questionText: '흥미나 즐거움이 줄어들었다.',
        reverseScored: false,
        options: [
          { value: '0', label: '전혀 아니다', score: 0 },
          { value: '2', label: '절반 이상', score: 2 },
        ],
      },
    ],
    ...overrides,
  }
}

function createSessionDetail(overrides?: Partial<SessionDetail>): SessionDetail {
  return {
    id: 901,
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
    memo: '핵심 저장 흐름 회귀',
    misenteredAt: null,
    misenteredById: null,
    misenteredByName: null,
    misenteredReason: null,
    hasAlert: false,
    scales: [
      {
        sessionScaleId: 9101,
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        displayOrder: 1,
        totalScore: 3,
        resultLevel: '경도',
        hasAlert: false,
        answers: [
          {
            questionNo: 1,
            questionKey: 'phq9_q1',
            questionText: '기분이 가라앉거나 우울감을 느꼈다.',
            answerValue: '1',
            answerLabel: '며칠 동안',
            scoreValue: 1,
          },
          {
            questionNo: 2,
            questionKey: 'phq9_q2',
            questionText: '흥미나 즐거움이 줄어들었다.',
            answerValue: '2',
            answerLabel: '절반 이상',
            scoreValue: 2,
          },
        ],
        alerts: [],
      },
    ],
    alerts: [],
    ...overrides,
  }
}

function createSessionPrintData(overrides?: Partial<SessionPrintData>): SessionPrintData {
  return {
    institutionName: '다시서기 정신건강 평가관리 시스템',
    teamName: '정신건강팀',
    performedByName: '김담당',
    sessionNo: 'AS-20260331-0001',
    sessionStartedAt: '2026-03-31T09:00:00',
    sessionCompletedAt: '2026-03-31T09:20:00',
    client: {
      clientId: 42,
      clientNo: 'CL-00042',
      name: '김대상',
      birthDate: '1990-01-02',
      gender: 'MALE',
    },
    scales: [
      {
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        totalScore: 3,
        resultLevel: '경도',
        alertMessages: [],
      },
    ],
    hasAlert: false,
    scaleCount: 1,
    alertCount: 0,
    summaryText: '총 1개 척도 결과, 경고 없음.',
    ...overrides,
  }
}

function LocationDisplay({ onChange }: { onChange: (locationText: string) => void }) {
  const location = useLocation()
  const locationText = `${location.pathname}${location.search}`

  useEffect(() => {
    onChange(locationText)
  }, [locationText, onChange])

  return <div data-testid="location-display">{locationText}</div>
}

function renderAssessmentCreateFlow(initialEntry = '/clients') {
  return renderAssessmentCreateFlowWithLocationHistory(initialEntry)
}

function renderAssessmentCreateFlowWithLocationHistory(initialEntry = '/clients') {
  const locationHistory: string[] = []
  const view = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay onChange={(locationText) => locationHistory.push(locationText)} />
      <AppRouter />
    </MemoryRouter>,
  )

  return {
    ...view,
    locationHistory,
  }
}

function selectAnswer(questionText: string, answerLabel: string) {
  const questionTitle = screen.getByText(questionText)
  const questionFieldset = questionTitle.closest('fieldset')

  if (!questionFieldset) {
    throw new Error(`Question fieldset not found for: ${questionText}`)
  }

  return within(questionFieldset).getByRole('radio', { name: answerLabel })
}

beforeEach(() => {
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockUseAuth.mockReset()
  mockedCreateAssessmentSession.mockReset()
  mockedFetchClientDetail.mockReset()
  mockedFetchClients.mockReset()
  mockedFetchScaleDetail.mockReset()
  mockedFetchScales.mockReset()
  mockedFetchSessionDetail.mockReset()
  mockedFetchSessionPrintData.mockReset()
  mockedMarkSessionMisentered.mockReset()
  mockedMarkClientMisregistered.mockReset()
  useAssessmentDraftStore.getState().reset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
  mockedFetchClients.mockResolvedValue(
    createClientListPage([
      {
        id: 42,
        clientNo: 'CL-00042',
        name: '김대상',
        birthDate: '1990-01-02',
        gender: 'MALE',
        primaryWorkerName: '김담당',
        latestSessionDate: null,
        status: 'ACTIVE',
      },
    ]),
  )
  mockedFetchClientDetail.mockResolvedValue(createClientDetail())
  mockedFetchScales.mockResolvedValue([
    createScaleListItem(),
    createScaleListItem({
      scaleCode: 'GAD7',
      scaleName: 'GAD-7',
      displayOrder: 2,
    }),
  ])
  mockedFetchScaleDetail.mockImplementation(async (scaleCode) => {
    if (scaleCode === 'PHQ9') {
      return createScaleDetail()
    }

    if (scaleCode === 'GAD7') {
      return createScaleDetail({
        scaleCode: 'GAD7',
        scaleName: 'GAD-7',
        displayOrder: 2,
        questionCount: 1,
        questions: [
          {
            questionNo: 1,
            questionKey: 'gad7_q1',
            questionText: '불안하거나 초조했다.',
            reverseScored: false,
            options: [
              { value: '0', label: '전혀 아니다', score: 0 },
              { value: '1', label: '며칠 동안', score: 1 },
            ],
          },
        ],
      })
    }

    throw new Error(`Unexpected scale code: ${scaleCode}`)
  })
  mockedCreateAssessmentSession.mockResolvedValue({
    sessionId: 901,
    sessionNo: 'AS-20260331-0001',
    clientId: 42,
    status: 'COMPLETED',
    scaleCount: 1,
    hasAlert: false,
  })
  mockedFetchSessionDetail.mockResolvedValue(createSessionDetail())
  mockedFetchSessionPrintData.mockResolvedValue(createSessionPrintData())
  mockedMarkSessionMisentered.mockResolvedValue({
    sessionId: 901,
    status: 'MISENTERED',
    misenteredAt: '2026-03-31T10:05:00',
  })
})

afterEach(() => {
  useAssessmentDraftStore.getState().reset()
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('assessment create flow regression', () => {
  it('keeps the saved session detail connected to a successful misentered action for the session author', async () => {
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

    renderAssessmentCreateFlow()

    expect(await screen.findByRole('heading', { level: 2, name: '대상자 목록' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: '상세보기' }))

    expect(await screen.findByRole('heading', { level: 2, name: '김대상 상세' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: '검사 시작' }))

    expect(await screen.findByRole('heading', { level: 2, name: '척도 선택' })).toBeTruthy()
    await user.click(screen.getByRole('checkbox', { name: /PHQ-9/ }))
    await user.click(screen.getByRole('button', { name: '검사 시작' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'PHQ-9 입력' })).toBeTruthy()
    await user.click(selectAnswer('기분이 가라앉거나 우울감을 느꼈다.', '며칠 동안'))
    await user.click(selectAnswer('흥미나 즐거움이 줄어들었다.', '절반 이상'))
    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(await screen.findByRole('heading', { level: 2, name: '세션 요약' })).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: /세션 메모/ }), '오입력 처리 연결 회귀')
    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    const misenteredButton = await screen.findByRole('button', { name: '오입력 처리' })

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/assessments/sessions/901')
    })
    expect(mockedFetchSessionDetail).toHaveBeenCalledWith(901, undefined)

    await user.click(misenteredButton)

    const dialog = await screen.findByRole('dialog')
    const reasonField = within(dialog).getByRole('textbox')

    expect(within(dialog).getByText('세션 오입력 처리')).toBeTruthy()
    expect(within(dialog).getByText('세션과 하위 결과는 유지한 채 상태만 MISENTERED로 변경합니다.')).toBeTruthy()

    await user.type(reasonField, '잘못된 대상자 입력')
    await user.click(within(dialog).getByRole('button', { name: '오입력 처리' }))

    await waitFor(() => {
      expect(mockedMarkSessionMisentered).toHaveBeenCalledTimes(1)
    })

    expect(mockedMarkSessionMisentered).toHaveBeenCalledWith(901, '잘못된 대상자 입력')

    await waitFor(() => {
      expect(mockedFetchSessionDetail).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByText('오입력 처리되었습니다.')).toBeTruthy()
    expect(screen.getByText('MISENTERED')).toBeTruthy()
    expect(screen.getByText('잘못된 대상자 입력')).toBeTruthy()
    expect(screen.getByText('2026-03-31 10:05:00')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '오입력 처리' })).toBeNull()
  })

  it('keeps the PHQ-9 flow stable through saved session detail notice dismissal and print entry', async () => {
    const user = userEvent.setup()
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const originalSetTimeout = window.setTimeout.bind(window)
    const scheduledDismissCallbacks = new Map<number, () => void>()
    let nextTimeoutId = 1

    vi.spyOn(window, 'setTimeout').mockImplementation(((handler, timeout, ...args) => {
      if (timeout === 3000 && typeof handler === 'function') {
        const timeoutId = nextTimeoutId++
        scheduledDismissCallbacks.set(timeoutId, () => {
          handler(...args)
        })

        return timeoutId
      }

      return originalSetTimeout(handler, timeout, ...args)
    }) as typeof window.setTimeout)

    vi.spyOn(window, 'clearTimeout').mockImplementation(((timeoutId) => {
      scheduledDismissCallbacks.delete(Number(timeoutId))
    }) as typeof window.clearTimeout)

    const view = renderAssessmentCreateFlowWithLocationHistory()

    expect(await screen.findByRole('heading', { level: 2, name: '대상자 목록' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: '상세보기' }))

    expect(await screen.findByRole('heading', { level: 2, name: '김대상 상세' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: '검사 시작' }))

    expect(await screen.findByRole('heading', { level: 2, name: '척도 선택' })).toBeTruthy()
    const startButton = screen.getByRole('button', { name: '검사 시작' })

    expect(startButton.hasAttribute('disabled')).toBe(true)

    await user.click(screen.getByRole('checkbox', { name: /PHQ-9/ }))

    expect(startButton.hasAttribute('disabled')).toBe(false)
    await user.click(startButton)

    expect(await screen.findByRole('heading', { level: 2, name: 'PHQ-9 입력' })).toBeTruthy()
    const nextButton = screen.getByRole('button', { name: '다음' })

    expect(nextButton.hasAttribute('disabled')).toBe(true)

    await user.click(selectAnswer('기분이 가라앉거나 우울감을 느꼈다.', '며칠 동안'))

    expect(nextButton.hasAttribute('disabled')).toBe(true)

    await user.click(selectAnswer('흥미나 즐거움이 줄어들었다.', '절반 이상'))

    expect(nextButton.hasAttribute('disabled')).toBe(false)
    await user.click(nextButton)

    expect(await screen.findByRole('heading', { level: 2, name: '세션 요약' })).toBeTruthy()
    expect(screen.getByText('PHQ-9')).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()

    await user.type(screen.getByRole('textbox', { name: /세션 메모/ }), '핵심 저장 흐름 회귀')
    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    await waitFor(() => {
      expect(mockedCreateAssessmentSession).toHaveBeenCalledTimes(1)
    })

    expect(mockedCreateAssessmentSession).toHaveBeenCalledWith({
      clientId: 42,
      sessionStartedAt: expect.any(String),
      sessionCompletedAt: expect.any(String),
      memo: '핵심 저장 흐름 회귀',
      selectedScales: [
        {
          scaleCode: 'PHQ9',
          answers: [
            { questionNo: 1, answerValue: '1' },
            { questionNo: 2, answerValue: '2' },
          ],
        },
      ],
    })

    const scaleCard = await screen.findByTestId('session-scale-PHQ9')
    const savedNotice = await screen.findByText('세션이 저장되었습니다.')
    const printButton = screen.getByRole('button', { name: '출력 보기' })

    await waitFor(() => {
      expect(view.locationHistory).toContain('/assessments/sessions/901?notice=saved')
    })

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/assessments/sessions/901')
    })
    expect(mockedFetchSessionDetail).toHaveBeenCalledWith(901, undefined)
    expect(screen.getByText('AS-20260331-0001')).toBeTruthy()
    expect(savedNotice).toBeTruthy()
    expect(within(scaleCard).getByText('PHQ-9')).toBeTruthy()
    expect(within(scaleCard).getByText('총점 3 / 경도')).toBeTruthy()
    expect(screen.queryByTestId('session-scale-GAD7')).toBeNull()
    expect(printButton).toBeTruthy()

    const dismissSavedNotice = Array.from(scheduledDismissCallbacks.values()).at(-1)

    expect(dismissSavedNotice).toBeTypeOf('function')

    act(() => {
      dismissSavedNotice?.()
    })

    await waitFor(() => {
      expect(screen.queryByText('세션이 저장되었습니다.')).toBeNull()
    })

    expect(screen.queryByText('세션이 저장되었습니다.')).toBeNull()
    expect(screen.getByTestId('location-display').textContent).toBe('/assessments/sessions/901')
    expect(screen.getByTestId('location-display').textContent).not.toContain('notice=')

    await user.click(printButton)

    expect(windowOpenSpy).toHaveBeenCalledWith(
      '/assessments/sessions/901/print',
      '_blank',
      'noopener,noreferrer',
    )

    view.unmount()
    renderAssessmentCreateFlow('/assessments/sessions/901/print')

    expect(await screen.findByRole('heading', { level: 1, name: '다시서기 정신건강 평가관리 시스템' })).toBeTruthy()
    expect(screen.getByTestId('location-display').textContent).toBe('/assessments/sessions/901/print')

    await waitFor(() => {
      expect(mockedFetchSessionPrintData).toHaveBeenCalledWith(901)
    })

    const printResultTable = screen.getByRole('table')
    const phq9Row = within(printResultTable).getByText('PHQ-9').closest('tr')

    expect(phq9Row).toBeTruthy()
    expect(screen.getByText('김대상')).toBeTruthy()
    expect(screen.getByText('AS-20260331-0001')).toBeTruthy()
    expect(screen.getByText("세션 상세의 출력용 화면입니다. 인쇄하려면 '인쇄'를 누르세요.")).toBeTruthy()
    expect(screen.getByText('2026-03-31 09:20:00')).toBeTruthy()
    expect(screen.getByText('총 1개 척도 결과, 경고 없음.')).toBeTruthy()
    expect(screen.queryByText('출력 데이터를 불러오지 못했습니다.')).toBeNull()
    expect(screen.queryByText('출력 데이터를 불러오는 중...')).toBeNull()
    expect(screen.queryByText('GAD-7')).toBeNull()
    expect(within(phq9Row as HTMLTableRowElement).getByText('3')).toBeTruthy()
    expect(within(phq9Row as HTMLTableRowElement).getByText('경도')).toBeTruthy()
  })
})
