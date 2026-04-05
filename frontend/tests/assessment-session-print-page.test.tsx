import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSessionPrintData } from '../src/features/assessment/api/assessmentApi'
import { AssessmentSessionPrintPage } from '../src/pages/assessment/AssessmentSessionPrintPage'

vi.mock('../src/features/assessment/api/assessmentApi', () => ({
  fetchSessionPrintData: vi.fn(),
}))

const mockedFetchSessionPrintData = vi.mocked(fetchSessionPrintData)

function renderPrintPage() {
  return render(
    <MemoryRouter initialEntries={['/assessments/sessions/901/print']}>
      <Routes>
        <Route path="/assessments/sessions/:sessionId/print" element={<AssessmentSessionPrintPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetchSessionPrintData.mockReset()
  mockedFetchSessionPrintData.mockResolvedValue({
    institutionName: '다시서기',
    teamName: '정신건강팀',
    performedByName: '김담당',
    sessionNo: 'AS-20260331-0001',
    sessionStartedAt: '2026-03-31T09:00:00',
    sessionCompletedAt: '2026-03-31T09:20:00',
    client: {
      clientId: 42,
      clientNo: 'CL-00042',
      name: '김대상',
      birthDate: '1990-01-02',
      gender: 'MALE',
    },
    scales: [
      {
        scaleCode: 'PHQ9',
        scaleName: 'PHQ-9',
        totalScore: 8,
        resultLevel: '중등도',
        alertMessages: [],
      },
    ],
    hasAlert: false,
    scaleCount: 1,
    alertCount: 0,
    summaryText: '총 1개 척도 시행, 경고 없음',
  })
})

afterEach(() => {
  cleanup()
})

describe('assessment session print page', () => {
  it('renders the completed datetime with a blank separator instead of T', async () => {
    renderPrintPage()

    expect(await screen.findByText('남성')).toBeTruthy()
    expect(await screen.findByText('2026-03-31 09:20:00')).toBeTruthy()
    expect(screen.queryByText('2026-03-31T09:20:00')).toBeNull()
  })

  it('renders server-provided result details for CRI print output', async () => {
    mockedFetchSessionPrintData.mockResolvedValueOnce({
      institutionName: '다시서기',
      teamName: '정신건강팀',
      performedByName: '김담당',
      sessionNo: 'AS-20260331-0002',
      sessionStartedAt: '2026-03-31T09:00:00',
      sessionCompletedAt: '2026-03-31T09:20:00',
      client: {
        clientId: 42,
        clientNo: 'CL-00042',
        name: '김대상',
        birthDate: '1990-01-02',
        gender: 'MALE',
      },
      scales: [
        {
          scaleCode: 'CRI',
          scaleName: '정신과적 위기 분류 평정척도 (CRI)',
          totalScore: 2,
          resultLevel: 'A - 극도의 위기',
          resultDetails: [
            { key: 'selfOtherTotal', label: '자타해 위험 합계', value: '2' },
            { key: 'risk8PlusMental', label: '자타해 위험 8번 + 정신상태 합계', value: '1' },
          ],
          alertMessages: [],
        },
      ],
      hasAlert: false,
      scaleCount: 1,
      alertCount: 0,
      summaryText: '총 1개 척도 시행, 경고 없음',
    })

    renderPrintPage()

    expect(await screen.findByText('A - 극도의 위기')).toBeTruthy()
    expect(screen.getByText('자타해 위험 합계: 2')).toBeTruthy()
    expect(screen.getByText('자타해 위험 8번 + 정신상태 합계: 1')).toBeTruthy()
  })
})
