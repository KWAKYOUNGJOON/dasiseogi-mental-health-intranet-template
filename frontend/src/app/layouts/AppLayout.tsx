import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <h1>다시서기</h1>
          <p>정신건강 평가관리</p>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/clients">대상자</NavLink>
          <NavLink to="/assessment-records">검사기록</NavLink>
          <NavLink to="/statistics">통계</NavLink>
          {user?.role === 'ADMIN' ? <NavLink to="/admin/signup-requests">승인 대기</NavLink> : null}
          {user?.role === 'ADMIN' ? <NavLink to="/admin/users">사용자 관리</NavLink> : null}
          {user?.role === 'ADMIN' ? <NavLink to="/admin/logs">로그 확인</NavLink> : null}
          {user?.role === 'ADMIN' ? <NavLink to="/admin/backups">백업 관리</NavLink> : null}
        </nav>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.role === 'ADMIN' ? '관리자' : '일반 사용자'}</span>
          </div>
          <button className="secondary-button" onClick={() => void handleLogout()}>
            로그아웃
          </button>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
