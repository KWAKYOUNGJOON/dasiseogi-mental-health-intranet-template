import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
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
import { LoginPage } from '../../pages/auth/LoginPage'
import { ClientCreatePage } from '../../pages/clients/ClientCreatePage'
import { ClientDetailPage } from '../../pages/clients/ClientDetailPage'
import { ClientListPage } from '../../pages/clients/ClientListPage'
import { StatisticsPage } from '../../pages/statistics/StatisticsPage'
import { AppLayout } from '../layouts/AppLayout'
import { useAuth } from '../providers/AuthProvider'

function ProtectedLayout() {
  const { initialized, user } = useAuth()

  if (!initialized) {
    return <div className="center-screen">초기화 중...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <AppLayout />
}

function ProtectedOnly({ children }: { children: ReactElement }) {
  const { initialized, user } = useAuth()

  if (!initialized) {
    return <div className="center-screen">초기화 중...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminOnly({ children }: { children: ReactElement }) {
  const { initialized, user } = useAuth()

  if (!initialized) {
    return <div className="center-screen">초기화 중...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'ADMIN') {
    return <Navigate to="/clients" replace />
  }
  return children
}

function GuestOnly({ children }: { children: ReactElement }) {
  const { initialized, user } = useAuth()

  if (!initialized) {
    return <div className="center-screen">초기화 중...</div>
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
        <Route path="/clients/new" element={<ClientCreatePage />} />
        <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        <Route path="/assessment-records" element={<AssessmentRecordListPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
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
