import { isAxiosError } from 'axios'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { ApiResponse } from '../../../shared/types/api'
import {
  createSignupRequest,
  type CreateSignupRequestPayload,
  type CreateSignupRequestResponse,
} from '../api/signupRequestApi'

type SignupRequestFieldName =
  | 'name'
  | 'loginId'
  | 'password'
  | 'phone'
  | 'positionName'
  | 'teamName'
  | 'requestMemo'

type SignupRequestFieldErrors = Partial<Record<SignupRequestFieldName, string>>
type SignupRequestTouched = Partial<Record<SignupRequestFieldName, boolean>>

interface SignupRequestFormValues {
  name: string
  loginId: string
  password: string
  phone: string
  positionName: string
  teamName: string
  requestMemo: string
}

const INITIAL_FORM: SignupRequestFormValues = {
  name: '',
  loginId: '',
  password: '',
  phone: '',
  positionName: '',
  teamName: '',
  requestMemo: '',
}

const FIELD_ORDER: SignupRequestFieldName[] = [
  'name',
  'loginId',
  'password',
  'phone',
  'positionName',
  'teamName',
  'requestMemo',
]

const GENERIC_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const GENERIC_SIGNUP_ERROR_MESSAGE = '회원가입 신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
const LOGIN_ID_PATTERN = /^[a-z0-9_-]+$/
const PHONE_PATTERN = /^\d{2,3}-?\d{3,4}-?\d{4}$/

function trimValue(value: string) {
  return value.trim()
}

function normalizeFormValues(values: SignupRequestFormValues): SignupRequestFormValues {
  return {
    name: trimValue(values.name),
    loginId: trimValue(values.loginId).toLowerCase(),
    password: values.password.trim(),
    phone: trimValue(values.phone),
    positionName: trimValue(values.positionName),
    teamName: trimValue(values.teamName),
    requestMemo: trimValue(values.requestMemo),
  }
}

function validateField(field: SignupRequestFieldName, values: SignupRequestFormValues) {
  const normalized = normalizeFormValues(values)
  const value = normalized[field]

  switch (field) {
    case 'name':
      if (!value) {
        return '이름을 입력해주세요.'
      }
      if (value.length < 2) {
        return '이름은 2자 이상 입력해주세요.'
      }
      if (value.length > 50) {
        return '이름은 50자 이하로 입력해주세요.'
      }
      return undefined
    case 'loginId':
      if (!value) {
        return '아이디를 입력해주세요.'
      }
      if (value.length < 4 || value.length > 20) {
        return '아이디는 4자 이상 20자 이하로 입력해주세요.'
      }
      if (!LOGIN_ID_PATTERN.test(value)) {
        return '아이디는 영문 소문자, 숫자, -, _만 사용할 수 있습니다.'
      }
      return undefined
    case 'password':
      if (!value) {
        return '비밀번호를 입력해주세요.'
      }
      if (value.length < 8 || value.length > 20) {
        return '비밀번호는 8자 이상 20자 이하로 입력해주세요.'
      }
      return undefined
    case 'phone':
      if (!value) {
        return '연락처를 입력해주세요.'
      }
      if (!PHONE_PATTERN.test(value)) {
        return '연락처 형식을 확인해주세요.'
      }
      return undefined
    case 'positionName':
      if (!value) {
        return '직책을 입력해주세요.'
      }
      if (value.length > 50) {
        return '직책은 50자 이하로 입력해주세요.'
      }
      return undefined
    case 'teamName':
      if (!value) {
        return '소속 팀을 입력해주세요.'
      }
      if (value.length > 100) {
        return '소속 팀은 100자 이하로 입력해주세요.'
      }
      return undefined
    case 'requestMemo':
      if (value.length > 500) {
        return '신청 메모는 500자 이하로 입력해주세요.'
      }
      return undefined
  }
}

