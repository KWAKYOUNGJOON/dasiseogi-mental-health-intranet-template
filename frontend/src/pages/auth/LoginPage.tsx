import { isAxiosError } from 'axios'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import type { ApiResponse } from '../../shared/types/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loginId, setLoginId] = useState('admina')
  const [password, setPassword] = useState('Test1234!')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const notice = searchParams.get('notice')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(loginId, password)
      navigate('/clients')
    } catch (requestError) {
      if (isAxiosError<ApiResponse<unknown>>(requestError)) {
        setError(requestError.response?.data?.message ?? '로그인에 실패했습니다.')
      } else {
        setError('로그인에 실패했습니다.')
      }
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
        {notice === 'signup-requested' ? <div className="success-text">가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.</div> : null}
        {error ? <div className="error-text">{error}</div> : null}
        <div className="stack" style={{ gap: 8 }}>
          <div className="actions">
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? '로그인 중...' : '로그인'}
            </button>
            <Link aria-label="회원가입 신청" className="secondary-button" to="/signup">
              회원가입 신청
            </Link>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            계정이 없으면 회원가입 신청 후 관리자 승인을 받아주세요.
          </p>
        </div>
      </form>
    </div>
  )
}
