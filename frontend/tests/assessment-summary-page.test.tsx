import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAssessmentSession,
  fetchScaleDetail,
  type ScaleDetail,
} from '../src/features/assessment/api/assessmentApi'
import { useAssessmentDraftStore } from '../src/features/assessment/store/assessmentDraftStore'
import { AssessmentSummaryPage } from '../src/pages/assessment/AssessmentSummaryPage'

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
const mockedFetchScaleDetail = vi.mocked(fetchScaleDetail)

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
        questionKey: 'q1',
        questionText: '기분이 가라앉거나 우울감을 느꼈다.',
        reverseScored: false,
        options: [
          { value: '0', label: '전혀 아니다', score: 0 },
          { value: '1', label: '며칠 동안', score: 1 },
        ],
      },
      {
        questionNo: 2,
        questionKey: 'q2',
        questionText: '흥미나 즐거움이 줄어들었다.',
        reverseScored: false,
        options: [
          { value: '0', label: '전혀 아니다', score: 0 },
          { value: '1', label: '며칠 동안', score: 1 },
        ],
      },
    ],
    ...overrides,
  }
}

function createKmdqScaleDetail(): ScaleDetail {
  return {
    scaleCode: 'KMDQ',
    scaleName: 'K-MDQ',
    displayOrder: 4,
    questionCount: 15,
    screeningThreshold: 7,
    metadata: {
      ui: {
        kmdq: {
          impairmentQuestionNo: 15,
        },
      },
    },
    questions: [
      ...Array.from({ length: 13 }, (_, index) => ({
        questionNo: index + 1,
        questionKey: `kmdq_symptom_${index + 1}`,
        questionText: `증상 문항 ${index + 1}`,
        reverseScored: false,
        options: [
          { value: 'N', label: '아니오', score: 0 },
          { value: 'Y', label: '예', score: 1 },
        ],
      })),
      {
        questionNo: 14,
        questionKey: 'kmdq_same_period',
        questionText: '같은 시기에 벌어진 적이 있었습니까?',
        reverseScored: false,
        conditionalRequired: {
          sourceQuestionNos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
          minScoreSum: 2,
        },
        options: [
          { value: 'N', label: '아니오', score: 0 },
          { value: 'Y', label: '예', score: 0 },
        ],
      },
      {
        questionNo: 15,
        questionKey: 'kmdq_impairment',
        questionText: '이러한 일들로 인해서 문제가 발생했습니까?',
        reverseScored: false,
        options: [
          { value: 'NONE', label: '문제 없었다', score: 0 },
          { value: 'MINOR', label: '경미한 문제', score: 0 },
          { value: 'MODERATE', label: '중등도의 문제', score: 0 },
          { value: 'SERIOUS', label: '심각한 문제', score: 0 },
        ],
      },
    ],
  }
}

