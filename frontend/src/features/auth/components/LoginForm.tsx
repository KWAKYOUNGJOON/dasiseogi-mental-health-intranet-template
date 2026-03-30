import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../app/providers/AuthProvider'
import {
  DEFAULT_LOGIN_FORM_VALUES,
  SIGNUP_REQUEST_NOTICE,
  SIGNUP_REQUEST_NOTICE_MESSAGE,
  resolveLoginErrorMessage,
  type LoginFormValues,
} from '../api/loginApi'

export function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<LoginFormValues>(DEFAULT_LOGIN_FORM_VALUES)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const notice = searchParams.get('notice')

  function handleChange(field: keyof LoginFormValues) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const nextForm = { ...form, [field]: event.target.value }

      setForm(nextForm)

      if (error) {
        setError(null)
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting) {
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await login(form.loginId, form.password)
      navigate('/clients')
    } catch (requestError) {
      setError(resolveLoginErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card login-card stack" onSubmit={handleSubmit}>
      <div>
        <h1 style={{ marginBottom: 8 }}>다시서기 정신건강 평가관리 시스템</h1>
        <p className="muted">seed 계정: `admina / Test1234!`, `usera / Test1234!`</p>
      </div>
      <label className="field" htmlFor="login-id">
        <span>아이디</span>
        <input autoComplete="username" id="login-id" onChange={handleChange('loginId')} value={form.loginId} />
      </label>
      <label className="field" htmlFor="login-password">
        <span>비밀번호</span>
        <input
          autoComplete="current-password"
          id="login-password"
          onChange={handleChange('password')}
          type="password"
          value={form.password}
        />
      </label>
      {notice === SIGNUP_REQUEST_NOTICE ? <div className="success-text">{SIGNUP_REQUEST_NOTICE_MESSAGE}</div> : null}
      {error ? (
        <div className="error-text" role="alert">
          {error}
        </div>
      ) : null}
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
  )
}