function validateForm(values: SignupRequestFormValues) {
  return FIELD_ORDER.reduce<SignupRequestFieldErrors>((errors, field) => {
    const message = validateField(field, values)
    if (message) {
      errors[field] = message
    }
    return errors
  }, {})
}

function hasErrors(errors: SignupRequestFieldErrors) {
  return Object.keys(errors).length > 0
}

function buildPayload(values: SignupRequestFormValues): CreateSignupRequestPayload {
  const normalized = normalizeFormValues(values)
  return {
    name: normalized.name,
    loginId: normalized.loginId,
    password: normalized.password,
    phone: normalized.phone,
    positionName: normalized.positionName,
    teamName: normalized.teamName,
    requestMemo: normalized.requestMemo || undefined,
  }
}

function isSignupRequestField(field: string): field is SignupRequestFieldName {
  return FIELD_ORDER.includes(field as SignupRequestFieldName)
}

function getRepresentativeMessage(response: ApiResponse<unknown> | undefined) {
  if (!response) {
    return GENERIC_SIGNUP_ERROR_MESSAGE
  }

  const message = response.message?.trim()
  if (response.errorCode === 'VALIDATION_ERROR') {
    return message || GENERIC_VALIDATION_MESSAGE
  }
  if (response.errorCode === 'LOGIN_ID_DUPLICATED') {
    return message || '이미 사용 중인 아이디입니다.'
  }
  if (response.errorCode === 'INTERNAL_SERVER_ERROR' || !response.errorCode) {
    return GENERIC_SIGNUP_ERROR_MESSAGE
  }
  return message || GENERIC_SIGNUP_ERROR_MESSAGE
}

function mapServerErrors(response: ApiResponse<unknown> | undefined): SignupRequestFieldErrors {
  const serverFieldErrors = response?.fieldErrors ?? []
  const nextErrors = serverFieldErrors.reduce<SignupRequestFieldErrors>((errors, fieldError) => {
    if (isSignupRequestField(fieldError.field)) {
      errors[fieldError.field] = fieldError.reason
    }
    return errors
  }, {})

  if (response?.errorCode === 'LOGIN_ID_DUPLICATED' && !nextErrors.loginId) {
    nextErrors.loginId = response.message?.trim() || '이미 사용 중인 아이디입니다.'
  }

  return nextErrors
}

function getApiResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return undefined
  }
  return error.response?.data
}

function getFieldInputClassName(error: string | undefined) {
  return error ? 'input-error' : undefined
}

