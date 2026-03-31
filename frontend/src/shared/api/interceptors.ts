import { isAxiosError, type AxiosInstance } from 'axios'

type SessionExpirationListener = () => void

const AUTH_ENDPOINT_SUFFIXES = ['/auth/login', '/auth/logout', '/auth/me'] as const
const FALLBACK_ORIGIN = 'http://localhost'

const sessionExpirationListeners = new Set<SessionExpirationListener>()

let authenticatedSessionActive = false
let sessionExpirationHandled = false

function emitSessionExpiration() {
  sessionExpirationListeners.forEach((listener) => {
    listener()
  })
}

function normalizeRequestPath(url: string | undefined) {
  if (!url) {
    return null
  }

  try {
    return new URL(url, FALLBACK_ORIGIN).pathname
  } catch {
    return null
  }
}

export function beginAuthenticatedSession() {
  authenticatedSessionActive = true
  sessionExpirationHandled = false
}

export function endAuthenticatedSession() {
  authenticatedSessionActive = false
}

export function subscribeToSessionExpiration(listener: SessionExpirationListener) {
  sessionExpirationListeners.add(listener)

  return () => {
    sessionExpirationListeners.delete(listener)
  }
}

export function isSessionExpirationError(error: unknown) {
  if (!isAxiosError(error) || error.response?.status !== 401) {
    return false
  }

  const requestPath = normalizeRequestPath(error.config?.url)

  if (!requestPath) {
    return true
  }

  return !AUTH_ENDPOINT_SUFFIXES.some((suffix) => requestPath.endsWith(suffix))
}

export function createSessionExpirationResponseErrorInterceptor(
  notifySessionExpiration: SessionExpirationListener = emitSessionExpiration,
) {
  return (error: unknown) => {
    if (authenticatedSessionActive && isSessionExpirationError(error) && !sessionExpirationHandled) {
      sessionExpirationHandled = true
      notifySessionExpiration()
    }

    return Promise.reject(error)
  }
}

export function attachSessionExpirationInterceptor(http: AxiosInstance) {
  http.interceptors.response.use((response) => response, createSessionExpirationResponseErrorInterceptor())
}