function createIesrScaleDetail(): ScaleDetail {
  const options = [
    { value: '0', label: '전혀 아니다', score: 0 },
    { value: '1', label: '약간 그렇다', score: 1 },
    { value: '2', label: '그런 편이다', score: 2 },
    { value: '3', label: '꽤 그렇다', score: 3 },
    { value: '4', label: '매우 그렇다', score: 4 },
  ]

  return {
    scaleCode: 'IESR',
    scaleName: 'IES-R',
    displayOrder: 8,
    questionCount: 22,
    screeningThreshold: 18,
    metadata: {
      ui: {
        formNotice: {
          title: '기간 안내',
          description:
            'IES-R는 "지난 일주일 동안" 어떠셨는지를 기준으로 응답합니다.',
        },
        preview: {
          showResultLevel: true,
          showAlertMessages: true,
        },
      },
    },
    interpretationRules: [
      { min: 0, max: 24, label: '정상' },
      { min: 25, max: 39, label: '약간 충격' },
      { min: 40, max: 59, label: '심한 충격' },
      { min: 60, max: 88, label: '매우 심한 충격' },
    ],
    alertRules: [
      { minTotalScore: 18, message: '주의 필요' },
      { minTotalScore: 25, message: '상담 권고 또는 고위험 경고' },
    ],
    questions: Array.from({ length: 22 }, (_, index) => ({
      questionNo: index + 1,
      questionKey: `iesr_q${index + 1}`,
      questionText: `IES-R 문항 ${index + 1}`,
      reverseScored: false,
      options,
    })),
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

  return <div data-testid="location-display">{location.pathname}</div>
}

function renderAssessmentSummaryPage(
  initialEntry = '/assessments/start/42/summary',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay />
      <Routes>
        <Route
          path="/assessments/start/:clientId/summary"
          element={<AssessmentSummaryPage />}
        />
        <Route
          path="/assessments/start/:clientId/scales"
          element={<div>척도 선택 화면</div>}
        />
        <Route
          path="/assessments/sessions/:sessionId"
          element={<div>세션 상세 화면</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

function initializeDraft(options?: {
  answersByScale?: Record<string, Record<number, string>>
  clientId?: number
  memo?: string
  scaleCodes?: string[]
}) {
  const clientId = options?.clientId ?? 42
  const scaleCodes = options?.scaleCodes ?? ['PHQ9']
  const answersByScale = options?.answersByScale ?? {
    PHQ9: { 1: '1', 2: '0' },
  }
  const memo = options?.memo ?? ''
  const store = useAssessmentDraftStore.getState()

  store.reset()
  store.initialize(clientId, scaleCodes)

  for (const [scaleCode, answers] of Object.entries(answersByScale)) {
    for (const [questionNo, answerValue] of Object.entries(answers)) {
      store.setAnswer(scaleCode, Number(questionNo), answerValue)
    }
  }

  store.setMemo(memo)
  useAssessmentDraftStore.setState({ startedAt: '2026-03-31T09:00:00' })
}

beforeEach(() => {
  mockedCreateAssessmentSession.mockReset()
  mockedFetchScaleDetail.mockReset()
  mockedFetchScaleDetail.mockImplementation(async (scaleCode) => {
    if (scaleCode === 'KMDQ') {
      return createKmdqScaleDetail()
    }

    if (scaleCode === 'IESR') {
      return createIesrScaleDetail()
    }

    return createScaleDetail()
  })
  useAssessmentDraftStore.getState().reset()
})

afterEach(() => {
  useAssessmentDraftStore.getState().reset()
  cleanup()
})

describe('assessment summary page', () => {
  it('renders the summary table and memo field with preview guidance', async () => {
    initializeDraft()

    renderAssessmentSummaryPage()

    expect(
      await screen.findByRole('heading', { name: '세션 요약' }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        '현재 표시는 저장 전 UX용 미리보기입니다. 최종 점수, 판정, 경고는 저장 시 서버가 다시 계산합니다.',
      ),
    ).toBeTruthy()
    expect(await screen.findByText('PHQ-9')).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /세션 메모/ })).toBeTruthy()
    expect(screen.getByText('0/1000')).toBeTruthy()
  })

  it('shows the aligned IES-R preview result and warning text on the summary table', async () => {
    initializeDraft({
      scaleCodes: ['IESR'],
      answersByScale: {
        IESR: Object.fromEntries(
          Array.from({ length: 22 }, (_, index) => [
            index + 1,
            index < 9 ? '2' : '0',
          ]),
        ) as Record<number, string>,
      },
    })

    renderAssessmentSummaryPage()

    const iesrRow = (await screen.findByText('IES-R')).closest('tr')

    expect(iesrRow).toBeTruthy()
    expect(within(iesrRow as HTMLTableRowElement).getByText('18')).toBeTruthy()
    expect(
      within(iesrRow as HTMLTableRowElement).getByText('정상'),
    ).toBeTruthy()
    expect(
      within(iesrRow as HTMLTableRowElement).getByText('주의 필요'),
    ).toBeTruthy()
  })

  it('shows an error and retry action when scale definitions fail to load', async () => {
    mockedFetchScaleDetail.mockRejectedValueOnce(new Error('load failed'))
    initializeDraft()

    renderAssessmentSummaryPage()

    expect((await screen.findByRole('alert')).textContent).toContain(
      '척도 정의를 불러오지 못했습니다.',
    )
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('recovers after retrying scale definition loading', async () => {
    const user = userEvent.setup()

    mockedFetchScaleDetail
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValueOnce(createScaleDetail())
    initializeDraft()

    renderAssessmentSummaryPage()

    expect((await screen.findByRole('alert')).textContent).toContain(
      '척도 정의를 불러오지 못했습니다.',
    )

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('PHQ-9')).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    })
  })

  it('blocks save when a selected scale is incomplete', async () => {
    const user = userEvent.setup()

    initializeDraft({
      answersByScale: {
        PHQ9: { 1: '1' },
      },
    })

    renderAssessmentSummaryPage()

    await screen.findByText('PHQ-9')
    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect(mockedCreateAssessmentSession).not.toHaveBeenCalled()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'PHQ-9 응답이 완료되지 않았습니다.',
    )
  })

  it('blocks save when the memo length exceeds the limit', async () => {
    const user = userEvent.setup()

    initializeDraft()

    renderAssessmentSummaryPage()

    await screen.findByText('PHQ-9')

    const memoField = screen.getByRole('textbox', { name: /세션 메모/ })
    fireEvent.change(memoField, { target: { value: '가'.repeat(1001) } })

    expect(screen.getByText('1001/1000')).toBeTruthy()
    expect(
      screen.getByText('세션 메모는 1000자 이내로 입력해주세요.'),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect(mockedCreateAssessmentSession).not.toHaveBeenCalled()
    expect((await screen.findByRole('alert')).textContent).toContain(
      '세션 메모는 1000자 이내로 입력해주세요.',
    )
  })

  it('prevents duplicate save requests while saving is in progress', async () => {
    const user = userEvent.setup()
    const deferred = createDeferredPromise({
      sessionId: 501,
      sessionNo: 'AS-20260331-0001',
      clientId: 42,
      status: 'COMPLETED',
      scaleCount: 1,
      hasAlert: false,
    })

    mockedCreateAssessmentSession.mockReturnValueOnce(deferred.promise)
    initializeDraft()

    renderAssessmentSummaryPage()

    await screen.findByText('PHQ-9')

    const saveButton = screen.getByRole('button', { name: '세션 저장' })

    await user.click(saveButton)

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: '저장 중...' })
          .hasAttribute('disabled'),
      ).toBe(true)
    })

    await user.click(screen.getByRole('button', { name: '저장 중...' }))

    expect(mockedCreateAssessmentSession).toHaveBeenCalledTimes(1)

    deferred.resolve({
      sessionId: 501,
      sessionNo: 'AS-20260331-0001',
      clientId: 42,
      status: 'COMPLETED',
      scaleCount: 1,
      hasAlert: false,
    })

    expect(await screen.findByText('세션 상세 화면')).toBeTruthy()
  })

  it('moves to the session detail page after a successful save and resets the draft', async () => {
    const user = userEvent.setup()

    mockedCreateAssessmentSession.mockResolvedValue({
      sessionId: 777,
      sessionNo: 'AS-20260331-0002',
      clientId: 42,
      status: 'COMPLETED',
      scaleCount: 1,
      hasAlert: false,
    })
    initializeDraft({ memo: '요약 메모' })

    renderAssessmentSummaryPage()

    await screen.findByText('PHQ-9')
    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect(await screen.findByText('세션 상세 화면')).toBeTruthy()
    expect(screen.getByTestId('location-display').textContent).toBe(
      '/assessments/sessions/777',
    )
    expect(useAssessmentDraftStore.getState().clientId).toBeNull()
    expect(useAssessmentDraftStore.getState().selectedScaleCodes).toEqual([])
  })

  it('keeps the draft state when save fails so the user can retry', async () => {
    const user = userEvent.setup()

    mockedCreateAssessmentSession.mockRejectedValueOnce(
      new Error('save failed'),
    )
    initializeDraft({ memo: '재시도 메모' })

    renderAssessmentSummaryPage()

    await screen.findByText('PHQ-9')
    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      '세션 저장에 실패했습니다.',
    )
    expect(screen.getByTestId('location-display').textContent).toBe(
      '/assessments/start/42/summary',
    )
    expect(useAssessmentDraftStore.getState().clientId).toBe(42)
    expect(useAssessmentDraftStore.getState().selectedScaleCodes).toEqual([
      'PHQ9',
    ])
    expect(useAssessmentDraftStore.getState().memo).toBe('재시도 메모')
  })

  it('blocks save when K-MDQ same-period question is required but missing', async () => {
    const user = userEvent.setup()

    initializeDraft({
      scaleCodes: ['KMDQ'],
      answersByScale: {
        KMDQ: {
          1: 'Y',
          2: 'Y',
          3: 'N',
          4: 'N',
          5: 'N',
          6: 'N',
          7: 'N',
          8: 'N',
          9: 'N',
          10: 'N',
          11: 'N',
          12: 'N',
          13: 'N',
        },
      },
    })

    renderAssessmentSummaryPage()

    expect(await screen.findByText('K-MDQ')).toBeTruthy()
    expect(screen.getByText('13 / 14')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect(mockedCreateAssessmentSession).not.toHaveBeenCalled()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'K-MDQ 응답이 완료되지 않았습니다.',
    )
  })

  it('allows K-MDQ save without impairment answer and keeps preview aligned to symptom count only', async () => {
    const user = userEvent.setup()

    mockedCreateAssessmentSession.mockResolvedValue({
      sessionId: 778,
      sessionNo: 'AS-20260331-0003',
      clientId: 42,
      status: 'COMPLETED',
      scaleCount: 1,
      hasAlert: false,
    })

    initializeDraft({
      scaleCodes: ['KMDQ'],
      answersByScale: {
        KMDQ: {
          1: 'Y',
          2: 'N',
          3: 'N',
          4: 'N',
          5: 'N',
          6: 'N',
          7: 'N',
          8: 'N',
          9: 'N',
          10: 'N',
          11: 'N',
          12: 'N',
          13: 'N',
        },
      },
    })

    renderAssessmentSummaryPage()

    expect(await screen.findByText('K-MDQ')).toBeTruthy()
    expect(screen.getByText('13 / 13')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect(mockedCreateAssessmentSession).toHaveBeenCalledTimes(1)
    expect(mockedCreateAssessmentSession.mock.calls[0]?.[0]).toEqual({
      clientId: 42,
      sessionStartedAt: '2026-03-31T09:00:00',
      sessionCompletedAt: expect.any(String),
      memo: '',
      selectedScales: [
        {
          scaleCode: 'KMDQ',
          answers: [
            { questionNo: 1, answerValue: 'Y' },
            { questionNo: 2, answerValue: 'N' },
            { questionNo: 3, answerValue: 'N' },
            { questionNo: 4, answerValue: 'N' },
            { questionNo: 5, answerValue: 'N' },
            { questionNo: 6, answerValue: 'N' },
            { questionNo: 7, answerValue: 'N' },
            { questionNo: 8, answerValue: 'N' },
            { questionNo: 9, answerValue: 'N' },
            { questionNo: 10, answerValue: 'N' },
            { questionNo: 11, answerValue: 'N' },
            { questionNo: 12, answerValue: 'N' },
            { questionNo: 13, answerValue: 'N' },
          ],
        },
      ],
    })
  })
})