export function SignupRequestForm() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [touched, setTouched] = useState<SignupRequestTouched>({})
  const [fieldErrors, setFieldErrors] = useState<SignupRequestFieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<CreateSignupRequestResponse | null>(null)
  const memoLengthLabel = `${form.requestMemo.length}/500`

  function updateFieldError(field: SignupRequestFieldName, nextForm: SignupRequestFormValues) {
    setFieldErrors((current) => {
      const nextErrors = { ...current }
      const message = validateField(field, nextForm)
      if (message) {
        nextErrors[field] = message
      } else {
        delete nextErrors[field]
      }
      return nextErrors
    })
  }

  function handleChange(field: SignupRequestFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      const nextForm = { ...form, [field]: value }
      setForm(nextForm)

      if (touched[field]) {
        updateFieldError(field, nextForm)
      }

      if (formMessage) {
        setFormMessage(null)
      }
    }
  }

  function handleBlur(field: SignupRequestFieldName) {
    return () => {
      setTouched((current) => ({ ...current, [field]: true }))
      updateFieldError(field, form)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting || success) {
      return
    }

    const nextTouched = FIELD_ORDER.reduce<SignupRequestTouched>((current, field) => {
      current[field] = true
      return current
    }, {})
    const nextErrors = validateForm(form)

    setTouched(nextTouched)
    setFieldErrors(nextErrors)

    if (hasErrors(nextErrors)) {
      setFormMessage(GENERIC_VALIDATION_MESSAGE)
      return
    }

    setFormMessage(null)
    setSubmitting(true)

    try {
      const response = await createSignupRequest(buildPayload(form))
      setSuccess(response)
      setFieldErrors({})
    } catch (error) {
      const response = getApiResponse(error)
      setFieldErrors(mapServerErrors(response))
      setFormMessage(getRepresentativeMessage(response))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="card login-card stack">
        <div className="stack" style={{ gap: 8 }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>회원가입 신청 완료</h1>
            <p className="muted">관리자 승인 후 로그인할 수 있습니다.</p>
          </div>
          <div className="success-panel" role="status">
            가입 신청이 접수되었습니다. 관리자 승인 후 로그인 가능합니다.
          </div>
        </div>
        <div className="muted">신청 번호: {success.requestId}</div>
        <div className="actions">
          <Link className="primary-button" to="/login?notice=signup-requested">
            로그인 화면으로 이동
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form className="card login-card stack" noValidate onSubmit={handleSubmit}>
      <div className="stack" style={{ gap: 8 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>회원가입 신청</h1>
          <p className="muted">관리자 승인 후 로그인할 수 있습니다.</p>
        </div>
        {formMessage ? (
          <div className="error-text" role="alert">
            {formMessage}
          </div>
        ) : null}
      </div>

      <label className="field">
        <span>이름</span>
        <input className={getFieldInputClassName(fieldErrors.name)} onBlur={handleBlur('name')} onChange={handleChange('name')} value={form.name} />
        {fieldErrors.name ? <span className="field-error">{fieldErrors.name}</span> : null}
      </label>

      <label className="field">
        <span>아이디</span>
        <input className={getFieldInputClassName(fieldErrors.loginId)} onBlur={handleBlur('loginId')} onChange={handleChange('loginId')} value={form.loginId} />
        <span className="field-hint">영문 소문자, 숫자, -, _를 사용할 수 있습니다.</span>
        {fieldErrors.loginId ? <span className="field-error">{fieldErrors.loginId}</span> : null}
      </label>

      <label className="field">
        <span>비밀번호</span>
        <input
          className={getFieldInputClassName(fieldErrors.password)}
          onBlur={handleBlur('password')}
          onChange={handleChange('password')}
          type="password"
          value={form.password}
        />
        <span className="field-hint">8자 이상 20자 이하로 입력해주세요.</span>
        {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
      </label>

      <label className="field">
        <span>연락처</span>
        <input className={getFieldInputClassName(fieldErrors.phone)} onBlur={handleBlur('phone')} onChange={handleChange('phone')} value={form.phone} />
        {fieldErrors.phone ? <span className="field-error">{fieldErrors.phone}</span> : null}
      </label>

      <label className="field">
        <span>직책</span>
        <input
          className={getFieldInputClassName(fieldErrors.positionName)}
          onBlur={handleBlur('positionName')}
          onChange={handleChange('positionName')}
          value={form.positionName}
        />
        {fieldErrors.positionName ? <span className="field-error">{fieldErrors.positionName}</span> : null}
      </label>

      <label className="field">
        <span>소속 팀</span>
        <input className={getFieldInputClassName(fieldErrors.teamName)} onBlur={handleBlur('teamName')} onChange={handleChange('teamName')} value={form.teamName} />
        {fieldErrors.teamName ? <span className="field-error">{fieldErrors.teamName}</span> : null}
      </label>

      <label className="field">
        <span>가입 신청 메모</span>
        <textarea
          className={getFieldInputClassName(fieldErrors.requestMemo)}
          onBlur={handleBlur('requestMemo')}
          onChange={handleChange('requestMemo')}
          rows={4}
          value={form.requestMemo}
        />
        <span className="field-hint">{memoLengthLabel}</span>
        {fieldErrors.requestMemo ? <span className="field-error">{fieldErrors.requestMemo}</span> : null}
      </label>

      <div className="actions">
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? '신청 중...' : '가입 신청'}
        </button>
        <Link className="secondary-button" to="/login">
          로그인으로 돌아가기
        </Link>
      </div>
    </form>
  )
}
