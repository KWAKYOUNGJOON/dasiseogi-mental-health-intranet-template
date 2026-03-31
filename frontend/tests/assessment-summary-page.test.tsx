import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function renderAssessmentSummaryPage(initialEntry = '/assessments/start/42/summary') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay />
      <Routes>
        <Route path="/assessments/start/:clientId/summary" element={<AssessmentSummaryPage />} />
        <Route path="/assessments/start/:clientId/scales" element={<div>척도 선택 화면</div>} />
        <Route path="/assessments/sessions/:sessionId" element={<div>세션 상세 화면</div>} />
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
  const answersByScale = options?.answersByScale ?? { PHQ9: { 1: '1', 2: '0' } }
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
  mockedFetchScaleDetail.mockResolvedValue(createScaleDetail())
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

    expect(await screen.findByRole('heading', { name: '세션 요약' })).toBeTruthy()
    expect(screen.getByText('현재 표시는 저장 전 UX용 미리보기입니다. 최종 점수, 판정, 경고는 저장 시 서버가 다시 계산합니다.')).toBeTruthy()
    expect(await screen.findByText('PHQ-9')).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /세션 메모/ })).toBeTruthy()
    expect(screen.getByText('0/1000')).toBeTruthy()
  })

  it('shows an error and retry action when scale definitions fail to load', async () => {
    mockedFetchScaleDetail.mockRejectedValueOnce(new Error('load failed'))
    initializeDraft()

    renderAssessmentSummaryPage()

    expect((await screen.findByRole('alert')).textContent).toContain('척도 정의를 불러오지 못했습니다.')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('recovers after retrying scale definition loading', async () => {
    const user = userEvent.setup()

    mockedFetchScaleDetail.mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce(createScaleDetail())
    initializeDraft()

    renderAssessmentSummaryPage()

    expect((await screen.findByRole('alert')).textContent).toContain('척도 정의를 불러오지 못했습니다.')

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
    expect((await screen.findByRole('alert')).textContent).toContain('PHQ-9 응답이 완료되지 않았습니다.')
  })

  it('blocks save when the memo length exceeds the limit', async () => {
    const user = userEvent.setup()

    initializeDraft()

    renderAssessmentSummaryPage()

    await screen.findByText('PHQ-9')

    const memoField = screen.getByRole('textbox', { name: /세션 메모/ })
    fireEvent.change(memoField, { target: { value: '가'.repeat(1001) } })

    expect(screen.getByText('1001/1000')).toBeTruthy()
    expect(screen.getByText('세션 메모는 1000자 이내로 입력해주세요.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect(mockedCreateAssessmentSession).not.toHaveBeenCalled()
    expect((await screen.findByRole('alert')).textContent).toContain('세션 메모는 1000자 이내로 입력해주세요.')
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
      expect(screen.getByRole('button', { name: '저장 중...' }).hasAttribute('disabled')).toBe(true)
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
    expect(screen.getByTestId('location-display').textContent).toBe('/assessments/sessions/777')
    expect(useAssessmentDraftStore.getState().clientId).toBeNull()
    expect(useAssessmentDraftStore.getState().selectedScaleCodes).toEqual([])
  })

  it('keeps the draft state when save fails so the user can retry', async () => {
    const user = userEvent.setup()

    mockedCreateAssessmentSession.mockRejectedValueOnce(new Error('save failed'))
    initializeDraft({ memo: '재시도 메모' })

    renderAssessmentSummaryPage()

    await screen.findByText('PHQ-9')
    await user.click(screen.getByRole('button', { name: '세션 저장' }))

    expect((await screen.findByRole('alert')).textContent).toContain('세션 저장에 실패했습니다.')
    expect(screen.getByTestId('location-display').textContent).toBe('/assessments/start/42/summary')
    expect(useAssessmentDraftStore.getState().clientId).toBe(42)
    expect(useAssessmentDraftStore.getState().selectedScaleCodes).toEqual(['PHQ9'])
    expect(useAssessmentDraftStore.getState().memo).toBe('재시도 메모')
  })
})
