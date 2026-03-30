import { useEffect, useState } from 'react'
import { fetchAdminUsers, updateUserRole, updateUserStatus, type AdminUserPage } from '../../features/admin/api/adminApi'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAuth } from '../../app/providers/AuthProvider'

export function AdminUsersPage() {
  const { refresh } = useAuth()
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [data, setData] = useState<AdminUserPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<number | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      setData(await fetchAdminUsers({ keyword: keyword || undefined, role: role || undefined, status: status || undefined }))
      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '사용자 목록을 불러오지 못했습니다.')
    }
  }

  async function handleRoleChange(userId: number, nextRole: 'ADMIN' | 'USER') {
    setSavingUserId(userId)
    try {
      await updateUserRole(userId, nextRole)
      await load()
      await refresh()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '권한 변경에 실패했습니다.')
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleStatusChange(userId: number, nextStatus: 'ACTIVE' | 'INACTIVE') {
    setSavingUserId(userId)
    try {
      await updateUserStatus(userId, nextStatus)
      await load()
      await refresh()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '상태 변경에 실패했습니다.')
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <div className="stack">
      <PageHeader description="권한과 상태를 최소 운영 수준으로 관리합니다." title="사용자 관리" />
      <div className="card stack">
        <div className="toolbar">
          <input onChange={(event) => setKeyword(event.target.value)} placeholder="이름 또는 아이디" value={keyword} />
          <select onChange={(event) => setRole(event.target.value)} value={role}>
            <option value="">전체 권한</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">전체 상태</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING">PENDING</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <button className="secondary-button" onClick={() => void load()}>
            조회
          </button>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        <table className="table">
          <thead>
            <tr>
              <th>이름</th>
              <th>아이디</th>
              <th>연락처</th>
              <th>권한</th>
              <th>상태</th>
              <th>승인일시</th>
              <th>최근 로그인</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.userId}>
                <td>{item.name}</td>
                <td>{item.loginId}</td>
                <td>{item.phone ?? '-'}</td>
                <td>
                  <select
                    disabled={savingUserId === item.userId}
                    onChange={(event) => void handleRoleChange(item.userId, event.target.value as 'ADMIN' | 'USER')}
                    value={item.role}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="USER">USER</option>
                  </select>
                </td>
                <td>
                  {item.status === 'ACTIVE' || item.status === 'INACTIVE' ? (
                    <select
                      disabled={savingUserId === item.userId}
                      onChange={(event) => void handleStatusChange(item.userId, event.target.value as 'ACTIVE' | 'INACTIVE')}
                      value={item.status}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  ) : (
                    item.status
                  )}
                </td>
                <td>{item.approvedAt ?? '-'}</td>
                <td>{item.lastLoginAt ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
