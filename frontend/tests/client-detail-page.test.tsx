import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from '../src/app/router/AppRouter'
import type { AuthUser } from '../src/features/auth/api/authApi'
import { fetchScales } from '../src/features/assessment/api/assessmentApi'
import { fetchClientDetail, markClientMisregistered, type ClientDetail } from '../src/features/clients/api/clientApi'

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
const mockedMarkClientMisregistered = vi.mocked(markClientMisregistered)
const mockedFetchScales = vi.mocked(fetchScales)

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
    recentSessions: [],
    ...overrides,
  }
}

function LocationDisplay() {
  const location = useLocation()

  return <div data-testid="location-display">{location.pathname}</div>
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
  mockedFetchClientDetail.mockReset()
  mockedMarkClientMisregistered.mockReset()
  mockedFetchScales.mockReset()

  mockLogin.mockResolvedValue(undefined)
  mockLogout.mockResolvedValue(undefined)
  mockRefresh.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue(createAuthValue())
  mockedFetchClientDetail.mockResolvedValue(createClientDetail())
  mockedFetchScales.mockResolvedValue([])
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
    expect(mockedFetchScales).toHaveBeenCalledTimes(1)
  })
})
