import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from '../src/app/router/AppRouter'
import type { AuthUser } from '../src/features/auth/api/authApi'
import {
  fetchScales,
  fetchSessionDetail,
  type ScaleListItem,
  type SessionDetail,
} from '../src/features/assessment/api/assessmentApi'
import {
  fetchClientDetail,
  fetchClientScaleTrend,
  markClientMisregistered,
  type ClientDetail,
  type ClientScaleTrend,
} from '../src/features/clients/api/clientApi'

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

vi.mock('../src/features/clients/api/clientApi', () => ({
  fetchClientDetail: vi.fn(),
  fetchClientScaleTrend: vi.fn(),
  markClientMisregistered: vi.fn(),
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

const mockedFetchClientDetail = vi.mocked(fetchClientDetail)
const mockedFetchClientScaleTrend = vi.mocked(fetchClientScaleTrend)
const mockedMarkClientMisregistered = vi.mocked(markClientMisregistered)
const mockedFetchScales = vi.mocked(fetchScales)
const mockedFetchSessionDetail = vi.mocked(fetchSessionDetail)
const mockScrollIntoView = vi.fn()

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
    user: createUser(),
    initialized: true,
    login: mockLogin,
    logout: mockLogout,
    refresh: mockRefresh,
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
    latestRecordedScaleCode: null,
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

function createTrendPoint(
  overrides?: Partial<ClientScaleTrend['points'][number]>,
): ClientScaleTrend['points'][number] {
  return {
    sessionId: 100,
    sessionScaleId: 200,
    assessedAt: '2026-04-01 09:00:00',
    createdAt: '2026-04-01 09:05:00',
    totalScore: 12,
    resultLevel: '중등도',
    alerts: [],
    ...overrides,
  }
}

function createClientScaleTrend(overrides?: Partial<ClientScaleTrend>): ClientScaleTrend {
  return {
    scaleCode: 'PHQ9',
    scaleName: 'PHQ-9',
    maxScore: 27,
    cutoffs: [
      { score: 5, label: '경도' },
      { score: 10, label: '중등도' },
    ],
    points: [createTrendPoint()],
    ...overrides,
  }
}

function createSessionDetail(overrides?: Partial<SessionDetail>): SessionDetail {
  return {
    id: 100,
    sessionNo: 'S-2026-0001',
    status: 'COMPLETED',
    sessionDate: '2026-04-01',
    sessionStartedAt: '2026-04-01 09:00',
    sessionCompletedAt: '2026-04-01 09:10',
    performedById: 7,
    performedByName: '김담당',
    clientId: 42,
    clientNo: 'CL-00042',
    clientName: '김대상',
    clientBirthDate: '1990-01-02',
    clientGender: 'MALE',
    memo: null,
    misenteredAt: null,
    misenteredById: null,
    misenteredByName: null,
    misenteredReason: null,
    hasAlert: false,
    scales: [
      {
        sessionScaleId: 200,
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        displayOrder: 1,
        totalScore: 12,
        resultLevel: '중등도',
        hasAlert: false,
        answers: [],
        alerts: [],
      },
    ],
    alerts: [],
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    resolve,
    reject,
  }
}

function LocationDisplay() {
  const location = useLocation()

  return <div data-testid="location-display">{`${location.pathname}${location.search}`}</div>
}

function renderClientDetailRoute() {
  return render(
    <MemoryRouter initialEntries={['/clients/42']}>
      <LocationDisplay />
      <AppRouter />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockScrollIntoView.mockReset()
  mockedFetchClientDetail.mockReset()
  mockedFetchClientScaleTrend.mockReset()
  mockedMarkClientMisregistered.mockReset()
  mockedFetchScales.mockReset()
  mockedFetchSessionDetail.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
  mockedFetchClientDetail.mockResolvedValue(createClientDetail())
  mockedFetchScales.mockResolvedValue([createScaleListItem()])
  mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend())
  mockedFetchSessionDetail.mockResolvedValue(createSessionDetail())
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: mockScrollIntoView,
  })
})

afterEach(() => {
  cleanup()
})

