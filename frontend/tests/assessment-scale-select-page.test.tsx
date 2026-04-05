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
  mockedFetchScales.mockResolvedValue([
    createScaleListItem(),
    createScaleListItem({
      scaleCode: 'GAD7',
      scaleName: 'GAD-7',
      displayOrder: 2,
    }),
  ])
  useAssessmentDraftStore.getState().reset()
})

afterEach(() => {
  useAssessmentDraftStore.getState().reset()
  cleanup()
})

describe('assessment scale select page', () => {
  it('renders the scale list when the page opens', async () => {
    renderAssessmentScaleSelectPage()

    await waitFor(() => {
      expect(mockedFetchScales).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByRole('heading', { name: '척도 선택' })).toBeTruthy()
    expect(screen.getByText('PHQ-9')).toBeTruthy()
    expect(screen.getByText('GAD-7')).toBeTruthy()
    expect(screen.getByText(/대상자 ID 42/)).toBeTruthy()
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
        displayOrder: 2,
      }),
      createScaleListItem({
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
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
        displayOrder: 9,
      }),
    ])

    renderAssessmentScaleSelectPage()

    const criCheckbox = await screen.findByRole('checkbox', { name: /정신과적 위기 분류 평정척도 \(CRI\)/ })

    expect(screen.getByText('정신과적 위기 분류 평정척도 (CRI)')).toBeTruthy()

    await user.click(criCheckbox)
    await user.click(screen.getByRole('button', { name: '검사 시작' }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/assessments/start/42/input')
    })

    const draftState = useAssessmentDraftStore.getState()

    expect(draftState.clientId).toBe(42)
    expect(draftState.selectedScaleCodes).toEqual(['CRI'])
  })
})
