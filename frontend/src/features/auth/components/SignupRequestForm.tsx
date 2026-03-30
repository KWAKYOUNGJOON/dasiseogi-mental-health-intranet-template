import { isAxiosError } from 'axios'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ApiResponse } from '../../../shared/types/api'
import { createSignupRequest, type CreateSignupRequestPayload } from '../api/signupRequestApi'

const SIGNUP_REQUEST_FIELDS = ['name', 'loginId', 'password', 'phone', 'positionName', 'teamName', 'requestMemo'] as const

type SignupRequestFieldName = (typeof SIGNUP_REQUEST_FIELDS)[number]
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

interface SignupRequestFieldDefinition {
  name: SignupRequestFieldName
  label: string
  autoComplete?: string
  hint?: string
  inputMode?: 'text' | 'tel'
  maxLength?: number
  rows?: number
  type?: 'password' | 'text'
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

const FIELD_DEFINITIONS: ReadonlyArray<SignupRequestFieldDefinition> = [
  { name: 'name', label: '이름', autoComplete: 'name', maxLength: 50 },
  {
    name: 'loginId',
    label: '아이디',
    autoComplete: 'username',
    hint: '영문 소문자, 숫자, -, _를 사용할 수 있습니다.',
    maxLength: 20,
  },
  {
    name: 'password',
    label: '비밀번호',
    autoComplete: 'new-password',
    hint: '8자 이상 20자 이하로 입력해주세요.',
    maxLength: 20,
    type: 'password',
  },
  { name: 'phone', label: '연락처', autoComplete: 'tel', inputMode: 'tel', maxLength: 20 },
  { name: 'positionName', label: '직책 또는 역할', maxLength: 50 },
  { name: 'teamName', label: '소속 팀', maxLength: 100 },
  { name: 'requestMemo', label: '가입 신청 메모', hint: '0/500', maxLength: 500, rows: 4 },
]

const VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const DUPLICATED_LOGIN_ID_MESSAGE = '이미 사용 중인 아이디입니다.'
const GENERIC_SIGNUP_ERROR_MESSAGE = '회원가입 신청에 실패했습니다. 잠시 후 다시 시도해주세요.'
const LOGIN_ID_PATTERN = /^[a-z0-9_-]+$/
const PHONE_PATTERN = /^\d{2,3}-?\d{3,4}-?\d{4}$/
const SERVER_FIELD_ALIASES: Readonly<Record<string, SignupRequestFieldName>> = {
  contact: 'phone',
  loginId: 'loginId',
  memo: 'requestMemo',
  name: 'name',
  password: 'password',
  phone: 'phone',
  position: 'positionName',
  positionName: 'positionName',
  positionOrRole: 'positionName',
  requestMemo: 'requestMemo',
  role: 'positionName',
  team: 'teamName',
  teamName: 'teamName',
}

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
        return '직책 또는 역할을 입력해주세요.'
      }
      if (value.length > 50) {
        return '직책 또는 역할은 50자 이하로 입력해주세요.'
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
        return '가입 신청 메모는 500자 이하로 입력해주세요.'
      }
      return undefined
  }
}

