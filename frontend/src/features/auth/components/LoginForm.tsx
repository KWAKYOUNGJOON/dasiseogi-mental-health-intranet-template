import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../app/providers/AuthProvider'
import {
  DEFAULT_LOGIN_FORM_VALUES,
  SIGNUP_REQUEST_NOTICE,
  SIGNUP_REQUEST_NOTICE_MESSAGE,
  SESSION_EXPIRED_NOTICE,
  SESSION_EXPIRED_NOTICE_MESSAGE,
  resolveLoginErrorMessage,
  type LoginFormValues,
} from '../api/loginApi'

const LOGIN_FIELDS = ['loginId', 'password'] as const
const LOGIN_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const LOGIN_FIELD_MESSAGES: Readonly<Record<(typeof LOGIN_FIELDS)[number], string>> = {
  loginId: '아이디를 입력해주세요.',
  password: '비밀번호를 입력해주세요.',
}

type LoginFieldName = (typeof LOGIN_FIELDS)[number]
type LoginFieldErrors = Partial<Record<LoginFieldName, string>>

function validateLoginForm(values: LoginFormValues): LoginFieldErrors {
  return LOGIN_FIELDS.reduce<LoginFieldErrors>((errors, field) => {
    if (!values[field].trim()) {
      errors[field] = LOGIN_FIELD_MESSAGES[field]
    }

    return errors
  }, {})
}

function hasLoginFieldErrors(errors: LoginFieldErrors) {
  return Object.keys(errors).length > 0
}

function getInputClassName(error: string | undefined) {
  return error ? 'input-error' : undefined
}

function getFieldErrorId(field: LoginFieldName) {
  return `login-${field}-error`
}

export function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<LoginFormValues>(DEFAULT_LOGIN_FORM_VALUES)
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const notice = searchParams.get('notice')

  function handleChange(field: LoginFieldName) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const nextForm = { ...form, [field]: event.target.value }
      const nextErrors = validateLoginForm(nextForm)

      setForm(nextForm)

      if (hasLoginFieldErrors(fieldErrors) || formMessage === LOGIN_VALIDATION_MESSAGE) {
        setFieldErrors(nextErrors)
        setFormMessage(hasLoginFieldErrors(nextErrors) ? LOGIN_VALIDATION_MESSAGE : null)
        return
      }

      if (formMessage) {
        setFormMessage(null)
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting) {
      return
    }

    const nextErrors = validateLoginForm(form)

    setFieldErrors(nextErrors)

    if (hasLoginFieldErrors(nextErrors)) {
      setFormMessage(LOGIN_VALIDATION_MESSAGE)
      return
    }

    setFormMessage(null)
    setSubmitting(true)

    try {
      await login(form.loginId, form.password)
      navigate('/clients')
    } catch (requestError) {
      setFormMessage(resolveLoginErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label className="field" htmlFor="login-id">
        <span>아이디</span>
        <input
          aria-describedby={fieldErrors.loginId ? getFieldErrorId('loginId') : undefined}
          aria-invalid={fieldErrors.loginId ? 'true' : undefined}
          autoComplete="username"
          className={getInputClassName(fieldErrors.loginId)}
          id="login-id"
          onChange={handleChange('loginId')}
          value={form.loginId}
        />
        {fieldErrors.loginId ? (
          <span className="field-error" id={getFieldErrorId('loginId')}>
            {fieldErrors.loginId}
          </span>
        ) : null}
      </label>
      <label className="field" htmlFor="login-password">
        <span>비밀번호</span>
        <input
          aria-describedby={fieldErrors.password ? getFieldErrorId('password') : undefined}
          aria-invalid={fieldErrors.password ? 'true' : undefined}
          autoComplete="current-password"
          className={getInputClassName(fieldErrors.password)}
          id="login-password"
          onChange={handleChange('password')}
          type="password"
          value={form.password}
        />
        {fieldErrors.password ? (
          <span className="field-error" id={getFieldErrorId('password')}>
            {fieldErrors.password}
          </span>
        ) : null}
      </label>
      {notice === SIGNUP_REQUEST_NOTICE ? <div className="success-text">{SIGNUP_REQUEST_NOTICE_MESSAGE}</div> : null}
      {notice === SESSION_EXPIRED_NOTICE ? (
        <div aria-live="polite" className="error-text">
          {SESSION_EXPIRED_NOTICE_MESSAGE}
        </div>
      ) : null}
      {formMessage ? (
        <div className="error-text" role="alert">
          {formMessage}
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
