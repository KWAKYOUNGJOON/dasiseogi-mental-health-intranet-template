import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchScales, type ScaleListItem } from '../src/features/assessment/api/assessmentApi'
import { useAssessmentDraftStore } from '../src/features/assessment/store/assessmentDraftStore'
import { AssessmentScaleSelectPage } from '../src/pages/assessment/AssessmentScaleSelectPage'

vi.mock('../src/features/assessment/api/assessmentApi', () => ({
  createAssessmentSession: vi.fn(),
  fetchAssessmentRecords: vi.fn(),
  fetchScaleDetail: vi.fn(),
  fetchScales: vi.fn(),
  fetchSessionDetail: vi.fn(),
  fetchSessionPrintData: vi.fn(),
  markSessionMisentered: vi.fn(),
}))

const mockedFetchScales = vi.mocked(fetchScales)

const SCALE_SELECTION_CARD_EXPECTATIONS = [
  { scaleCode: 'PHQ9', scaleName: 'PHQ-9', selectionTitle: 'PHQ-9', selectionSubtitle: '우울', displayOrder: 1 },
  { scaleCode: 'GAD7', scaleName: 'GAD-7', selectionTitle: 'GAD-7', selectionSubtitle: '불안', displayOrder: 2 },
  { scaleCode: 'MKPQ16', scaleName: 'mKPQ-16', selectionTitle: 'mKPQ-16', selectionSubtitle: '정신증 위험', displayOrder: 3 },
  { scaleCode: 'KMDQ', scaleName: 'K-MDQ', selectionTitle: 'K-MDQ', selectionSubtitle: '양극성(조울증)', displayOrder: 4 },
  { scaleCode: 'PSS10', scaleName: 'PSS-10', selectionTitle: 'PSS-10', selectionSubtitle: '스트레스', displayOrder: 5 },
  { scaleCode: 'ISIK', scaleName: 'ISI-K', selectionTitle: 'ISI-K', selectionSubtitle: '불면', displayOrder: 6 },
  { scaleCode: 'AUDITK', scaleName: 'AUDIT-K', selectionTitle: 'AUDIT-K', selectionSubtitle: '알코올 사용', displayOrder: 7 },
  { scaleCode: 'IESR', scaleName: 'IES-R', selectionTitle: 'IES-R', selectionSubtitle: '외상 후 스트레스(PTSD)', displayOrder: 8 },
  {
    scaleCode: 'CRI',
    scaleName: '정신과적 위기 분류 평정척도 (CRI)',
    selectionTitle: 'CRI',
    selectionSubtitle: '정신과적 위기 분류 평정척도',
    displayOrder: 9,
  },
] satisfies Array<{
  displayOrder: number
  scaleCode: string
  scaleName: string
  selectionSubtitle: string
  selectionTitle: string
}>

const ALL_SCALE_LIST_ITEMS = SCALE_SELECTION_CARD_EXPECTATIONS.map(
  ({ scaleCode, scaleName, selectionTitle, selectionSubtitle, displayOrder }) =>
    createScaleListItem({
      displayOrder,
      scaleCode,
      scaleName,
      selectionTitle,
      selectionSubtitle,
    }),
)

function createScaleListItem(overrides?: Partial<ScaleListItem>): ScaleListItem {
  return {
    scaleCode: 'PHQ9',
    scaleName: 'PHQ-9',
    selectionTitle: 'PHQ-9',
    selectionSubtitle: '우울',
    displayOrder: 1,
    isActive: true,
    implemented: true,
    ...overrides,
  }
}

function LocationDisplay() {
  const location = useLocation()

  return <div data-testid="location-display">{location.pathname}</div>
}

function renderAssessmentScaleSelectPage(initialEntry = '/assessments/start/42') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay />
      <Routes>
        <Route path="/assessments/start/:clientId" element={<AssessmentScaleSelectPage />} />
        <Route path="/assessments/start/:clientId/input" element={<div>척도 입력 화면</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetchScales.mockReset()
  mockedFetchScales.mockResolvedValue(ALL_SCALE_LIST_ITEMS)
  useAssessmentDraftStore.getState().reset()
})

afterEach(() => {
  useAssessmentDraftStore.getState().reset()
  cleanup()
})

