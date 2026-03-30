import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { fetchAdminUsers } from '../../features/admin/api/adminApi'
import { fetchClientDetail, updateClient, type ClientDetail } from '../../features/clients/api/clientApi'
import { PageHeader } from '../../shared/components/PageHeader'

export function ClientEditPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [form, setForm] = useState({
    name: '',
    gender: 'MALE',
    birthDate: '',
    phone: '',
    primaryWorkerId: '',
  })
  const [workerOptions, setWorkerOptions] = useState<Array<{ userId: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) {
      return
    }
    void load(Number(clientId))
  }, [clientId, user?.role])

  async function load(id: number) {
    setLoading(true)
    try {
      const clientData = await fetchClientDetail(id)
      setClient(clientData)
      setForm({
        name: clientData.name,
        gender: clientData.gender,
        birthDate: clientData.birthDate,
        phone: clientData.phone ?? '',
        primaryWorkerId: String(clientData.primaryWorkerId),
      })

      if (user?.role === 'ADMIN') {
        const workers = await fetchAdminUsers({ status: 'ACTIVE', size: 100 })
        const nextOptions = workers.items.map((item) => ({ userId: item.userId, name: item.name }))
        if (!nextOptions.some((item) => item.userId === clientData.primaryWorkerId)) {
          nextOptions.unshift({ userId: clientData.primaryWorkerId, name: clientData.primaryWorkerName })
        }
        setWorkerOptions(nextOptions)
      } else {
        setWorkerOptions([{ userId: clientData.primaryWorkerId, name: clientData.primaryWorkerName }])
      }

      setError(null)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '대상자 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await updateClient(client.id, {
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
        phone: form.phone || undefined,
        primaryWorkerId: Number(form.primaryWorkerId),
      })
      navigate(`/clients/${updated.id}`)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '대상자 수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div>대상자 정보를 불러오는 중...</div>
  }

  if (error && !client) {
    return <div className="error-text">{error}</div>
  }

  if (!client) {
    return <div className="error-text">대상자 정보를 찾을 수 없습니다.</div>
  }

  const canEdit = user?.role === 'ADMIN' || user?.id === client.createdById

  if (!canEdit) {
    return <div className="error-text">해당 대상자를 수정할 권한이 없습니다.</div>
  }

  return (
    <div className="stack">
      <PageHeader description={`${client.name} / 사례번호 ${client.clientNo}`} title="대상자 정보 수정" />
      <form className="card stack" onSubmit={handleSubmit}>
        <div className="grid-2">
          <label className="field">
            <span>이름</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} value={form.name} />
          </label>
          <label className="field">
            <span>성별</span>
            <select onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))} value={form.gender}>
              <option value="MALE">남성</option>
              <option value="FEMALE">여성</option>
              <option value="OTHER">기타</option>
              <option value="UNKNOWN">미상</option>
            </select>
          </label>
          <label className="field">
            <span>생년월일</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))} type="date" value={form.birthDate} />
          </label>
          <label className="field">
            <span>연락처</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} value={form.phone} />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>담당자</span>
            {user?.role === 'ADMIN' ? (
              <select
                onChange={(event) => setForm((prev) => ({ ...prev, primaryWorkerId: event.target.value }))}
                value={form.primaryWorkerId}
              >
                {workerOptions.map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <input disabled value={client.primaryWorkerName} />
            )}
          </label>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        <div className="actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? '저장 중...' : '저장'}
          </button>
          <Link className="secondary-button" to={`/clients/${client.id}`}>
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
