import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGet, mockPatch, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('../src/shared/api/http', () => ({
  http: {
    get: mockGet,
    patch: mockPatch,
    post: mockPost,
  },
}))

import { fetchClientScaleTrend } from '../src/features/clients/api/clientApi'

describe('client api', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPatch.mockReset()
    mockPost.mockReset()
  })

  it('fetches a single client scale trend from the new client trend endpoint', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          scaleCode: 'PHQ9',
          scaleName: 'PHQ-9',
          maxScore: 27,
          cutoffs: [
            { score: 5, label: '경도' },
            { score: 10, label: '중등도' },
          ],
          points: [
            {
              sessionId: 101,
              sessionScaleId: 201,
              assessedAt: '2026-04-01 09:00:00',
              createdAt: '2026-04-01 09:05:00',
              totalScore: 12,
              resultLevel: '중등도',
              alerts: [
                {
                  id: 301,
                  scaleCode: 'PHQ9',
                  alertType: 'CRITICAL_ITEM',
                  alertCode: 'PHQ9_ITEM9_ANY',
                  alertMessage: '추가 안전 확인이 필요합니다.',
                  questionNo: 9,
                  triggerValue: '3',
                },
              ],
            },
          ],
        },
      },
    })

    await expect(fetchClientScaleTrend(42, 'PHQ9')).resolves.toEqual({
      scaleCode: 'PHQ9',
      scaleName: 'PHQ-9',
      maxScore: 27,
      cutoffs: [
        { score: 5, label: '경도' },
        { score: 10, label: '중등도' },
      ],
      points: [
        {
          sessionId: 101,
          sessionScaleId: 201,
          assessedAt: '2026-04-01 09:00:00',
          createdAt: '2026-04-01 09:05:00',
          totalScore: 12,
          resultLevel: '중등도',
          alerts: [
            {
              id: 301,
              scaleCode: 'PHQ9',
              alertType: 'CRITICAL_ITEM',
              alertCode: 'PHQ9_ITEM9_ANY',
              alertMessage: '추가 안전 확인이 필요합니다.',
              questionNo: 9,
              triggerValue: '3',
            },
          ],
        },
      ],
    })

    expect(mockGet).toHaveBeenCalledWith('/clients/42/scale-trends/PHQ9')
  })
})