describe('assessment scale select page', () => {
  it('renders all nine scale cards with the API selectionTitle/selectionSubtitle pairs when the page opens', async () => {
    renderAssessmentScaleSelectPage()

    await waitFor(() => {
      expect(mockedFetchScales).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByRole('heading', { name: '척도 선택' })).toBeTruthy()
    expect(screen.getAllByRole('checkbox')).toHaveLength(SCALE_SELECTION_CARD_EXPECTATIONS.length)
    expect(screen.getByText(/대상자 ID 42/)).toBeTruthy()

    for (const { selectionTitle, selectionSubtitle } of SCALE_SELECTION_CARD_EXPECTATIONS) {
      expect(screen.getByText(selectionTitle)).toBeTruthy()
      expect(screen.getByText(selectionSubtitle)).toBeTruthy()
    }

    expect(screen.queryByText('정신과적 위기 분류 평정척도 (CRI)')).toBeNull()
    expect(screen.queryByText('현재 사용 가능')).toBeNull()
  })

  it('does not move to the next step without selecting any scale', async () => {
    const user = userEvent.setup()

    renderAssessmentScaleSelectPage()

    const startButton = await screen.findByRole('button', { name: '검사 시작' })

    expect(startButton.hasAttribute('disabled')).toBe(true)
    await user.click(startButton)

    expect(screen.getByTestId('location-display').textContent).toBe('/assessments/start/42')
    expect(useAssessmentDraftStore.getState().selectedScaleCodes).toEqual([])
  })

  it('moves to /assessments/start/:clientId/input and stores selected scaleCodes in displayOrder order', async () => {
    const user = userEvent.setup()

    mockedFetchScales.mockResolvedValue([
      createScaleListItem({
        scaleCode: 'GAD7',
        scaleName: 'GAD-7',
        selectionTitle: 'GAD-7',
        selectionSubtitle: '불안',
        displayOrder: 2,
      }),
      createScaleListItem({
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        selectionTitle: 'PHQ-9',
        selectionSubtitle: '우울',
        displayOrder: 1,
      }),
    ])

    renderAssessmentScaleSelectPage()

    await user.click(await screen.findByRole('checkbox', { name: /GAD-7/ }))
    await user.click(screen.getByRole('checkbox', { name: /PHQ-9/ }))
    await user.click(screen.getByRole('button', { name: '검사 시작' }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/assessments/start/42/input')
    })

    const draftState = useAssessmentDraftStore.getState()

    expect(draftState.clientId).toBe(42)
    expect(draftState.selectedScaleCodes).toEqual(['PHQ9', 'GAD7'])
  })

  it('shows CRI in the scale list, stores only CRI in the draft, and moves to the input step', async () => {
    const user = userEvent.setup()

    mockedFetchScales.mockResolvedValue([
      createScaleListItem(),
      createScaleListItem({
        scaleCode: 'CRI',
        scaleName: '정신과적 위기 분류 평정척도 (CRI)',
        selectionTitle: 'CRI',
        selectionSubtitle: '정신과적 위기 분류 평정척도',
        displayOrder: 9,
      }),
    ])

    renderAssessmentScaleSelectPage()

    const criCheckbox = await screen.findByRole('checkbox', { name: /CRI/ })

    expect(screen.getByText('CRI')).toBeTruthy()
    expect(screen.getByText('정신과적 위기 분류 평정척도')).toBeTruthy()
    expect(screen.queryByText('정신과적 위기 분류 평정척도 (CRI)')).toBeNull()
    expect(screen.queryByText('현재 사용 가능')).toBeNull()

    await user.click(criCheckbox)
    await user.click(screen.getByRole('button', { name: '검사 시작' }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/assessments/start/42/input')
    })

    const draftState = useAssessmentDraftStore.getState()

    expect(draftState.clientId).toBe(42)
    expect(draftState.selectedScaleCodes).toEqual(['CRI'])
  })

  it('falls back to scaleName and hides subtitle when selection metadata is missing', async () => {
    mockedFetchScales.mockResolvedValue([
      createScaleListItem({
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        selectionTitle: undefined,
        selectionSubtitle: undefined,
      }),
    ])

    renderAssessmentScaleSelectPage()

    expect(await screen.findByText('PHQ-9')).toBeTruthy()
    expect(screen.queryByText('우울')).toBeNull()
  })
})
