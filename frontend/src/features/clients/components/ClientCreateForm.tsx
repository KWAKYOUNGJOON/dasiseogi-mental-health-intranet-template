import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../app/providers/AuthProvider'
import {
  CLIENT_CREATE_FIELDS,
  CLIENT_CREATE_VALIDATION_MESSAGE,
  getClientCreateApiResponse,
  getDefaultClientCreateFormValues,
  getDuplicateCheckMessage,
  hasClientCreateErrors,
  mapClientCreateFieldErrors,
  requestClientDuplicateCheck,
  resolveClientCreateRepresentativeMessage,
  submitClientCreate,
  validateClientCreateField,
  validateClientCreateForm,
  type ClientCreateFieldErrors,
  type ClientCreateFieldName,
  type ClientCreateFormValues,
  type ClientCreateTouched,
} from '../api/clientCreateApi'

interface FieldDefinition {
  name: Extract<ClientCreateFieldName, 'name' | 'birthDate' | 'phone'>
  label: string
  autoComplete?: string
  inputMode?: 'tel' | 'text'
  maxLength?: number
  type?: 'date' | 'text'
}

const FIELD_DEFINITIONS: ReadonlyArray<FieldDefinition> = [
  { name: 'name', label: '이름', autoComplete: 'name', maxLength: 50 },
  { name: 'birthDate', label: '생년월일', type: 'date' },
  { name: 'phone', label: '연락처', autoComplete: 'tel', inputMode: 'tel', maxLength: 20 },
]

function getFieldInputClassName(error: string | undefined) {
  return error ? 'input-error' : undefined
}

function getFieldInputId(field: ClientCreateFieldName) {
  return `client-create-${field}`
}

function getFieldErrorId(field: ClientCreateFieldName) {
  return `client-create-${field}-error`
}

function getFieldDescribedBy(field: ClientCreateFieldName, hasError: boolean) {
  return hasError ? getFieldErrorId(field) : undefined
}

