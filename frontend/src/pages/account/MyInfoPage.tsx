import { isAxiosError } from 'axios'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../../app/providers/AuthProvider'
import { updateMyProfile, type AuthUser, type UpdateMyProfilePayload } from '../../features/auth/api/authApi'
import { PageHeader } from '../../shared/components/PageHeader'
import type { ApiResponse } from '../../shared/types/api'

const MY_INFO_FIELDS = ['name', 'phone', 'positionName', 'teamName'] as const
const PHONE_PATTERN = /^\d{2,3}-?\d{3,4}-?\d{4}$/
const VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
const DEFAULT_UPDATE_ERROR_MESSAGE = '내 정보 수정에 실패했습니다. 잠시 후 다시 시도해주세요.'
const UPDATE_SUCCESS_MESSAGE = '회원정보가 수정되었습니다.'
const SERVER_FIELD_ALIASES: Readonly<Record<string, MyInfoFieldName>> = {
  contact: 'phone',
  name: 'name',
  phone: 'phone',
  position: 'positionName',
  positionName: 'positionName',
  team: 'teamName',
  teamName: 'teamName',
}

type MyInfoFieldName = (typeof MY_INFO_FIELDS)[number]
type MyInfoFieldErrors = Partial<Record<MyInfoFieldName, string>>
type MyInfoTouched = Partial<Record<MyInfoFieldName, boolean>>

interface MyInfoFormValues {
  name: string
  phone: string
  positionName: string
  teamName: string
}

interface MyInfoFieldDefinition {
  name: MyInfoFieldName
  label: string
  autoComplete?: string
  inputMode?: 'text' | 'tel'
  maxLength?: number
  required?: boolean
}

const FIELD_DEFINITIONS: ReadonlyArray<MyInfoFieldDefinition> = [
  { name: 'name', label: '이름', autoComplete: 'name', maxLength: 50, required: true },
  { name: 'phone', label: '연락처', autoComplete: 'tel', inputMode: 'tel', maxLength: 20 },
  { name: 'positionName', label: '직책 또는 역할', maxLength: 50 },
  { name: 'teamName', label: '소속 팀', maxLength: 100 },
]

function trimValue(value: string) {
  return value.trim()
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

function mapUserToForm(user: AuthUser): MyInfoFormValues {
  return {
    name: user.name ?? '',
    phone: user.phone ?? '',
    positionName: user.positionName ?? '',
    teamName: user.teamName ?? '',
  }
}

function normalizeFormValues(values: MyInfoFormValues): MyInfoFormValues {
  return {
    name: trimValue(values.name),
    phone: formatPhoneNumber(values.phone),
    positionName: trimValue(values.positionName),
    teamName: trimValue(values.teamName),
  }
}

function validateField(field: MyInfoFieldName, values: MyInfoFormValues) {
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
    case 'phone':
      if (value && !PHONE_PATTERN.test(value)) {
        return '연락처 형식을 확인해주세요.'
      }
      return undefined
    case 'positionName':
      if (value.length > 50) {
        return '직책 또는 역할은 50자 이하로 입력해주세요.'
      }
      return undefined
    case 'teamName':
      if (value.length > 100) {
        return '소속 팀은 100자 이하로 입력해주세요.'
      }
      return undefined
  }
}

function validateForm(values: MyInfoFormValues) {
  return MY_INFO_FIELDS.reduce<MyInfoFieldErrors>((errors, field) => {
    const message = validateField(field, values)

    if (message) {
      errors[field] = message
    }

    return errors
  }, {})
}

function hasErrors(errors: MyInfoFieldErrors) {
  return Object.keys(errors).length > 0
}

function getNextFieldValue(field: MyInfoFieldName, value: string) {
  if (field === 'phone') {
    return formatPhoneNumber(value)
  }

  return value
}

function buildPayload(values: MyInfoFormValues): UpdateMyProfilePayload {
  const normalized = normalizeFormValues(values)

  return {
    name: normalized.name,
    phone: normalized.phone || undefined,
    positionName: normalized.positionName || undefined,
    teamName: normalized.teamName || undefined,
  }
}

function getApiResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return undefined
  }

  return error.response?.data
}

function resolveRepresentativeMessage(response: ApiResponse<unknown> | undefined) {
  if (response?.errorCode === 'VALIDATION_ERROR') {
    return response.message?.trim() || VALIDATION_MESSAGE
  }

  return response?.message?.trim() || DEFAULT_UPDATE_ERROR_MESSAGE
}

function resolveField(field: string) {
  return SERVER_FIELD_ALIASES[field.trim()]
}

function mapServerFieldErrors(response: ApiResponse<unknown> | undefined) {
  return (response?.fieldErrors ?? []).reduce<MyInfoFieldErrors>((errors, fieldError) => {
    const field = resolveField(fieldError.field)
    const reason = fieldError.reason.trim()

    if (field && reason) {
      errors[field] = reason
    }

    return errors
  }, {})
}

function getFieldInputClassName(error: string | undefined) {
  return error ? 'input-error' : undefined
}

function getFieldInputId(field: MyInfoFieldName) {
  return `my-info-${field}`
}

function getFieldErrorId(field: MyInfoFieldName) {
  return `my-info-${field}-error`
}

