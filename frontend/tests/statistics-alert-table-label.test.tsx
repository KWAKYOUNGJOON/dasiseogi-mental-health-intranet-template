import { cleanup, render, screen, within } from '@testing-library/react'
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

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../src/shared/utils/dateText', async () => {
  const actual = await vi.importActual<typeof import('../src/shared/utils/dateText')>('../src/shared/utils/dateText')

  return {
    ...actual,
    getDefaultStatisticsSeoulDateRange: () => ({
      dateFrom: '2026-03-27',
      dateTo: '2026-04-03',
    }),
  }
})

vi.mock('../src/features/statistics/api/statisticsApi', () => ({
  downloadStatisticsExport: vi.fn(),
  fetchStatisticsAlerts: vi.fn(),
  fetchStatisticsScales: vi.fn(),
  fetchStatisticsSummary: vi.fn(),
}))

import { fetchStatisticsAlerts, fetchStatisticsScales, fetchStatisticsSummary } from '../src/features/statistics/api/statisticsApi'
import { StatisticsPage } from '../src/pages/statistics/StatisticsPage'

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

beforeEach(() => {
  mockUseAuth.mockReset()
  mockedFetchStatisticsSummary.mockReset()
  mockedFetchStatisticsScales.mockReset()
  mockedFetchStatisticsAlerts.mockReset()

  mockUseAuth.mockReturnValue({
    authNotice: null,
    user: createUser(),
    initialized: true,
    status: 'authenticated',
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  })

  mockedFetchStatisticsSummary.mockResolvedValue({
    dateFrom: '2026-03-30',
    dateTo: '2026-04-05',
    totalSessionCount: 35,
    totalScaleCount: 88,
    alertSessionCount: 12,
    alertScaleCount: 20,
    performedByStats: [],
  })

  mockedFetchStatisticsScales.mockResolvedValue({
    dateFrom: '2026-03-30',
    dateTo: '2026-04-05',
    items: [],
  })
})

afterEach(() => {
  cleanup()
})

describe('statistics alert table scale labels', () => {
  it('keeps the default CRI label in the alert records table while leaving other scale labels unchanged', async () => {
    mockedFetchStatisticsAlerts.mockResolvedValue({
      items: [
        {
          clientName: '김대상',
          sessionCompletedAt: '2026-03-31 09:10:00',
          performedByName: '김담당',
          scaleCode: 'CRI',
          alertType: 'CAUTION',
          alertMessage: '정신과적 위기 분류 주의',
          sessionId: 101,
        },
        {
          clientName: '박대상',
          sessionCompletedAt: '2026-03-31 10:20:00',
          performedByName: '최담당',
          scaleCode: 'GAD7',
          alertType: 'HIGH_RISK',
          alertMessage: '불안 고위험',
          sessionId: 102,
        },
      ],
      page: 1,
      size: 10,
      totalItems: 2,
      totalPages: 1,
    })

    render(
      <MemoryRouter>
        <StatisticsPage />
      </MemoryRouter>,
    )

    const alertCard = (await screen.findByRole('heading', { level: 3, name: '경고 기록' })).closest('.card')

    expect(alertCard).toBeTruthy()
    expect(within(alertCard as HTMLDivElement).getByRole('cell', { name: 'CRI' })).toBeTruthy()
    expect(within(alertCard as HTMLDivElement).queryByRole('cell', { name: 'CRI (정신과적 위기 분류 평정척도)' })).toBeNull()
    expect(within(alertCard as HTMLDivElement).getByRole('cell', { name: 'GAD-7 (불안)' })).toBeTruthy()
  })
})
