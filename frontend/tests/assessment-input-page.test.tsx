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

function createKmdqScaleDetail(): ScaleDetail {
  return {
    scaleCode: 'KMDQ',
    scaleName: 'K-MDQ',
    displayOrder: 4,
    questionCount: 15,
    screeningThreshold: 7,
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
    questions: Array.from({ length: 22 }, (_, index) => ({
      questionNo: index + 1,
      questionKey: `iesr_q${index + 1}`,
      questionText:
        index === 0
          ? '그 사건을 떠올리게 하는 어떤 것이 나에게 그때의 감정을 다시 불러 일으켰다'
          : `IES-R 문항 ${index + 1}`,
      reverseScored: false,
      options,
    })),
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

    if (scaleCode === 'KMDQ') {
      return createKmdqScaleDetail()
    }

    if (scaleCode === 'IESR') {
      return createIesrScaleDetail()
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

  it('shows the IES-R specific past-week guidance on the input form', async () => {
    useAssessmentDraftStore.getState().reset()
    useAssessmentDraftStore.getState().initialize(42, ['IESR'])

    renderAssessmentInputPage()

    expect(await screen.findByRole('heading', { name: 'IES-R 입력' })).toBeTruthy()
    expect(screen.getByText('기간 안내')).toBeTruthy()
    expect(screen.getByText('IES-R는 "지난 일주일 동안" 어떠셨는지를 기준으로 응답합니다.')).toBeTruthy()
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

  it('toggles K-MDQ conditional questions without deleting existing answers', async () => {
    const user = userEvent.setup()
    const store = useAssessmentDraftStore.getState()

    store.reset()
    store.initialize(42, ['KMDQ'])
    for (let questionNo = 2; questionNo <= 13; questionNo += 1) {
      store.setAnswer('KMDQ', questionNo, 'N')
    }

    renderAssessmentInputPage()

    await waitFor(() => {
      expect(mockedFetchScaleDetail).toHaveBeenCalledWith('KMDQ')
    })

    expect(await screen.findByRole('heading', { name: 'K-MDQ 입력' })).toBeTruthy()
    expect(screen.queryByText('같은 시기에 벌어진 적이 있었습니까?')).toBeNull()
    expect(screen.queryByText('이러한 일들로 인해서 문제가 발생했습니까?')).toBeNull()

    await user.click(getAnswerOption('증상 문항 1', '예').label)

    expect(screen.queryByText('같은 시기에 벌어진 적이 있었습니까?')).toBeNull()
    expect(screen.getByText('이러한 일들로 인해서 문제가 발생했습니까?')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다음' }).hasAttribute('disabled')).toBe(false)

    await user.click(getAnswerOption('증상 문항 2', '예').label)

    expect(screen.getByText('같은 시기에 벌어진 적이 있었습니까?')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다음' }).hasAttribute('disabled')).toBe(true)

    await user.click(getAnswerOption('같은 시기에 벌어진 적이 있었습니까?', '예').label)

    expect(useAssessmentDraftStore.getState().answersByScale.KMDQ?.[14]).toBe('Y')
    expect(screen.getByRole('button', { name: '다음' }).hasAttribute('disabled')).toBe(false)

    await user.click(getAnswerOption('증상 문항 2', '아니오').label)

    expect(useAssessmentDraftStore.getState().answersByScale.KMDQ?.[14]).toBe('Y')
    expect(screen.queryByText('같은 시기에 벌어진 적이 있었습니까?')).toBeNull()
    expect(screen.getByRole('button', { name: '다음' }).hasAttribute('disabled')).toBe(false)
  })
})