function getFieldDescribedBy(field: MyInfoFieldName, hasError: boolean) {
  return hasError ? getFieldErrorId(field) : undefined
}

function getRoleLabel(role: AuthUser['role']) {
  return role === 'ADMIN' ? '관리자' : '일반 사용자'
}

function getStatusLabel(status: AuthUser['status']) {
  switch (status) {
    case 'ACTIVE':
      return '활성'
    case 'PENDING':
      return '승인 대기'
    case 'INACTIVE':
      return '비활성'
    case 'REJECTED':
      return '반려'
  }
}

export function MyInfoPage() {
  const { refresh, user } = useAuth()
  const [form, setForm] = useState<MyInfoFormValues>(() =>
    user
      ? mapUserToForm(user)
      : {
          name: '',
          phone: '',
          positionName: '',
          teamName: '',
        },
  )
  const [touched, setTouched] = useState<MyInfoTouched>({})
  const [fieldErrors, setFieldErrors] = useState<MyInfoFieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      return
    }

    setForm(mapUserToForm(user))
  }, [user?.id, user?.name, user?.phone, user?.positionName, user?.teamName])

  function updateFieldError(field: MyInfoFieldName, nextForm: MyInfoFormValues) {
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

  function handleChange(field: MyInfoFieldName) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = getNextFieldValue(field, event.target.value)
      const nextForm = { ...form, [field]: value }

      setForm(nextForm)

      if (touched[field]) {
        updateFieldError(field, nextForm)
      }

      if (formMessage === VALIDATION_MESSAGE) {
        const nextErrors = validateForm(nextForm)

        setFieldErrors(nextErrors)
        setFormMessage(hasErrors(nextErrors) ? VALIDATION_MESSAGE : null)
      } else if (formMessage) {
        setFormMessage(null)
      }

      if (successMessage) {
        setSuccessMessage(null)
      }
    }
  }

  function handleBlur(field: MyInfoFieldName) {
    return () => {
      setTouched((current) => ({ ...current, [field]: true }))
      updateFieldError(field, form)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving || !user) {
      return
    }

    const nextTouched = MY_INFO_FIELDS.reduce<MyInfoTouched>((current, field) => {
      current[field] = true
      return current
    }, {})
    const nextErrors = validateForm(form)

    setTouched(nextTouched)
    setFieldErrors(nextErrors)
    setSuccessMessage(null)

    if (hasErrors(nextErrors)) {
      setFormMessage(VALIDATION_MESSAGE)
      return
    }

    setFormMessage(null)
    setSaving(true)

    try {
      const updatedUser = await updateMyProfile(buildPayload(form))

      setForm(mapUserToForm(updatedUser))
      setFieldErrors({})
      setFormMessage(null)
      setSuccessMessage(UPDATE_SUCCESS_MESSAGE)

      try {
        await refresh()
      } catch {
        // Keep the local success state even if the background auth refresh fails.
      }
    } catch (error) {
      const response = getApiResponse(error)

      setFieldErrors(mapServerFieldErrors(response))
      setFormMessage(resolveRepresentativeMessage(response))
      setSuccessMessage(null)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return <div className="error-text">내 정보를 불러올 수 없습니다.</div>
  }

  return (
    <div className="stack">
      <PageHeader description="로그인한 본인의 회원정보를 확인하고 수정합니다." title="내 정보" />
      <section className="card stack">
        <div className="grid-2">
          <label className="field">
            <span>아이디</span>
            <input disabled value={user.loginId} />
          </label>
          <label className="field">
            <span>권한</span>
            <input disabled value={getRoleLabel(user.role)} />
          </label>
          <label className="field">
            <span>계정 상태</span>
            <input disabled value={getStatusLabel(user.status)} />
          </label>
        </div>
      </section>
      <form className="card stack" noValidate onSubmit={handleSubmit}>
        {successMessage ? <div className="success-panel">{successMessage}</div> : null}
        {formMessage ? (
          <div className="error-text" role="alert">
            {formMessage}
          </div>
        ) : null}
        <div className="grid-2">
          {FIELD_DEFINITIONS.map((field) => (
            <label className="field" htmlFor={getFieldInputId(field.name)} key={field.name}>
              <span className="field-label">
                <span>{field.label}</span>
                {field.required ? (
                  <>
                    <span aria-hidden="true" className="field-required-mark">
                      *
                    </span>
                    <span className="visually-hidden">필수 입력</span>
                  </>
                ) : null}
              </span>
              <input
                aria-describedby={getFieldDescribedBy(field.name, Boolean(fieldErrors[field.name]))}
                aria-invalid={fieldErrors[field.name] ? 'true' : undefined}
                aria-required={field.required ? 'true' : undefined}
                autoComplete={field.autoComplete}
                className={getFieldInputClassName(fieldErrors[field.name])}
                id={getFieldInputId(field.name)}
                inputMode={field.inputMode}
                maxLength={field.maxLength}
                onBlur={handleBlur(field.name)}
                onChange={handleChange(field.name)}
                required={field.required}
                value={form[field.name]}
              />
              {fieldErrors[field.name] ? (
                <span className="field-error" id={getFieldErrorId(field.name)}>
                  {fieldErrors[field.name]}
                </span>
              ) : null}
            </label>
          ))}
        </div>
        <div className="actions">
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
