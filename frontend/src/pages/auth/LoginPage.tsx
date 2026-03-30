import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('admina')
  const [password, setPassword] = useState('Test1234!')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(loginId, password)
      navigate('/clients')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="card login-card stack" onSubmit={handleSubmit}>
        <div>
          <h1 style={{ marginBottom: 8 }}>다시서기 정신건강 평가관리 시스템</h1>
          <p className="muted">seed 계정: `admina / Test1234!`, `usera / Test1234!`</p>
        </div>
        <label className="field">
          <span>아이디</span>
          <input onChange={(event) => setLoginId(event.target.value)} value={loginId} />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>
        {error ? <div className="error-text">{error}</div> : null}
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
