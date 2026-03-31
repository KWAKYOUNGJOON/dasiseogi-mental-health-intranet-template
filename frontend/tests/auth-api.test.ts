import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('../src/shared/api/http', () => ({
  http: {
    get: mockGet,
    post: mockPost,
  },
}))

import { fetchMeOrNull } from '../src/features/auth/api/authApi'

describe('auth api', () => {
  beforeEach(() => {
    mockGet.mockReset()
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
})