describe('client detail page', () => {
  it('shows the 검사 시작 button on the client detail page', async () => {
    renderClientDetailRoute()

    await waitFor(() => {
      expect(mockedFetchClientDetail).toHaveBeenCalledWith(42)
    })

    const startAssessmentLink = await screen.findByRole('link', { name: '검사 시작' })

    expect(startAssessmentLink.getAttribute('href')).toBe('/assessments/start/42')
  })

  it('navigates to /assessments/start/:clientId when the 검사 시작 button is clicked', async () => {
    const user = userEvent.setup()

    renderClientDetailRoute()

    const startAssessmentLink = await screen.findByRole('link', { name: '검사 시작' })
    await user.click(startAssessmentLink)

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/assessments/start/42')
    })

    expect(await screen.findByRole('heading', { name: '척도 선택' })).toBeTruthy()
    expect(mockedFetchScales).toHaveBeenCalled()
  })

  it('renders the 척도 추세 section', async () => {
    renderClientDetailRoute()

    expect(await screen.findByRole('heading', { name: '척도 추세' })).toBeTruthy()
  })

  it('shows only active and implemented scales in the dropdown', async () => {
    mockedFetchScales.mockResolvedValue([
      createScaleListItem({ scaleCode: 'PHQ9', scaleName: 'PHQ-9', displayOrder: 2 }),
      createScaleListItem({ scaleCode: 'GAD7', scaleName: 'GAD-7', displayOrder: 1 }),
      createScaleListItem({ scaleCode: 'OLD1', scaleName: '비활성 척도', displayOrder: 3, isActive: false }),
      createScaleListItem({ scaleCode: 'TODO1', scaleName: '미구현 척도', displayOrder: 4, implemented: false }),
    ])
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      scaleCode: 'GAD7',
      scaleName: 'GAD-7',
    }))

    renderClientDetailRoute()

    const scaleSelect = await screen.findByRole('combobox', { name: '척도 선택' })
    const options = within(scaleSelect).getAllByRole('option')

    expect(options.map((option) => option.getAttribute('value'))).toEqual(['GAD7', 'PHQ9'])
    expect(within(scaleSelect).queryByRole('option', { name: '비활성 척도' })).toBeNull()
    expect(within(scaleSelect).queryByRole('option', { name: '미구현 척도' })).toBeNull()
  })

  it('selects the latest recorded operating scale by default and fetches the trend once', async () => {
    mockedFetchClientDetail.mockResolvedValue(createClientDetail({
      latestRecordedScaleCode: 'GAD7',
    }))
    mockedFetchScales.mockResolvedValue([
      createScaleListItem({ scaleCode: 'PHQ9', scaleName: 'PHQ-9', displayOrder: 2 }),
      createScaleListItem({ scaleCode: 'GAD7', scaleName: 'GAD-7', displayOrder: 1 }),
    ])
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      scaleCode: 'GAD7',
      scaleName: 'GAD-7',
    }))

    renderClientDetailRoute()

    const scaleSelect = await screen.findByRole('combobox', { name: '척도 선택' })

    await waitFor(() => {
      expect(mockedFetchClientScaleTrend).toHaveBeenCalledWith(42, 'GAD7')
    })

    expect((scaleSelect as HTMLSelectElement).value).toBe('GAD7')
    expect(mockedFetchClientScaleTrend).toHaveBeenCalledTimes(1)
  })

  it('falls back to the first operating scale when the latest recorded scale is not operating', async () => {
    mockedFetchClientDetail.mockResolvedValue(createClientDetail({
      latestRecordedScaleCode: 'OLD1',
    }))
    mockedFetchScales.mockResolvedValue([
      createScaleListItem({ scaleCode: 'PHQ9', scaleName: 'PHQ-9', displayOrder: 2 }),
      createScaleListItem({ scaleCode: 'GAD7', scaleName: 'GAD-7', displayOrder: 1 }),
      createScaleListItem({ scaleCode: 'OLD1', scaleName: '비활성 척도', displayOrder: 3, isActive: false }),
    ])
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      scaleCode: 'GAD7',
      scaleName: 'GAD-7',
    }))

    renderClientDetailRoute()

    const scaleSelect = await screen.findByRole('combobox', { name: '척도 선택' })

    await waitFor(() => {
      expect(mockedFetchClientScaleTrend).toHaveBeenCalledWith(42, 'GAD7')
    })

    expect((scaleSelect as HTMLSelectElement).value).toBe('GAD7')
  })

  it('falls back to the first operating scale when no operating scale has a recorded history', async () => {
    mockedFetchScales.mockResolvedValue([
      createScaleListItem({ scaleCode: 'PHQ9', scaleName: 'PHQ-9', displayOrder: 2 }),
      createScaleListItem({ scaleCode: 'GAD7', scaleName: 'GAD-7', displayOrder: 1 }),
    ])
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      scaleCode: 'GAD7',
      scaleName: 'GAD-7',
    }))

    renderClientDetailRoute()

    const scaleSelect = await screen.findByRole('combobox', { name: '척도 선택' })

    await waitFor(() => {
      expect(mockedFetchClientScaleTrend).toHaveBeenCalledWith(42, 'GAD7')
    })

    expect((scaleSelect as HTMLSelectElement).value).toBe('GAD7')
    expect(mockedFetchClientScaleTrend).toHaveBeenCalledTimes(1)
    expect(mockedFetchSessionDetail).not.toHaveBeenCalled()
  })

  it('shows 기록 없음 when the selected scale has no trend points', async () => {
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({ points: [] }))

    renderClientDetailRoute()

    expect(await screen.findByText('기록 없음')).toBeTruthy()
    expect(screen.queryByTestId('client-scale-trend-chart')).toBeNull()
    expect(screen.queryByTestId('client-scale-trend-point')).toBeNull()
  })

  it('shows trend loading and error states', async () => {
    const deferredTrend = createDeferred<ClientScaleTrend>()

    mockedFetchClientScaleTrend.mockReturnValueOnce(deferredTrend.promise)

    renderClientDetailRoute()

    expect(await screen.findByText('척도 추세를 불러오는 중...')).toBeTruthy()

    deferredTrend.reject(new Error('boom'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('척도 추세를 불러오지 못했습니다.')
    })
  })

  it('renders the scale trend chart and cutoff labels when trend points exist', async () => {
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      points: [
        createTrendPoint({
          sessionId: 100,
          sessionScaleId: 200,
          assessedAt: '2026-04-01 09:00:00',
          createdAt: '2026-04-01 09:05:00',
          totalScore: 12,
          resultLevel: '중등도',
        }),
        createTrendPoint({
          sessionId: 101,
          sessionScaleId: 201,
          assessedAt: '2026-04-08 10:30:00',
          createdAt: '2026-04-08 10:40:00',
          totalScore: 7,
          resultLevel: '경도',
        }),
      ],
    }))

    renderClientDetailRoute()

    expect(await screen.findByTestId('client-scale-trend-chart')).toBeTruthy()
    expect(screen.getByTestId('client-scale-trend-line')).toBeTruthy()
    expect(screen.getByText('5 경도')).toBeTruthy()
    expect(screen.getByText('10 중등도')).toBeTruthy()
  })

  it('renders the scale trend chart without cutoff labels when the selected scale has no cutoffs', async () => {
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      scaleCode: 'CRI',
      scaleName: '정신과적 위기 분류 평정척도 (CRI)',
      maxScore: 23,
      cutoffs: [],
      points: [
        createTrendPoint({
          resultLevel: 'A - 극도의 위기',
          totalScore: 15,
        }),
      ],
    }))

    renderClientDetailRoute()

    expect(await screen.findByTestId('client-scale-trend-chart')).toBeTruthy()
    expect(screen.getByText(/총 1건 · 최대 23점/)).toBeTruthy()
    expect(screen.queryByText('5 경도')).toBeNull()
  })

  it('uses the last ordered point for the latest summary when assessedAt and createdAt are tied', async () => {
    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      points: [
        createTrendPoint({
          sessionId: 400,
          sessionScaleId: 500,
          assessedAt: '2026-04-08 10:30:00',
          createdAt: '2026-04-08 10:40:00',
          totalScore: 7,
          resultLevel: '경도',
        }),
        createTrendPoint({
          sessionId: 401,
          sessionScaleId: 501,
          assessedAt: '2026-04-08 10:30:00',
          createdAt: '2026-04-08 10:40:00',
          totalScore: 14,
          resultLevel: '중등도-중증',
        }),
      ],
    }))

    renderClientDetailRoute()

    expect(await screen.findByTestId('client-scale-trend-chart')).toBeTruthy()
    expect(screen.getByText(/최근 판정 중등도-중증/)).toBeTruthy()
  })

  it('renders a single point without a line when there is only one trend point', async () => {
    renderClientDetailRoute()

    expect(await screen.findByTestId('client-scale-trend-chart')).toBeTruthy()
    expect(await screen.findAllByTestId('client-scale-trend-point')).toHaveLength(1)
    expect(screen.queryByTestId('client-scale-trend-line')).toBeNull()
  })

  it('navigates to the session detail page when a trend point is clicked', async () => {
    const user = userEvent.setup()

    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      points: [
        createTrendPoint({
          sessionId: 321,
          sessionScaleId: 654,
        }),
      ],
    }))
    mockedFetchSessionDetail.mockResolvedValue(createSessionDetail({ id: 321 }))

    renderClientDetailRoute()

    const [point] = await screen.findAllByTestId('client-scale-trend-point')
    await user.click(point)

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe(
        '/assessments/sessions/321?highlightScaleCode=PHQ9',
      )
    })

    expect(mockedFetchSessionDetail).toHaveBeenCalledWith(321, { highlightScaleCode: 'PHQ9' })
  })

  it('navigates to the session detail page when Enter is pressed on a focused trend point', async () => {
    const user = userEvent.setup()

    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      points: [
        createTrendPoint({
          sessionId: 654,
          sessionScaleId: 987,
        }),
      ],
    }))
    mockedFetchSessionDetail.mockResolvedValue(createSessionDetail({ id: 654 }))

    renderClientDetailRoute()

    const [point] = await screen.findAllByTestId('client-scale-trend-point')

    act(() => {
      point.focus()
    })

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe(
        '/assessments/sessions/654?highlightScaleCode=PHQ9',
      )
    })

    expect(mockedFetchSessionDetail).toHaveBeenCalledWith(654, { highlightScaleCode: 'PHQ9' })
  })

  it('navigates to the session detail page when Space is pressed on a focused trend point', async () => {
    const user = userEvent.setup()

    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      points: [
        createTrendPoint({
          sessionId: 777,
          sessionScaleId: 888,
        }),
      ],
    }))
    mockedFetchSessionDetail.mockResolvedValue(createSessionDetail({ id: 777 }))

    renderClientDetailRoute()

    const [point] = await screen.findAllByTestId('client-scale-trend-point')

    act(() => {
      point.focus()
    })

    await user.keyboard('{Space}')

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe(
        '/assessments/sessions/777?highlightScaleCode=PHQ9',
      )
    })

    expect(mockedFetchSessionDetail).toHaveBeenCalledWith(777, { highlightScaleCode: 'PHQ9' })
  })

  it('shows point details in the tooltip on hover and focus', async () => {
    const user = userEvent.setup()

    mockedFetchClientScaleTrend.mockResolvedValue(createClientScaleTrend({
      points: [
        createTrendPoint({
          alerts: [
            {
              id: 1,
              scaleCode: 'PHQ9',
              alertType: 'HIGH_SCORE',
              alertCode: 'PHQ9_HIGH_SCORE',
              alertMessage: '총점이 주의 기준 이상입니다.',
              questionNo: null,
              triggerValue: '12',
            },
            {
              id: 2,
              scaleCode: 'PHQ9',
              alertType: 'SUICIDE_RISK',
              alertCode: 'PHQ9_SUICIDE_RISK',
              alertMessage: '자살사고 문항 응답을 확인하세요.',
              questionNo: 9,
              triggerValue: '2',
            },
          ],
        }),
      ],
    }))

    renderClientDetailRoute()

    const [point] = await screen.findAllByTestId('client-scale-trend-point')

    act(() => {
      point.focus()
    })

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('2026-04-01 09:00')
    })

    act(() => {
      point.blur()
    })

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).toBeNull()
    })

    await user.hover(point)

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip')

      expect(tooltip).toHaveTextContent('2026-04-01 09:00')
      expect(tooltip).toHaveTextContent('12')
      expect(tooltip).toHaveTextContent('중등도')
      expect(tooltip).toHaveTextContent('HIGH_SCORE / 총점이 주의 기준 이상입니다.')
      expect(tooltip).toHaveTextContent('SUICIDE_RISK / 자살사고 문항 응답을 확인하세요.')
    })
  })
})
