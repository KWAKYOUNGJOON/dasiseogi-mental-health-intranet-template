import { isAxiosError } from 'axios'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ApiResponse } from '../../../shared/types/api'
import { createSignupRequest, type CreateSignupRequestPayload } from '../api/signupRequestApi'

const POSITION_NAME_OPTIONS = ['팀장', '대리', '실무자'] as const
const SIGNUP_REQUEST_FIELDS = [
  'name',
  'loginId',
  'password',
  'passwordConfirm',
  'phone',
  'positionName',
  'teamName',
  'requestMemo',
] as const

type SignupRequestFieldName = (typeof SIGNUP_REQUEST_FIELDS)[number]
type PasswordFieldName = Extract<SignupRequestFieldName, 'password' | 'passwordConfirm'>
type SignupRequestFieldErrors = Partial<Record<SignupRequestFieldName, string>>
type SignupRequestTouched = Partial<Record<SignupRequestFieldName, boolean>>

interface SignupRequestFormValues {
  name: string
  loginId: string
  password: string
  passwordConfirm: string
  phone: string
  positionName: string
  teamName: string
  requestMemo: string
}

interface SignupRequestFieldDefinition {
  name: SignupRequestFieldName
  label: string
  autoComplete?: string
  control?: 'select'
  hint?: string
  inputMode?: 'text' | 'tel'
  maxLength?: number
  rows?: number
  required?: boolean
  type?: 'password' | 'text'
}

const INITIAL_FORM: SignupRequestFormValues = {
  name: '',
  loginId: '',
  password: '',
  passwordConfirm: '',
  phone: '',
  positionName: '',
  teamName: '',
  requestMemo: '',
}

const FIELD_DEFINITIONS: ReadonlyArray<SignupRequestFieldDefinition> = [
  { name: 'name', label: '이름', autoComplete: 'name', maxLength: 50, required: true },
  {
    name: 'loginId',
    label: '아이디',
    autoComplete: 'username',
    hint: '영문 소문자, 숫자, -, _를 사용할 수 있습니다.',
    maxLength: 20,
    required: true,
  },
  {
    name: 'password',
    label: '비밀번호',
    autoComplete: 'new-password',
    hint: '8자 이상 20자 이하로 입력해주세요.',
    maxLength: 20,
    required: true,
    type: 'password',
  },
  {
    name: 'passwordConfirm',
    label: '비밀번호 확인',
    autoComplete: 'new-password',
    hint: '비밀번호를 한 번 더 입력해주세요.',
    maxLength: 20,
    required: true,
    type: 'password',
  },
  { name: 'phone', label: '연락처', autoComplete: 'tel', inputMode: 'tel', maxLength: 20, required: true },
  { name: 'positionName', label: '직책 또는 역할', control: 'select', required: true },
  { name: 'teamName', label: '소속 팀', maxLength: 100, required: true },
  { name: 'requestMemo', label: '가입 신청 메모', hint: '0/500', maxLength: 500, rows: 4 },
]

const VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const DUPLICATED_LOGIN_ID_MESSAGE = '이미 사용 중인 아이디입니다.'
const GENERIC_SIGNUP_ERROR_MESSAGE = '회원가입 신청에 실패했습니다. 잠시 후 다시 시도해주세요.'
const LOGIN_ID_PATTERN = /^[a-z0-9_-]+$/
const PHONE_PATTERN = /^\d{2,3}-?\d{3,4}-?\d{4}$/
const POSITION_NAME_VALIDATION_MESSAGE = '직책 또는 역할은 팀장, 대리, 실무자 중에서 선택해주세요.'
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
    passwordConfirm: values.passwordConfirm.trim(),
    phone: formatPhoneNumber(values.phone),
    positionName: trimValue(values.positionName),
    teamName: trimValue(values.teamName),
    requestMemo: trimValue(values.requestMemo),
  }
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.startsWith('02')) {
    if (digits.length <= 2) {
      return digits
    }

    if (digits.length <= 5) {
      return `${digits.slice(0, 2)}-${digits.slice(2)}`
    }

    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    }

    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function isAllowedPositionName(value: string) {
  return POSITION_NAME_OPTIONS.includes(value as (typeof POSITION_NAME_OPTIONS)[number])
}

function isPasswordField(field: SignupRequestFieldName): field is PasswordFieldName {
  return field === 'password' || field === 'passwordConfirm'
}

function getNextFieldValue(field: SignupRequestFieldName, value: string) {
  if (field === 'phone') {
    return formatPhoneNumber(value)
  }

  return value
}

