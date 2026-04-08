import { useState, type ReactElement } from 'react'
import { Navigate, Route, Routes, type To } from 'react-router-dom'
import { AssessmentInputPage } from '../../pages/assessment/AssessmentInputPage'
import { AssessmentRecordListPage } from '../../pages/assessment/AssessmentRecordListPage'
import { AssessmentSessionPrintPage } from '../../pages/assessment/AssessmentSessionPrintPage'
import { AssessmentScaleSelectPage } from '../../pages/assessment/AssessmentScaleSelectPage'
import { AssessmentSessionDetailPage } from '../../pages/assessment/AssessmentSessionDetailPage'
import { AssessmentSummaryPage } from '../../pages/assessment/AssessmentSummaryPage'
import { AdminBackupsPage } from '../../pages/admin/AdminBackupsPage'
import { AdminLogsPage } from '../../pages/admin/AdminLogsPage'
import { AdminSignupRequestsPage } from '../../pages/admin/AdminSignupRequestsPage'
import { AdminUsersPage } from '../../pages/admin/AdminUsersPage'
import { MyInfoPage } from '../../pages/account/MyInfoPage'
import { LoginPage } from '../../pages/auth/LoginPage'
import { SignupRequestPage } from '../../pages/auth/SignupRequestPage'
import { ClientCreatePage } from '../../pages/clients/ClientCreatePage'
import { ClientDetailPage } from '../../pages/clients/ClientDetailPage'
import { ClientEditPage } from '../../pages/clients/ClientEditPage'
import { ClientListPage } from '../../pages/clients/ClientListPage'
import { StatisticsPage } from '../../pages/statistics/StatisticsPage'
import { hasAdminAccess } from '../../shared/user/userMetadata'
import { AppLayout } from '../layouts/AppLayout'
import { useAuth, type AuthRedirectNotice } from '../providers/AuthProvider'

const AUTH_CHECK_ERROR_MESSAGE = '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'

function getLoginRedirect(authNotice: AuthRedirectNotice | null): To {
  if (!authNotice) {
    return '/login'
  }

  return {
    pathname: '/login',
    search: `?notice=${authNotice}`,
  }
}

function AuthLoadingScreen() {
  return <div className="center-screen">초기화 중...</div>
}

function AuthCheckErrorScreen() {
  const { refresh } = useAuth()
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    if (retrying) {
      return
    }

    setRetrying(true)

    try {
      await refresh()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <main className="center-screen">
      <section className="card login-card stack">
        <div>
          <h1 style={{ marginBottom: 8 }}>인증 확인 실패</h1>
          <p className="error-text" role="alert">
            {AUTH_CHECK_ERROR_MESSAGE}
          </p>
        </div>
        <div className="actions">
          <button className="secondary-button" disabled={retrying} onClick={() => void handleRetry()} type="button">
            {retrying ? '다시 시도 중...' : '다시 시도'}
          </button>
        </div>
      </section>
    </main>
  )
}

function ProtectedLayout() {
  const { authNotice, initialized, status, user } = useAuth()

  if (!initialized || status === 'loading') {
    return <AuthLoadingScreen />
  }
  if (status === 'auth-check-error') {
    return <AuthCheckErrorScreen />
  }
  if (!user) {
    return <Navigate to={getLoginRedirect(authNotice)} replace />
  }
  return <AppLayout />
}

function ProtectedOnly({ children }: { children: ReactElement }) {
  const { authNotice, initialized, status, user } = useAuth()

  if (!initialized || status === 'loading') {
    return <AuthLoadingScreen />
  }
  if (status === 'auth-check-error') {
    return <AuthCheckErrorScreen />
  }
  if (!user) {
    return <Navigate to={getLoginRedirect(authNotice)} replace />
  }
  return children
}

function AdminOnly({ children }: { children: ReactElement }) {
  const { authNotice, initialized, status, user } = useAuth()

  if (!initialized || status === 'loading') {
    return <AuthLoadingScreen />
  }
  if (status === 'auth-check-error') {
    return <AuthCheckErrorScreen />
  }
  if (!user) {
    return <Navigate to={getLoginRedirect(authNotice)} replace />
  }
  if (!hasAdminAccess(user)) {
    return <Navigate to="/clients" replace />
  }
  return children
}

function GuestOnly({ children }: { children: ReactElement }) {
  const { initialized, status, user } = useAuth()

  if (!initialized || status === 'loading') {
    return <AuthLoadingScreen />
  }
  if (status === 'auth-check-error') {
    return <AuthCheckErrorScreen />
  }
  if (user) {
    return <Navigate to="/clients" replace />
  }
  return children
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestOnly>
            <SignupRequestPage />
          </GuestOnly>
        }
      />
      <Route
        path="/assessments/sessions/:sessionId/print"
        element={
          <ProtectedOnly>
            <AssessmentSessionPrintPage />
          </ProtectedOnly>
        }
      />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/clients" replace />} />
        <Route path="/clients" element={<ClientListPage />} />
        <Route path="/my-info" element={<MyInfoPage />} />
        <Route path="/clients/new" element={<ClientCreatePage />} />
        <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        <Route path="/clients/:clientId/edit" element={<ClientEditPage />} />
        <Route path="/assessment-records" element={<AssessmentRecordListPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/assessments/start/:clientId" element={<AssessmentScaleSelectPage />} />
        <Route path="/assessments/start/:clientId/scales" element={<AssessmentScaleSelectPage />} />
        <Route path="/assessments/start/:clientId/input" element={<AssessmentInputPage />} />
        <Route path="/assessments/start/:clientId/summary" element={<AssessmentSummaryPage />} />
        <Route path="/assessments/sessions/:sessionId" element={<AssessmentSessionDetailPage />} />
        <Route
          path="/admin/signup-requests"
          element={
            <AdminOnly>
              <AdminSignupRequestsPage />
            </AdminOnly>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminOnly>
              <AdminUsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <AdminOnly>
              <AdminLogsPage />
            </AdminOnly>
          }
        />
        <Route
          path="/admin/backups"
          element={
            <AdminOnly>
              <AdminBackupsPage />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/clients" replace />} />
    </Routes>
  )
}
