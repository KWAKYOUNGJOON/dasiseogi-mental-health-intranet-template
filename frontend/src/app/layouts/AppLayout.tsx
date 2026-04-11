import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppMetadata } from '../providers/AppMetadataProvider'
import { useAuth } from '../providers/AuthProvider'
import { getUserRoleLabel, hasAdminAccess } from '../../shared/user/userMetadata'

export function AppLayout() {
  const { organizationName } = useAppMetadata()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const canAccessAdmin = hasAdminAccess(user)
  const userRoleLabel = user ? getUserRoleLabel(user.role) : ''

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <h1>{organizationName || '기관 정보 확인 중'}</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/clients">대상자</NavLink>
          <NavLink to="/assessment-records">검사기록</NavLink>
          <NavLink to="/statistics">통계</NavLink>
          {canAccessAdmin ? (
            <>
              <NavLink to="/admin/signup-requests">승인 대기</NavLink>
              <NavLink to="/admin/users">사용자 관리</NavLink>
              <NavLink to="/admin/logs">로그 확인</NavLink>
              <NavLink to="/admin/backups">백업 관리</NavLink>
            </>
          ) : null}
        </nav>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-user">
            <strong>{user?.name}</strong>
            <span>{userRoleLabel}</span>
          </div>
          <div className="topbar-actions">
            <NavLink className="secondary-button" to="/my-info">
              내 정보
            </NavLink>
            <button className="secondary-button" onClick={() => void handleLogout()}>
              로그아웃
            </button>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
