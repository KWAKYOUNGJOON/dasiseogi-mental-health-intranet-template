import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'

type MockAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'auth-check-error'

interface MockAuthValue {
  authNotice?: 'session-expired' | null
  user: AuthUser | null
  initialized: boolean
  status: MockAuthStatus
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const mockUseAuth = vi.fn<() => MockAuthValue>()
const mockLogin = vi.fn<(loginId: string, password: string) => Promise<void>>()
const mockLogout = vi.fn<() => Promise<void>>()
const mockRefresh = vi.fn<() => Promise<void>>()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/features/statistics/api/statisticsApi', () => ({
  downloadStatisticsExport: vi.fn(),
  fetchStatisticsAlerts: vi.fn(),
  fetchStatisticsScales: vi.fn(),
  fetchStatisticsSummary: vi.fn(),
}))

import { AppRouter } from '../src/app/router/AppRouter'
import {
  downloadStatisticsExport,
  fetchStatisticsAlerts,
  fetchStatisticsScales,
  fetchStatisticsSummary,
} from '../src/features/statistics/api/statisticsApi'

const mockedDownloadStatisticsExport = vi.mocked(downloadStatisticsExport)
const mockedFetchStatisticsSummary = vi.mocked(fetchStatisticsSummary)
const mockedFetchStatisticsScales = vi.mocked(fetchStatisticsScales)
const mockedFetchStatisticsAlerts = vi.mocked(fetchStatisticsAlerts)

function createUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: 7,
    loginId: 'usera',
    name: '김담당',
    phone: '010-0000-0000',
    positionName: '사회복지사',
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

function createStatisticsSummary(overrides?: Partial<Awaited<ReturnType<typeof fetchStatisticsSummary>>>) {
  return {
    dateFrom: '2026-03-30',
    dateTo: '2026-04-05',
    totalSessionCount: 35,
    totalScaleCount: 88,
    alertSessionCount: 12,
    alertScaleCount: 20,
    performedByStats: [
      {
        userId: 7,
        userName: '김담당',
        sessionCount: 14,
      },
    ],
    ...overrides,
  }
}

function createStatisticsScales(overrides?: Partial<Awaited<ReturnType<typeof fetchStatisticsScales>>>) {
  return {
    dateFrom: '2026-03-30',
    dateTo: '2026-04-05',
    items: [
      {
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        totalCount: 18,
        alertCount: 6,
        isActive: true,
      },
      {
        scaleCode: 'GAD7',
        scaleName: 'GAD-7',
        totalCount: 11,
        alertCount: 3,
        isActive: true,
      },
      {
        scaleCode: 'OLDPHQ',
        scaleName: '구버전 PHQ',
        totalCount: 4,
        alertCount: 1,
        isActive: false,
      },
    ],
    ...overrides,
  }
}

function createStatisticsAlertItem(overrides?: Partial<Awaited<ReturnType<typeof fetchStatisticsAlerts>>['items'][number]>) {
  return {
    clientName: '김대상',
    sessionCompletedAt: '2026-03-31 09:10',
    performedByName: '김담당',
    scaleCode: 'PHQ9',
    alertType: 'CAUTION',
    alertMessage: '우울 주의',
    sessionId: 101,
    ...overrides,
  }
}

function createStatisticsAlertPage(
  items: Array<ReturnType<typeof createStatisticsAlertItem>>,
  overrides?: Partial<Awaited<ReturnType<typeof fetchStatisticsAlerts>>>,
) {
  return {
    items,
    page: 1,
    size: 10,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  }
}

function renderStatisticsRoute() {
  return render(
    <MemoryRouter initialEntries={['/statistics']}>
      <AppRouter />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockUseAuth.mockReset()
  mockLogin.mockReset()
  mockLogout.mockReset()
  mockRefresh.mockReset()
  mockedDownloadStatisticsExport.mockReset()
  mockedFetchStatisticsSummary.mockReset()
  mockedFetchStatisticsScales.mockReset()
  mockedFetchStatisticsAlerts.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
  mockedDownloadStatisticsExport.mockResolvedValue(undefined)

  mockedFetchStatisticsSummary.mockImplementation(async () => createStatisticsSummary())
  mockedFetchStatisticsScales.mockImplementation(async () => createStatisticsScales())
})

afterEach(() => {
  cleanup()
})

