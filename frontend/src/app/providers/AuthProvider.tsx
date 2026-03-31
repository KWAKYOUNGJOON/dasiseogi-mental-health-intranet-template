import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SESSION_EXPIRED_NOTICE } from '../../features/auth/api/loginApi'
import { fetchMeOrNull, login as loginApi, logout as logoutApi, type AuthUser } from '../../features/auth/api/authApi'
import {
  beginAuthenticatedSession,
  endAuthenticatedSession,
  subscribeToSessionExpiration,
} from '../../shared/api/interceptors'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'auth-check-error'
export type AuthRedirectNotice = typeof SESSION_EXPIRED_NOTICE

interface AuthContextValue {
  authNotice: AuthRedirectNotice | null
  user: AuthUser | null
  initialized: boolean
  status: AuthStatus
  login: (loginId: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [authNotice, setAuthNotice] = useState<AuthRedirectNotice | null>(null)
  const initialized = status !== 'loading'

  const applyAuthState = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser)
    setStatus(nextUser ? 'authenticated' : 'unauthenticated')
    setAuthNotice(null)

    if (nextUser) {
      beginAuthenticatedSession()
      return
    }

    endAuthenticatedSession()
  }, [])

  const applyAuthCheckError = useCallback(() => {
    setStatus('auth-check-error')
    setAuthNotice(null)
    endAuthenticatedSession()
  }, [])

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMeOrNull()
      applyAuthState(me)
    } catch {
      applyAuthCheckError()
    }
  }, [applyAuthCheckError, applyAuthState])

  useEffect(() => {
    endAuthenticatedSession()
    void refresh()
  }, [refresh])

  const applySessionExpired = useCallback(() => {
    setUser(null)
    setStatus('unauthenticated')
    setAuthNotice(SESSION_EXPIRED_NOTICE)
    endAuthenticatedSession()
  }, [])

  useEffect(() => subscribeToSessionExpiration(applySessionExpired), [applySessionExpired])

  const login = useCallback(async (loginId: string, password: string) => {
    const response = await loginApi(loginId, password)
    applyAuthState(response.user)
  }, [applyAuthState])

  const logout = useCallback(async () => {
    await logoutApi()
    applyAuthState(null)
  }, [applyAuthState])

  const value = useMemo(
    () => ({ authNotice, user, initialized, status, login, logout, refresh }),
    [authNotice, initialized, login, logout, refresh, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
