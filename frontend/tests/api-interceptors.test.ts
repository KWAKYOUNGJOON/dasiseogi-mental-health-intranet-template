import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  beginAuthenticatedSession,
  createSessionExpirationResponseErrorInterceptor,
  endAuthenticatedSession,
  subscribeToSessionExpiration,
} from '../src/shared/api/interceptors'

function createAxiosError(status: number, url: string) {
  return {
    isAxiosError: true,
    config: {
      url,
    },
    response: {
      status,
    },
  }
}

describe('api interceptors', () => {
  beforeEach(() => {
    endAuthenticatedSession()
  })

  afterEach(() => {
    endAuthenticatedSession()
  })

  it('notifies the session expiration listener once when an authenticated protected request returns 401', async () => {
    const sessionExpiredListener = vi.fn()
    const unsubscribe = subscribeToSessionExpiration(sessionExpiredListener)
    const handleResponseError = createSessionExpirationResponseErrorInterceptor()
    const requestError = createAxiosError(401, '/clients')

    beginAuthenticatedSession()

    await expect(handleResponseError(requestError)).rejects.toBe(requestError)
    await expect(handleResponseError(requestError)).rejects.toBe(requestError)

    expect(sessionExpiredListener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('ignores initial /auth/me 401 failures', async () => {
    const sessionExpiredListener = vi.fn()
    const unsubscribe = subscribeToSessionExpiration(sessionExpiredListener)
    const handleResponseError = createSessionExpirationResponseErrorInterceptor()
    const requestError = createAxiosError(401, '/api/v1/auth/me')

    beginAuthenticatedSession()

    await expect(handleResponseError(requestError)).rejects.toBe(requestError)

    expect(sessionExpiredListener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('ignores non-401 protected request failures', async () => {
    const sessionExpiredListener = vi.fn()
    const unsubscribe = subscribeToSessionExpiration(sessionExpiredListener)
    const handleResponseError = createSessionExpirationResponseErrorInterceptor()
    const requestError = createAxiosError(500, '/clients')

    beginAuthenticatedSession()

    await expect(handleResponseError(requestError)).rejects.toBe(requestError)

    expect(sessionExpiredListener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('ignores stale 401 failures after the authenticated session has ended', async () => {
    const sessionExpiredListener = vi.fn()
    const unsubscribe = subscribeToSessionExpiration(sessionExpiredListener)
    const handleResponseError = createSessionExpirationResponseErrorInterceptor()
    const requestError = createAxiosError(401, '/clients')

    beginAuthenticatedSession()
    endAuthenticatedSession()

    await expect(handleResponseError(requestError)).rejects.toBe(requestError)

    expect(sessionExpiredListener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
