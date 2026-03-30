import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSignupRequest } from '../../features/auth/api/authApi'

export function SignupRequestPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    loginId: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    positionName: '',
    teamName: '',
    requestMemo: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setSubmitting(true)
    try {
      await createSignupRequest({
        name: form.name,
        loginId: form.loginId,
        password: form.password,
        phone: form.phone || undefined,
        positionName: form.positionName || undefined,
        teamName: form.teamName || undefined,
        requestMemo: form.requestMemo || undefined,
      })
      navigate('/login?notice=signup-requested', { replace: true })
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '회원가입 신청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="card login-card stack" onSubmit={handleSubmit}>
        <div className="stack" style={{ gap: 8 }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>회원가입 신청</h1>
            <p className="muted">관리자 승인 후 로그인할 수 있습니다.</p>
          </div>
          <label className="field">
            <span>이름</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} value={form.name} />
          </label>
          <label className="field">
            <span>아이디</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, loginId: event.target.value }))} value={form.loginId} />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              type="password"
              value={form.password}
            />
          </label>
          <label className="field">
            <span>비밀번호 확인</span>
            <input
              onChange={(event) => setForm((prev) => ({ ...prev, passwordConfirm: event.target.value }))}
              type="password"
              value={form.passwordConfirm}
            />
          </label>
          <label className="field">
            <span>연락처</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} value={form.phone} />
          </label>
          <label className="field">
            <span>직책 또는 역할</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, positionName: event.target.value }))} value={form.positionName} />
          </label>
          <label className="field">
            <span>소속 팀</span>
            <input onChange={(event) => setForm((prev) => ({ ...prev, teamName: event.target.value }))} value={form.teamName} />
          </label>
          <label className="field">
            <span>가입 신청 메모</span>
            <textarea onChange={(event) => setForm((prev) => ({ ...prev, requestMemo: event.target.value }))} rows={4} value={form.requestMemo} />
          </label>
        </div>
        {error ? <div className="error-text">{error}</div> : null}
        <div className="actions">
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? '신청 중...' : '가입 신청'}
          </button>
          <Link className="secondary-button" to="/login">
            로그인으로 돌아가기
          </Link>
        </div>
      </form>
    </div>
  )
}