export function ClientCreateForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [form, setForm] = useState<ClientCreateFormValues>(() => getDefaultClientCreateFormValues(user?.id ?? null))
  const [touched, setTouched] = useState<ClientCreateTouched>({})
  const [fieldErrors, setFieldErrors] = useState<ClientCreateFieldErrors>({})
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setForm((current) => {
      if (current.primaryWorkerId === (user?.id ?? null)) {
        return current
      }

      return {
        ...current,
        primaryWorkerId: user?.id ?? null,
      }
    })
  }, [user?.id])

  function updateFieldError(field: ClientCreateFieldName, nextForm: ClientCreateFormValues) {
    setFieldErrors((current) => {
      const nextErrors = { ...current }
      const message = validateClientCreateField(field, nextForm)

      if (message) {
        nextErrors[field] = message
      } else {
        delete nextErrors[field]
      }

      return nextErrors
    })
  }

  function handleFieldChange(field: ClientCreateFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        field === 'primaryWorkerId' ? Number(event.target.value) || null : (event.target.value as ClientCreateFormValues[typeof field])
      const nextForm = { ...form, [field]: value } as ClientCreateFormValues

      setForm(nextForm)

      if (field === 'name' || field === 'birthDate') {
        setDuplicateMessage(null)
      }

      if (touched[field]) {
        updateFieldError(field, nextForm)
      }

      if (formMessage === CLIENT_CREATE_VALIDATION_MESSAGE) {
        const nextErrors = validateClientCreateForm(nextForm)

        setFieldErrors(nextErrors)
        setFormMessage(hasClientCreateErrors(nextErrors) ? CLIENT_CREATE_VALIDATION_MESSAGE : null)
        return
      }

      if (formMessage) {
        setFormMessage(null)
      }
    }
  }

  function handleBlur(field: ClientCreateFieldName) {
    return () => {
      setTouched((current) => ({ ...current, [field]: true }))
      updateFieldError(field, form)
    }
  }

  async function handleDuplicateCheck() {
    if (checkingDuplicate || submitting) {
      return
    }

    if (!form.name.trim() || !form.birthDate.trim()) {
      return
    }

    setFormMessage(null)
    setCheckingDuplicate(true)

    try {
      const response = await requestClientDuplicateCheck(form)

      setDuplicateMessage(getDuplicateCheckMessage(response.isDuplicate))
    } catch (error) {
      const response = getClientCreateApiResponse(error)

      setFormMessage(resolveClientCreateRepresentativeMessage(response))
    } finally {
      setCheckingDuplicate(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting) {
      return
    }

    const nextTouched = CLIENT_CREATE_FIELDS.reduce<ClientCreateTouched>((current, field) => {
      current[field] = true
      return current
    }, {})
    const nextErrors = validateClientCreateForm(form)

    setTouched(nextTouched)
    setFieldErrors(nextErrors)

    if (hasClientCreateErrors(nextErrors)) {
      setFormMessage(CLIENT_CREATE_VALIDATION_MESSAGE)
      return
    }

    setFormMessage(null)
    setSubmitting(true)

    try {
      const created = await submitClientCreate(form)

      navigate(`/clients/${created.id}`)
    } catch (error) {
      const response = getClientCreateApiResponse(error)

      setFieldErrors(mapClientCreateFieldErrors(response))
      setFormMessage(resolveClientCreateRepresentativeMessage(response))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card stack" noValidate onSubmit={handleSubmit}>
      {formMessage ? (
        <div className="error-text" role="alert">
          {formMessage}
        </div>
      ) : null}

      <div className="grid-2">
        <label className="field" htmlFor={getFieldInputId('name')}>
          <span>이름</span>
          <input
            aria-describedby={getFieldDescribedBy('name', Boolean(fieldErrors.name))}
            aria-invalid={fieldErrors.name ? 'true' : undefined}
            autoComplete="name"
            className={getFieldInputClassName(fieldErrors.name)}
            id={getFieldInputId('name')}
            maxLength={50}
            onBlur={handleBlur('name')}
            onChange={handleFieldChange('name')}
            value={form.name}
          />
          {fieldErrors.name ? (
            <span className="field-error" id={getFieldErrorId('name')}>
              {fieldErrors.name}
            </span>
          ) : null}
        </label>

        <label className="field" htmlFor={getFieldInputId('gender')}>
          <span>성별</span>
          <select
            aria-describedby={getFieldDescribedBy('gender', Boolean(fieldErrors.gender))}
            aria-invalid={fieldErrors.gender ? 'true' : undefined}
            className={getFieldInputClassName(fieldErrors.gender)}
            id={getFieldInputId('gender')}
            onBlur={handleBlur('gender')}
            onChange={handleFieldChange('gender')}
            value={form.gender}
          >
            <option value="MALE">남성</option>
            <option value="FEMALE">여성</option>
            <option value="OTHER">기타</option>
            <option value="UNKNOWN">미상</option>
          </select>
          {fieldErrors.gender ? (
            <span className="field-error" id={getFieldErrorId('gender')}>
              {fieldErrors.gender}
            </span>
          ) : null}
        </label>

        {FIELD_DEFINITIONS.filter((field) => field.name !== 'name').map((field) => {
          const errorMessage = fieldErrors[field.name]

          return (
            <label className="field" htmlFor={getFieldInputId(field.name)} key={field.name}>
              <span>{field.label}</span>
              <input
                aria-describedby={getFieldDescribedBy(field.name, Boolean(errorMessage))}
                aria-invalid={errorMessage ? 'true' : undefined}
                autoComplete={field.autoComplete}
                className={getFieldInputClassName(errorMessage)}
                id={getFieldInputId(field.name)}
                inputMode={field.inputMode}
                maxLength={field.maxLength}
                onBlur={handleBlur(field.name)}
                onChange={handleFieldChange(field.name)}
                type={field.type ?? 'text'}
                value={form[field.name]}
              />
              {errorMessage ? (
                <span className="field-error" id={getFieldErrorId(field.name)}>
                  {errorMessage}
                </span>
              ) : null}
            </label>
          )
        })}

        <label className="field" htmlFor={getFieldInputId('primaryWorkerId')} style={{ gridColumn: '1 / -1' }}>
          <span>담당자</span>
          <input
            aria-describedby={getFieldDescribedBy('primaryWorkerId', Boolean(fieldErrors.primaryWorkerId))}
            aria-invalid={fieldErrors.primaryWorkerId ? 'true' : undefined}
            className={getFieldInputClassName(fieldErrors.primaryWorkerId)}
            disabled
            id={getFieldInputId('primaryWorkerId')}
            onBlur={handleBlur('primaryWorkerId')}
            value={user?.name ?? ''}
          />
          {fieldErrors.primaryWorkerId ? (
            <span className="field-error" id={getFieldErrorId('primaryWorkerId')}>
              {fieldErrors.primaryWorkerId}
            </span>
          ) : null}
        </label>
      </div>

      <div className="actions">
        <button className="secondary-button" disabled={checkingDuplicate || submitting} onClick={() => void handleDuplicateCheck()} type="button">
          {checkingDuplicate ? '확인 중...' : '중복 확인'}
        </button>
      </div>

      {duplicateMessage ? <div className="muted">{duplicateMessage}</div> : null}

      <div className="actions">
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
