import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../src/features/auth/api/authApi'
import {
  fetchAssessmentRecords,
  fetchScales,
  fetchSessionDetail,
  markSessionMisentered,
  type AssessmentRecordPage,
  type ScaleListItem,
  type SessionDetail,
} from '../src/features/assessment/api/assessmentApi'
import { AssessmentRecordListPage } from '../src/pages/assessment/AssessmentRecordListPage'
import { AssessmentSessionDetailPage } from '../src/pages/assessment/AssessmentSessionDetailPage'

const mockUseAuth = vi.fn<() => { user: AuthUser | null }>()

vi.mock('../src/app/providers/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
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

const mockedFetchAssessmentRecords = vi.mocked(fetchAssessmentRecords)
const mockedFetchScales = vi.mocked(fetchScales)
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

function createRecord(
  overrides?: Partial<AssessmentRecordPage['items'][number]>,
): AssessmentRecordPage['items'][number] {
  return {
    sessionId: 501,
    sessionScaleId: 9001,
    sessionNo: 'AS-20260331-0001',
    sessionCompletedAt: '2026-03-31T09:20:00',
    clientId: 42,
    clientName: '김대상',
    performedByName: '김담당',
    scaleCode: 'PHQ9',
    scaleName: 'PHQ-9',
    totalScore: 8,
    resultLevel: '중등도',
    hasAlert: false,
    sessionStatus: 'COMPLETED',
    ...overrides,
  }
}

function createAssessmentRecordPage(
  items: AssessmentRecordPage['items'],
  overrides?: Partial<AssessmentRecordPage>,
): AssessmentRecordPage {
  return {
    items,
    page: 1,
    size: 20,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
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
    hasAlert: false,
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

function LocationDisplay() {
  const location = useLocation()

  return <div data-testid="location-display">{`${location.pathname}${location.search}`}</div>
}

function renderAssessmentRecordFlow(initialEntry = '/assessment-records') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay />
      <Routes>
        <Route path="/assessment-records" element={<AssessmentRecordListPage />} />
        <Route path="/assessments/sessions/:sessionId" element={<AssessmentSessionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetchAssessmentRecords.mockReset()
  mockedFetchScales.mockReset()
  mockedFetchSessionDetail.mockReset()
  mockedMarkSessionMisentered.mockReset()
  mockUseAuth.mockReset()

  mockUseAuth.mockReturnValue({ user: createUser() })
  mockedFetchAssessmentRecords.mockResolvedValue(createAssessmentRecordPage([createRecord()]))
  mockedFetchScales.mockResolvedValue([
    createScaleListItem(),
    createScaleListItem({
      scaleCode: 'GAD7',
      scaleName: 'GAD-7',
      displayOrder: 2,
    }),
    createScaleListItem({
      scaleCode: 'MKPQ16',
      scaleName: 'mKPQ-16',
      displayOrder: 3,
    }),
    createScaleListItem({
      scaleCode: 'KMDQ',
      scaleName: 'K-MDQ',
      displayOrder: 4,
    }),
    createScaleListItem({
      scaleCode: 'PSS10',
      scaleName: 'PSS-10',
      displayOrder: 5,
    }),
    createScaleListItem({
      scaleCode: 'ISIK',
      scaleName: 'ISI-K',
      displayOrder: 6,
    }),
    createScaleListItem({
      scaleCode: 'AUDITK',
      scaleName: 'AUDIT-K',
      displayOrder: 7,
    }),
    createScaleListItem({
      scaleCode: 'IESR',
      scaleName: 'IES-R',
      displayOrder: 8,
    }),
    createScaleListItem({
      scaleCode: 'CRI',
      scaleName: '정신과적 위기 분류 평정척도 (CRI)',
      displayOrder: 9,
    }),
  ])
  mockedFetchSessionDetail.mockResolvedValue(createSessionDetail())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('assessment record list page', () => {
  it('renders the assessment record rows when the page opens', async () => {
    mockedFetchAssessmentRecords.mockResolvedValueOnce(
      createAssessmentRecordPage([
        createRecord(),
        createRecord({
          sessionId: 502,
          sessionScaleId: 9002,
          scaleCode: 'GAD7',
          scaleName: 'GAD-7',
          resultLevel: '고위험',
        }),
      ]),
    )

    renderAssessmentRecordFlow()

    await waitFor(() => {
      expect(mockedFetchAssessmentRecords).toHaveBeenCalledWith({
        dateFrom: undefined,
        dateTo: undefined,
        clientName: undefined,
        scaleCode: undefined,
        includeMisentered: false,
        page: 1,
        size: 20,
      })
    })

    expect(await screen.findByRole('heading', { name: '검사기록 목록' })).toBeTruthy()
    expect(screen.getAllByText('김대상').length).toBe(2)
    expect(screen.getByText('PHQ-9')).toBeTruthy()
    expect(screen.getByText('GAD-7')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '상세 보기' }).length).toBe(2)
    expect(screen.getAllByText('2026-03-31 09:20:00').length).toBeGreaterThan(0)
    expect(screen.queryByText('2026-03-31T09:20:00')).toBeNull()
  })

  it('renders CRI as a short code in the scale column even when the API returns the long name', async () => {
    mockedFetchAssessmentRecords.mockResolvedValueOnce(
      createAssessmentRecordPage([
        createRecord({
          scaleCode: 'CRI',
          scaleName: '정신과적 위기 분류 평정척도 (CRI)',
        }),
        createRecord({
          sessionId: 502,
          sessionScaleId: 9002,
          scaleCode: 'PHQ9',
          scaleName: 'PHQ-9',
        }),
      ]),
    )

    renderAssessmentRecordFlow()

    expect(await screen.findByRole('cell', { name: 'CRI' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'PHQ-9' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: '정신과적 위기 분류 평정척도 (CRI)' })).toBeNull()
  })

  it('shows friendly scale labels in the dropdown while keeping the filter value as the scale code', async () => {
    const user = userEvent.setup()

    renderAssessmentRecordFlow()

    expect(await screen.findByRole('option', { name: 'PHQ-9 (우울)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'GAD-7 (불안)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'mKPQ-16 (정신증 위험)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'K-MDQ (양극성(조울증))' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'PSS-10 (스트레스)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'ISI-K (불면)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'AUDIT-K (알코올 사용)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'IES-R (외상 후 스트레스(PTSD))' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '정신과적 위기 분류 평정척도 (CRI) (정신과적 위기 분류)' })).toBeTruthy()

    const scaleSelect = screen.getByRole('combobox')
    await user.selectOptions(scaleSelect, 'PHQ9')

    expect(screen.getByRole('option', { name: 'PHQ-9 (우울)' })).toHaveProperty('selected', true)

    await user.click(screen.getByRole('button', { name: '조회' }))

    await waitFor(() => {
      expect(mockedFetchAssessmentRecords).toHaveBeenLastCalledWith({
        dateFrom: undefined,
        dateTo: undefined,
        clientName: undefined,
        scaleCode: 'PHQ9',
        includeMisentered: false,
        page: 1,
        size: 20,
      })
    })
  })

  it('moves to the session detail route with highlightScaleCode and returns to the same filtered list state', async () => {
    const user = userEvent.setup()

    mockedFetchAssessmentRecords
      .mockResolvedValueOnce(
        createAssessmentRecordPage(
          [
            createRecord({
              sessionId: 501,
              sessionScaleId: 9002,
              scaleCode: 'GAD7',
              scaleName: 'GAD-7',
              resultLevel: '고위험',
              hasAlert: true,
            }),
          ],
          {
            page: 2,
            totalItems: 21,
            totalPages: 2,
          },
        ),
      )
      .mockResolvedValueOnce(
        createAssessmentRecordPage(
          [
            createRecord({
              sessionId: 501,
              sessionScaleId: 9002,
              scaleCode: 'GAD7',
              scaleName: 'GAD-7',
              resultLevel: '고위험',
              hasAlert: true,
            }),
          ],
          {
            page: 2,
            totalItems: 21,
            totalPages: 2,
          },
        ),
      )

    renderAssessmentRecordFlow('/assessment-records?clientName=%EA%B9%80%EB%8C%80%EC%83%81&includeMisentered=true&page=2')

    await screen.findByText('GAD-7')
    await user.click(screen.getByRole('link', { name: '상세 보기' }))

    await screen.findByRole('heading', { name: '세션 상세' })
    expect(screen.getByTestId('location-display').textContent).toContain('/assessments/sessions/501?')
    expect(screen.getByTestId('location-display').textContent).toContain('highlightScaleCode=GAD7')
    expect(screen.getByTestId('location-display').textContent).toContain(
      'returnTo=%2Fassessment-records%3FclientName%3D%25EA%25B9%2580%25EB%258C%2580%25EC%2583%2581%26includeMisentered%3Dtrue%26page%3D2',
    )
    expect(mockedFetchSessionDetail).toHaveBeenCalledWith(501, { highlightScaleCode: 'GAD7' })

    const highlightedCard = await screen.findByTestId('session-scale-GAD7')
    expect(highlightedCard.getAttribute('data-highlighted')).toBe('true')

    await user.click(screen.getByRole('link', { name: '검사기록 목록으로 돌아가기' }))

    await screen.findByRole('heading', { name: '검사기록 목록' })
    expect(screen.getByTestId('location-display').textContent).toBe(
      '/assessment-records?clientName=%EA%B9%80%EB%8C%80%EC%83%81&includeMisentered=true&page=2',
    )
    expect(mockedFetchAssessmentRecords).toHaveBeenNthCalledWith(2, {
      dateFrom: undefined,
      dateTo: undefined,
      clientName: '김대상',
      scaleCode: undefined,
      includeMisentered: true,
      page: 2,
      size: 20,
    })
  })

  it('shows an error message and retry action when loading the record list fails', async () => {
    const user = userEvent.setup()

    mockedFetchAssessmentRecords
      .mockRejectedValueOnce({
        response: {
          data: {
            message: '검사기록 목록 조회에 실패했습니다.',
          },
        },
      })
      .mockResolvedValueOnce(createAssessmentRecordPage([createRecord()]))

    renderAssessmentRecordFlow()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('검사기록 목록 조회에 실패했습니다.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: '상세 보기' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByRole('link', { name: '상세 보기' })).toBeTruthy()
    expect(mockedFetchAssessmentRecords).toHaveBeenCalledTimes(2)
  })

  it('shows an empty state when no assessment records are returned', async () => {
    mockedFetchAssessmentRecords.mockResolvedValueOnce(createAssessmentRecordPage([], { totalItems: 0, totalPages: 0 }))

    renderAssessmentRecordFlow()

    expect(await screen.findByText('조회된 검사기록이 없습니다.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('link', { name: '상세 보기' })).toBeNull()
  })

  it('distinguishes MISENTERED records in the list', async () => {
    mockedFetchAssessmentRecords.mockResolvedValueOnce(
      createAssessmentRecordPage([
        createRecord({
          sessionId: 503,
          sessionScaleId: 9003,
          sessionStatus: 'MISENTERED',
        }),
      ]),
    )

    renderAssessmentRecordFlow()

    const statusChip = await screen.findByTestId('record-status-9003')

    expect(statusChip.textContent).toBe('오입력')
    expect(statusChip.getAttribute('data-status')).toBe('MISENTERED')
    expect(statusChip.className).toContain('status-chip-danger')
  })

  it('does not expose detail navigation UI while the record list is still loading', async () => {
    const deferred = createDeferredPromise<AssessmentRecordPage>()

    mockedFetchAssessmentRecords.mockReturnValueOnce(deferred.promise)

    renderAssessmentRecordFlow()

    expect(await screen.findByText('검사기록 목록을 불러오는 중...')).toBeTruthy()
    expect(screen.queryByRole('link', { name: '상세 보기' })).toBeNull()

    deferred.resolve(createAssessmentRecordPage([createRecord()]))

    expect(await screen.findByRole('link', { name: '상세 보기' })).toBeTruthy()
  })
})