function getValidationTargets(field: SignupRequestFieldName) {
  if (field === 'password') {
    return ['password', 'passwordConfirm'] as const
  }

  return [field] as const
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
    case 'passwordConfirm':
      if (!value) {
        return '비밀번호 확인을 입력해주세요.'
      }
      if (normalized.password && value !== normalized.password) {
        return '비밀번호가 일치하지 않습니다.'
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
      if (!isAllowedPositionName(value)) {
        return POSITION_NAME_VALIDATION_MESSAGE
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
  const [passwordVisibility, setPasswordVisibility] = useState<Record<PasswordFieldName, boolean>>({
    password: false,
    passwordConfirm: false,
  })
  const [submitting, setSubmitting] = useState(false)

  function updateFieldErrors(fields: ReadonlyArray<SignupRequestFieldName>, nextForm: SignupRequestFormValues) {
    setFieldErrors((current) => {
      const nextErrors = { ...current }

      fields.forEach((field) => {
        const message = validateField(field, nextForm)

        if (message) {
          nextErrors[field] = message
        } else {
          delete nextErrors[field]
        }
      })

      return nextErrors
    })
  }

  function togglePasswordVisibility(field: PasswordFieldName) {
    return () => {
      setPasswordVisibility((current) => ({
        ...current,
        [field]: !current[field],
      }))
    }
  }

  function getInputType(field: SignupRequestFieldDefinition) {
    if (isPasswordField(field.name)) {
      return passwordVisibility[field.name] ? 'text' : 'password'
    }

    return field.type ?? 'text'
  }

  function getToggleLabel(field: SignupRequestFieldDefinition) {
    if (!isPasswordField(field.name)) {
      return null
    }

    return passwordVisibility[field.name] ? '숨기기' : '보기'
  }

  function renderFieldLabel(field: SignupRequestFieldDefinition) {
    return (
      <label className="field-label" htmlFor={getFieldInputId(field.name)}>
        <span>{field.label}</span>
        {field.required ? (
          <>
            <span aria-hidden="true" className="field-required-mark">
              *
            </span>
            <span className="visually-hidden">필수 입력</span>
          </>
        ) : null}
      </label>
    )
  }

  function renderFieldControl(
    field: SignupRequestFieldDefinition,
    commonProps: {
      'aria-describedby': string | undefined
      'aria-invalid': 'true' | undefined
      'aria-required': 'true' | undefined
      className: string | undefined
      id: string
      name: SignupRequestFieldName
      onBlur: () => void
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
      required: boolean | undefined
    },
  ) {
    if (field.rows) {
      return <textarea {...commonProps} autoComplete={field.autoComplete} maxLength={field.maxLength} rows={field.rows} value={form[field.name]} />
    }

    if (field.control === 'select') {
      return (
        <select {...commonProps} value={form[field.name]}>
          <option value="">선택해주세요.</option>
          {POSITION_NAME_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }

    if (isPasswordField(field.name)) {
      const toggleLabel = getToggleLabel(field)

      return (
        <div className="field-control-row">
          <input
            {...commonProps}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            maxLength={field.maxLength}
            type={getInputType(field)}
            value={form[field.name]}
          />
          <button
            aria-label={`${field.label} ${toggleLabel}`}
            className="field-inline-button"
            onClick={togglePasswordVisibility(field.name)}
            type="button"
          >
            {toggleLabel}
          </button>
        </div>
      )
    }

    return (
      <input
        {...commonProps}
        autoComplete={field.autoComplete}
        inputMode={field.inputMode}
        maxLength={field.maxLength}
        type={field.type ?? 'text'}
        value={form[field.name]}
      />
    )
  }

  function handleChange(field: SignupRequestFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = getNextFieldValue(field, event.target.value)
      const nextForm = { ...form, [field]: value }
      const nextValidationTargets = getValidationTargets(field).filter((target) => touched[target])

      setForm(nextForm)

      if (nextValidationTargets.length > 0) {
        updateFieldErrors(nextValidationTargets, nextForm)
      }

      if (formMessage) {
        setFormMessage(null)
      }
    }
  }

  function handleBlur(field: SignupRequestFieldName) {
    return () => {
      const nextTouched = { ...touched, [field]: true }
      const nextValidationTargets = getValidationTargets(field).filter((target) => nextTouched[target])

      setTouched(nextTouched)
      updateFieldErrors(nextValidationTargets, form)
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
          'aria-required': field.required ? 'true' : undefined,
          className: getFieldInputClassName(errorMessage),
          id: inputId,
          name: field.name,
          onBlur: handleBlur(field.name),
          onChange: handleChange(field.name),
          required: field.required || undefined,
        } as const

        return (
          <div className="field" key={field.name}>
            {renderFieldLabel(field)}
            {renderFieldControl(field, commonProps)}
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
          </div>
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
