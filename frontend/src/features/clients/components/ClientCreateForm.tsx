import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../app/providers/AuthProvider'
import { DateTextInput } from '../../../shared/components/DateTextInput'
import { CLIENT_GENDER_OPTIONS, getClientStatusLabel } from '../../../shared/display/entityDisplayMetadata'
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

interface BaseFieldDefinition {
  label: string
  autoComplete?: string
  inputMode?: 'tel' | 'text'
  maxLength?: number
}

interface DateFieldDefinition extends BaseFieldDefinition {
  name: 'birthDate'
  type: 'date'
}

interface TextFieldDefinition extends BaseFieldDefinition {
  name: Extract<ClientCreateFieldName, 'name' | 'phone'>
  type?: 'text'
}

type FieldDefinition = DateFieldDefinition | TextFieldDefinition

const FIELD_DEFINITIONS: ReadonlyArray<FieldDefinition> = [
  { name: 'name', label: '이름', autoComplete: 'name', maxLength: 50 },
  { name: 'birthDate', label: '생년월일', type: 'date' },
  { name: 'phone', label: '연락처', autoComplete: 'tel', inputMode: 'tel', maxLength: 20 },
]

type DuplicateCandidate = Awaited<ReturnType<typeof requestClientDuplicateCheck>>['candidates'][number]

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
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([])
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

  function resetDuplicateCheckResult() {
    setDuplicateMessage(null)
    setDuplicateCandidates([])
  }

  function handleFieldChange(field: ClientCreateFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        field === 'primaryWorkerId' ? Number(event.target.value) || null : (event.target.value as ClientCreateFormValues[typeof field])
      const nextForm = { ...form, [field]: value } as ClientCreateFormValues

      setForm(nextForm)

      if (field === 'name' || field === 'birthDate') {
        resetDuplicateCheckResult()
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

  function handleDateFieldChange(field: Extract<ClientCreateFieldName, 'birthDate'>) {
    return (value: string) => {
      const nextForm = { ...form, [field]: value } as ClientCreateFormValues

      setForm(nextForm)
      resetDuplicateCheckResult()

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
    resetDuplicateCheckResult()
    setCheckingDuplicate(true)

    try {
      const response = await requestClientDuplicateCheck(form)

      setDuplicateMessage(getDuplicateCheckMessage(response.isDuplicate))
      setDuplicateCandidates(response.candidates)
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

  function handleCancel() {
    navigate('/clients')
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
            {CLIENT_GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
              {field.type === 'date' ? (
                <DateTextInput
                  aria-describedby={getFieldDescribedBy(field.name, Boolean(errorMessage))}
                  aria-invalid={errorMessage ? 'true' : undefined}
                  autoComplete={field.autoComplete}
                  className={getFieldInputClassName(errorMessage)}
                  id={getFieldInputId(field.name)}
                  onBlur={handleBlur(field.name)}
                  onChange={handleDateFieldChange(field.name)}
                  value={form[field.name]}
                />
              ) : (
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
              )}
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

      {duplicateCandidates.length > 0 ? (
        <div className="stack" style={{ gap: 12 }}>
          <p style={{ fontWeight: 600, margin: 0 }}>중복 후보 목록</p>
          <div style={{ overflowX: 'auto' }}>
            <table aria-label="중복 후보 목록" className="table">
              <thead>
                <tr>
                  <th>사례번호</th>
                  <th>이름</th>
                  <th>생년월일</th>
                  <th>담당자</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {duplicateCandidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>{candidate.clientNo}</td>
                    <td>{candidate.name}</td>
                    <td>{candidate.birthDate}</td>
                    <td>{candidate.primaryWorkerName || '-'}</td>
                    <td>{getClientStatusLabel(candidate.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="actions">
        <button className="secondary-button" disabled={submitting} onClick={handleCancel} type="button">
          취소
        </button>
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