describe('statistics page', () => {
  it('keeps the admin summary csv export button stable with the current date range payload', async () => {
    const user = userEvent.setup()

    mockedFetchStatisticsAlerts.mockResolvedValue(createStatisticsAlertPage([createStatisticsAlertItem()]))
    mockUseAuth.mockReturnValue(
      createAuthValue({
        user: createUser({
          id: 1,
          loginId: 'admina',
          name: '관리자',
          role: 'ADMIN',
        }),
      }),
    )

    const { container } = renderStatisticsRoute()

    await waitFor(() => {
      expect(mockedFetchStatisticsSummary).toHaveBeenCalledTimes(1)
      expect(mockedFetchStatisticsScales).toHaveBeenCalledTimes(1)
      expect(mockedFetchStatisticsAlerts).toHaveBeenCalledTimes(1)
    })

    const initialDateRange = mockedFetchStatisticsSummary.mock.calls[0]?.[0]

    expect(await screen.findByRole('heading', { level: 2, name: '통계' })).toBeTruthy()
    const summaryCsvButton = screen.getByRole('button', { name: '요약 CSV' })

    expect(summaryCsvButton).toBeTruthy()
    expect(screen.getByRole('button', { name: '척도비교 CSV' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '경고목록 CSV' })).toBeTruthy()
    expect(screen.queryByText('통계 정보를 불러오지 못했습니다.')).toBeNull()

    const dateInputs = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[]

    expect(dateInputs).toHaveLength(2)
    expect(summaryCsvButton.hasAttribute('disabled')).toBe(false)
    expect(dateInputs[0]?.value).toBe(initialDateRange?.dateFrom)
    expect(dateInputs[1]?.value).toBe(initialDateRange?.dateTo)

    fireEvent.change(dateInputs[0], { target: { value: '2026-03-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-03-31' } })

    await user.click(summaryCsvButton)

    await waitFor(() => {
      expect(mockedDownloadStatisticsExport).toHaveBeenCalledTimes(1)
    })

    expect(mockedDownloadStatisticsExport).toHaveBeenCalledWith({
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      type: 'SUMMARY',
    })
  })

  it('keeps the user statistics flow stable through initial load, filter search, and page reset to 1', async () => {
    const user = userEvent.setup()

    mockedFetchStatisticsAlerts
      .mockResolvedValueOnce(
        createStatisticsAlertPage([createStatisticsAlertItem()], {
          page: 1,
          totalItems: 2,
          totalPages: 2,
        }),
      )
      .mockResolvedValueOnce(
        createStatisticsAlertPage(
          [
            createStatisticsAlertItem({
              clientName: '박대상',
              sessionCompletedAt: '2026-03-31 10:00',
              performedByName: '이담당',
              scaleCode: 'GAD7',
              alertType: 'CAUTION',
              alertMessage: '불안 주의',
              sessionId: 102,
            }),
          ],
          {
            page: 2,
            totalItems: 2,
            totalPages: 2,
          },
        ),
      )
      .mockResolvedValueOnce(
        createStatisticsAlertPage([
          createStatisticsAlertItem({
            clientName: '최대상',
            sessionCompletedAt: '2026-03-31 11:00',
            performedByName: '김담당',
            scaleCode: 'PHQ9',
            alertType: 'HIGH_RISK',
            alertMessage: '고위험군 추정',
            sessionId: 103,
          }),
        ]),
      )

    renderStatisticsRoute()

    await waitFor(() => {
      expect(mockedFetchStatisticsSummary).toHaveBeenCalledTimes(1)
      expect(mockedFetchStatisticsScales).toHaveBeenCalledTimes(1)
      expect(mockedFetchStatisticsAlerts).toHaveBeenCalledTimes(1)
    })

    const initialParams = mockedFetchStatisticsSummary.mock.calls[0]?.[0]

    expect(initialParams).toEqual({
      dateFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      dateTo: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
    expect(mockedFetchStatisticsScales).toHaveBeenCalledWith(initialParams)
    expect(mockedFetchStatisticsAlerts).toHaveBeenCalledWith({
      ...initialParams,
      scaleCode: undefined,
      alertType: undefined,
      page: 1,
      size: 10,
    })

    expect(await screen.findByRole('heading', { level: 2, name: '통계' })).toBeTruthy()

    const totalSessionCard = screen.getByText('전체 세션').closest('div')
    const totalScaleCard = screen.getByText('전체 척도 시행').closest('div')
    const alertSessionCard = screen.getByText('경고 세션').closest('div')
    const alertScaleCard = screen.getByText('경고 척도').closest('div')
    const performedByCard = screen.getByRole('heading', { level: 3, name: '담당자별 세션 수' }).closest('.card')
    const activeScaleRow = screen.getByText('PHQ-9').closest('tr')
    const initialAlertRow = (await screen.findByText('우울 주의')).closest('tr')

    expect(totalSessionCard).toBeTruthy()
    expect(totalScaleCard).toBeTruthy()
    expect(alertSessionCard).toBeTruthy()
    expect(alertScaleCard).toBeTruthy()
    expect(performedByCard).toBeTruthy()
    expect(activeScaleRow).toBeTruthy()
    expect(initialAlertRow).toBeTruthy()

    expect(within(totalSessionCard as HTMLDivElement).getByText('35')).toBeTruthy()
    expect(within(totalScaleCard as HTMLDivElement).getByText('88')).toBeTruthy()
    expect(within(alertSessionCard as HTMLDivElement).getByText('12')).toBeTruthy()
    expect(within(alertScaleCard as HTMLDivElement).getByText('20')).toBeTruthy()
    expect(within(performedByCard as HTMLDivElement).getByRole('cell', { name: '김담당' })).toBeTruthy()
    expect(within(performedByCard as HTMLDivElement).getByRole('cell', { name: '14' })).toBeTruthy()
    expect(within(activeScaleRow as HTMLTableRowElement).getByText('18')).toBeTruthy()
    expect(within(activeScaleRow as HTMLTableRowElement).getByText('6')).toBeTruthy()
    expect(within(initialAlertRow as HTMLTableRowElement).getByText('김대상')).toBeTruthy()
    expect(within(initialAlertRow as HTMLTableRowElement).getByText('PHQ9')).toBeTruthy()
    expect(within(initialAlertRow as HTMLTableRowElement).getByText('CAUTION')).toBeTruthy()
    expect(screen.queryByText('경고 기록이 없습니다.')).toBeNull()
    expect(screen.queryByText('통계 정보를 불러오지 못했습니다.')).toBeNull()

    await user.click(screen.getByRole('button', { name: '다음' }))

    await waitFor(() => {
      expect(mockedFetchStatisticsAlerts).toHaveBeenLastCalledWith({
        ...initialParams,
        scaleCode: undefined,
        alertType: undefined,
        page: 2,
        size: 10,
      })
    })

    const secondPageAlertRow = (await screen.findByText('불안 주의')).closest('tr')

    expect(secondPageAlertRow).toBeTruthy()
    expect(within(secondPageAlertRow as HTMLTableRowElement).getByText('박대상')).toBeTruthy()
    expect(screen.getByText('2건 / 2페이지')).toBeTruthy()

    await user.clear(screen.getByPlaceholderText('경고 척도코드 예: PHQ9'))
    await user.type(screen.getByPlaceholderText('경고 척도코드 예: PHQ9'), 'phq9')
    await user.selectOptions(screen.getByRole('combobox'), 'HIGH_RISK')
    await user.click(screen.getByRole('button', { name: '조회' }))

    await waitFor(() => {
      expect(mockedFetchStatisticsSummary).toHaveBeenCalledTimes(3)
      expect(mockedFetchStatisticsScales).toHaveBeenCalledTimes(3)
      expect(mockedFetchStatisticsAlerts).toHaveBeenCalledTimes(3)
    })

    expect(mockedFetchStatisticsAlerts).toHaveBeenLastCalledWith({
      ...initialParams,
      scaleCode: 'PHQ9',
      alertType: 'HIGH_RISK',
      page: 1,
      size: 10,
    })

    const filteredAlertRow = (await screen.findByText('고위험군 추정')).closest('tr')

    expect(filteredAlertRow).toBeTruthy()
    expect(within(filteredAlertRow as HTMLTableRowElement).getByText('최대상')).toBeTruthy()
    expect(within(filteredAlertRow as HTMLTableRowElement).getByText('HIGH_RISK')).toBeTruthy()
    expect(screen.getByText('1건 / 1페이지')).toBeTruthy()
    expect(screen.queryByText('불안 주의')).toBeNull()
    expect(screen.queryByText('경고 기록이 없습니다.')).toBeNull()
    expect(screen.queryByText('통계 정보를 불러오지 못했습니다.')).toBeNull()
  })
})
