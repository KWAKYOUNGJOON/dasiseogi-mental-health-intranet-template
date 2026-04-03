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
})