function validateForm(values: SignupRequestFormValues) {
  return SIGNUP_REQUEST_FIELDS.reduce<SignupRequestFieldErrors>((errors, field) => {
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

function isDuplicatedLoginIdErrorCode(errorCode: string | null | undefined) {
  const normalizedErrorCode = errorCode?.trim().toUpperCase() ?? ''
  if (!normalizedErrorCode) {
    return false
  }

  return (
    normalizedErrorCode === 'LOGIN_ID_DUPLICATED' ||
    (normalizedErrorCode.includes('LOGIN_ID') && normalizedErrorCode.includes('DUPLICAT')) ||
    (normalizedErrorCode.includes('LOGIN_ID') && normalizedErrorCode.includes('ALREADY_EXISTS'))
  )
}

function resolveSignupRequestField(field: string) {
  return SERVER_FIELD_ALIASES[field.trim()]
}

function getRepresentativeMessage(response: ApiResponse<unknown> | undefined) {
  if (isDuplicatedLoginIdErrorCode(response?.errorCode)) {
    return response?.message?.trim() || DUPLICATED_LOGIN_ID_MESSAGE
  }

  if (response?.errorCode === 'VALIDATION_ERROR') {
    return VALIDATION_MESSAGE
  }

  return response?.message?.trim() || GENERIC_SIGNUP_ERROR_MESSAGE
}

function mapServerErrors(response: ApiResponse<unknown> | undefined): SignupRequestFieldErrors {
  const nextErrors = (response?.fieldErrors ?? []).reduce<SignupRequestFieldErrors>((errors, fieldError) => {
    const field = resolveSignupRequestField(fieldError.field)
    const reason = fieldError.reason.trim()

    if (field && reason) {
      errors[field] = reason
    }

    return errors
  }, {})

  if (isDuplicatedLoginIdErrorCode(response?.errorCode) && !nextErrors.loginId) {
    nextErrors.loginId = response?.message?.trim() || DUPLICATED_LOGIN_ID_MESSAGE
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

function getFieldInputId(field: SignupRequestFieldName) {
  return `signup-request-${field}`
}

function getFieldHintId(field: SignupRequestFieldName) {
  return `signup-request-${field}-hint`
}

function getFieldErrorId(field: SignupRequestFieldName) {
  return `signup-request-${field}-error`
}

function getFieldDescribedBy(field: SignupRequestFieldName, hasHint: boolean, hasError: boolean) {
  const describedBy = [hasHint ? getFieldHintId(field) : null, hasError ? getFieldErrorId(field) : null].filter(
    (value): value is string => Boolean(value),
  )

  return describedBy.length > 0 ? describedBy.join(' ') : undefined
}

export function SignupRequestForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [touched, setTouched] = useState<SignupRequestTouched>({})
  const [fieldErrors, setFieldErrors] = useState<SignupRequestFieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

    if (submitting) {
      return
    }

    const nextTouched = SIGNUP_REQUEST_FIELDS.reduce<SignupRequestTouched>((current, field) => {
      current[field] = true
      return current
    }, {})
    const nextErrors = validateForm(form)

    setTouched(nextTouched)
    setFieldErrors(nextErrors)

    if (hasErrors(nextErrors)) {
      setFormMessage(VALIDATION_MESSAGE)
      return
    }

    setFormMessage(null)
    setSubmitting(true)

    try {
      await createSignupRequest(buildPayload(form))
      navigate('/login?notice=signup-requested', { replace: true })
    } catch (error) {
      const response = getApiResponse(error)

      setFieldErrors(mapServerErrors(response))
      setFormMessage(getRepresentativeMessage(response))
    } finally {
      setSubmitting(false)
    }
  }

  const memoLengthLabel = `${form.requestMemo.length}/500`

  return (
    <form className="stack" noValidate onSubmit={handleSubmit}>
      {formMessage ? (
        <div className="error-text" role="alert">
          {formMessage}
        </div>
      ) : null}

      {FIELD_DEFINITIONS.map((field) => {
        const errorMessage = fieldErrors[field.name]
        const inputId = getFieldInputId(field.name)
        const hintText = field.name === 'requestMemo' ? memoLengthLabel : field.hint
        const hintId = hintText ? getFieldHintId(field.name) : undefined
        const errorId = errorMessage ? getFieldErrorId(field.name) : undefined
        const describedBy = getFieldDescribedBy(field.name, Boolean(hintId), Boolean(errorId))
        const commonProps = {
          'aria-describedby': describedBy,
          'aria-invalid': errorMessage ? 'true' : undefined,
          autoComplete: field.autoComplete,
          className: getFieldInputClassName(errorMessage),
          id: inputId,
          maxLength: field.maxLength,
          name: field.name,
          onBlur: handleBlur(field.name),
          onChange: handleChange(field.name),
        } as const

        return (
          <label className="field" key={field.name} htmlFor={inputId}>
            <span>{field.label}</span>
            {field.rows ? (
              <textarea {...commonProps} rows={field.rows} value={form[field.name]} />
            ) : (
              <input {...commonProps} inputMode={field.inputMode} type={field.type ?? 'text'} value={form[field.name]} />
            )}
            {hintText ? (
              <span className="field-hint" id={hintId}>
                {hintText}
              </span>
            ) : null}
            {errorMessage ? (
              <span className="field-error" id={errorId}>
                {errorMessage}
              </span>
            ) : null}
          </label>
        )
      })}

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
