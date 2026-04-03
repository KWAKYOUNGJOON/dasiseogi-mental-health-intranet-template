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

import { fetchMeOrNull, updateMyProfile } from '../src/features/auth/api/authApi'

describe('auth api', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPatch.mockReset()
    mockPost.mockReset()
  })

  it('returns null when /auth/me responds with 401', async () => {
    mockGet.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
      },
    })

    await expect(fetchMeOrNull()).resolves.toBeNull()
  })

  it('rethrows non-401 failures from /auth/me', async () => {
    const requestError = {
      isAxiosError: true,
      response: {
        status: 500,
      },
    }

    mockGet.mockRejectedValue(requestError)

    await expect(fetchMeOrNull()).rejects.toBe(requestError)
  })

  it('rethrows network failures from /auth/me', async () => {
    const requestError = new Error('network')

    mockGet.mockRejectedValue(requestError)

    await expect(fetchMeOrNull()).rejects.toBe(requestError)
  })

  it('patches /auth/me when the current user updates their own profile', async () => {
    mockPatch.mockResolvedValue({
      data: {
        data: {
          id: 1,
          loginId: 'usera',
          name: '수정 사용자',
          phone: '010-9999-8888',
          positionName: '선임 상담사',
          teamName: '통합지원팀',
          role: 'USER',
          status: 'ACTIVE',
        },
      },
    })

    await expect(
      updateMyProfile({
        name: '수정 사용자',
        phone: '010-9999-8888',
        teamName: '통합지원팀',
      }),
    ).resolves.toMatchObject({
      name: '수정 사용자',
      phone: '010-9999-8888',
    })

    expect(mockPatch).toHaveBeenCalledWith('/auth/me', {
      name: '수정 사용자',
      phone: '010-9999-8888',
      teamName: '통합지원팀',
    })
  })
})
