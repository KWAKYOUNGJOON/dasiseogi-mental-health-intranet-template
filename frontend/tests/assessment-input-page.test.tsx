import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchScaleDetail, type ScaleDetail } from '../src/features/assessment/api/assessmentApi'
import { useAssessmentDraftStore } from '../src/features/assessment/store/assessmentDraftStore'
import { AssessmentInputPage } from '../src/pages/assessment/AssessmentInputPage'

vi.mock('../src/features/assessment/api/assessmentApi', () => ({
  createAssessmentSession: vi.fn(),
  fetchAssessmentRecords: vi.fn(),
  fetchScaleDetail: vi.fn(),
  fetchScales: vi.fn(),
  fetchSessionDetail: vi.fn(),
  fetchSessionPrintData: vi.fn(),
  markSessionMisentered: vi.fn(),
}))

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

function LocationDisplay() {
  const location = useLocation()

  return <div data-testid="location-display">{location.pathname}</div>
}

function renderAssessmentInputPage(initialEntry = '/assessments/start/42/input') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay />
      <Routes>
        <Route path="/assessments/start/:clientId/input" element={<AssessmentInputPage />} />
        <Route path="/assessments/start/:clientId/summary" element={<div>세션 요약 화면</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function findQuestionLegend(questionText: string) {
  const questionNode = screen.getByText(questionText)
  const questionLegend = questionNode.closest('legend')

  if (!questionLegend) {
    throw new Error(`Question legend not found for: ${questionText}`)
  }

  return questionLegend
}

function getAnswerOption(questionText: string, answerLabel: string) {
  const questionFieldset = findQuestionLegend(questionText).closest('fieldset')

  if (!questionFieldset) {
    throw new Error(`Question fieldset not found for: ${questionText}`)
  }

  const label = within(questionFieldset).getByText(answerLabel).closest('label')

  if (!label) {
    throw new Error(`Answer label not found for: ${answerLabel}`)
  }

  return {
    label,
    radio: within(questionFieldset).getByLabelText(answerLabel) as HTMLInputElement,
  }
}

beforeEach(() => {
  mockedFetchScaleDetail.mockReset()
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
            questionKey: 'g1',
            questionText: '초조하거나 불안감을 느꼈다.',
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

  useAssessmentDraftStore.getState().reset()
  useAssessmentDraftStore.getState().initialize(42, ['PHQ9', 'GAD7'])
})

afterEach(() => {
  useAssessmentDraftStore.getState().reset()
  cleanup()
})

describe('assessment input page', () => {
  it('renders the current scale questions and progress state for the first selected scale', async () => {
    renderAssessmentInputPage()

    await waitFor(() => {
      expect(mockedFetchScaleDetail).toHaveBeenCalledWith('PHQ9')
    })

    expect(await screen.findByRole('heading', { name: 'PHQ-9 입력' })).toBeTruthy()
    expect(findQuestionLegend('기분이 가라앉거나 우울감을 느꼈다.')).toBeTruthy()
    expect(findQuestionLegend('흥미나 즐거움이 줄어들었다.')).toBeTruthy()
    expect(screen.getByText('1. PHQ9').getAttribute('aria-current')).toBe('step')
    expect(screen.getByText('2. GAD7').getAttribute('aria-current')).toBe(null)
    expect(screen.getByText('응답 완료')).toBeTruthy()
    expect(screen.getByRole('region', { name: '문항 이동' })).toBeTruthy()
  })

  it('allows answering questions and keeps next disabled until the current scale is complete', async () => {
    const user = userEvent.setup()

    renderAssessmentInputPage()

    const nextButton = await screen.findByRole('button', { name: '다음' })
    const previousButton = screen.getByRole('button', { name: '이전' })

    expect(previousButton.hasAttribute('disabled')).toBe(true)
    expect(nextButton.hasAttribute('disabled')).toBe(true)

    const firstAnswer = getAnswerOption('기분이 가라앉거나 우울감을 느꼈다.', '며칠 동안')
    await user.click(firstAnswer.label)

    expect(firstAnswer.radio.checked).toBe(true)
    expect(useAssessmentDraftStore.getState().answersByScale.PHQ9?.[1]).toBe('1')
    expect(nextButton.hasAttribute('disabled')).toBe(true)
    expect(screen.getAllByText(/1 \/ 2/).length).toBeGreaterThan(0)

    const secondAnswer = getAnswerOption('흥미나 즐거움이 줄어들었다.', '전혀 아니다')
    await user.click(secondAnswer.label)

    expect(secondAnswer.radio.checked).toBe(true)
    expect(useAssessmentDraftStore.getState().answersByScale.PHQ9?.[2]).toBe('0')
    expect(nextButton.hasAttribute('disabled')).toBe(false)
    expect(screen.getAllByText(/2 \/ 2/).length).toBeGreaterThan(0)
  })

  it('moves to the next scale after completion and preserves answers when navigating back', async () => {
    const user = userEvent.setup()

    renderAssessmentInputPage()

    await waitFor(() => {
      expect(findQuestionLegend('기분이 가라앉거나 우울감을 느꼈다.')).toBeTruthy()
    })
    await user.click(getAnswerOption('기분이 가라앉거나 우울감을 느꼈다.', '며칠 동안').label)
    await user.click(getAnswerOption('흥미나 즐거움이 줄어들었다.', '전혀 아니다').label)
    await user.click(screen.getByRole('button', { name: '다음' }))

    await waitFor(() => {
      expect(mockedFetchScaleDetail).toHaveBeenCalledWith('GAD7')
    })

    expect(await screen.findByRole('heading', { name: 'GAD-7 입력' })).toBeTruthy()
    expect(findQuestionLegend('초조하거나 불안감을 느꼈다.')).toBeTruthy()
    expect(useAssessmentDraftStore.getState().currentScaleIndex).toBe(1)

    await user.click(screen.getByRole('button', { name: '이전' }))

    expect(await screen.findByRole('heading', { name: 'PHQ-9 입력' })).toBeTruthy()
    expect(useAssessmentDraftStore.getState().currentScaleIndex).toBe(0)
    expect(getAnswerOption('기분이 가라앉거나 우울감을 느꼈다.', '며칠 동안').radio.checked).toBe(true)
    expect(getAnswerOption('흥미나 즐거움이 줄어들었다.', '전혀 아니다').radio.checked).toBe(true)
  })

  it('moves to the summary route after the last scale is completed', async () => {
    const user = userEvent.setup()

    renderAssessmentInputPage()

    await waitFor(() => {
      expect(findQuestionLegend('기분이 가라앉거나 우울감을 느꼈다.')).toBeTruthy()
    })
    await user.click(getAnswerOption('기분이 가라앉거나 우울감을 느꼈다.', '며칠 동안').label)
    await user.click(getAnswerOption('흥미나 즐거움이 줄어들었다.', '전혀 아니다').label)
    await user.click(screen.getByRole('button', { name: '다음' }))

    await screen.findByRole('heading', { name: 'GAD-7 입력' })

    await user.click(getAnswerOption('초조하거나 불안감을 느꼈다.', '며칠 동안').label)
    await user.click(screen.getByRole('button', { name: '다음' }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/assessments/start/42/summary')
    })

    expect(screen.getByText('세션 요약 화면')).toBeTruthy()
  })

  it('shows guidance when the draft state is empty', async () => {
    useAssessmentDraftStore.getState().reset()

    renderAssessmentInputPage()

    expect(await screen.findByText('선택된 척도 정보가 없습니다. 척도 선택부터 다시 시작해주세요.')).toBeTruthy()
    expect(screen.getByRole('link', { name: '척도 선택으로 돌아가기' }).getAttribute('href')).toBe('/assessments/start/42')
  })
})
