import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { createClient, duplicateCheck } from '../../features/clients/api/clientApi'
import { PageHeader } from '../../shared/components/PageHeader'

export function ClientCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: '',
    gender: 'MALE',
    birthDate: '',
    phone: '',
  })
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleDuplicateCheck() {
    if (!form.name || !form.birthDate) {
      return
    }
    const response = await duplicateCheck({ name: form.name, birthDate: form.birthDate })
    setWarning(response.isDuplicate ? '동일 이름/생년월일 대상자가 이미 있습니다. 계속 등록할 수 있습니다.' : '중복 후보가 없습니다.')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const created = await createClient({
        ...form,
        primaryWorkerId: user!.id,
      })
      navigate(`/clients/${created.id}`)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '대상자 등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageHeader description="담당자는 현재 로그인 사용자로 기본 지정됩니다." title="대상자 등록" />
      <form className="card stack" onSubmit={handleSubmit}>
        <div className="grid-2">
          <label className="field">
            <span>이름</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="field">
            <span>성별</span>
            <select value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}>
              <option value="MALE">남성</option>
              <option value="FEMALE">여성</option>
              <option value="OTHER">기타</option>
              <option value="UNKNOWN">미상</option>
            </select>
          </label>
          <label className="field">
            <span>생년월일</span>
            <input type="date" value={form.birthDate} onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))} />
          </label>
          <label className="field">
            <span>연락처</span>
            <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </label>
        </div>
        <div className="actions">
          <button className="secondary-button" onClick={() => void handleDuplicateCheck()} type="button">
            중복 확인
          </button>
          <span className="muted">담당자: {user?.name}</span>
        </div>
        {warning ? <div className="muted">{warning}</div> : null}
        {error ? <div className="error-text">{error}</div> : null}
        <div className="actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
