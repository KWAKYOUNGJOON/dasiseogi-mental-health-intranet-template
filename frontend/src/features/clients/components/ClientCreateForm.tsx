import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../app/providers/AuthProvider'
import { DateTextInput } from '../../../shared/components/DateTextInput'
import { CLIENT_GENDER_OPTIONS, getClientStatusLabel } from '../../../shared/display/entityDisplayMetadata'
import {
  CLIENT_FORM_FIELD_DEFINITIONS,
  getClientFormFieldDescribedBy,
  getClientFormFieldErrorId,
  getClientFormFieldInputClassName,
  getClientFormFieldInputId,
} from '../clientFormMetadata'
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

type DuplicateCandidate = Awaited<ReturnType<typeof requestClientDuplicateCheck>>['candidates'][number]
const CLIENT_CREATE_FORM_VARIANT = 'create' as const

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
        {CLIENT_FORM_FIELD_DEFINITIONS.map((field) => {
          const errorMessage = fieldErrors[field.name]
          const inputId = getClientFormFieldInputId(CLIENT_CREATE_FORM_VARIANT, field.name)
          const errorId = getClientFormFieldErrorId(CLIENT_CREATE_FORM_VARIANT, field.name)
          const describedBy = getClientFormFieldDescribedBy(CLIENT_CREATE_FORM_VARIANT, field.name, Boolean(errorMessage))

          switch (field.name) {
            case 'name':
              return (
                <label className="field" htmlFor={inputId} key={field.name}>
                  <span>{field.label}</span>
                  <input
                    aria-describedby={describedBy}
                    aria-invalid={errorMessage ? 'true' : undefined}
                    autoComplete={field.autoComplete}
                    className={getClientFormFieldInputClassName(errorMessage)}
                    id={inputId}
                    maxLength={field.maxLength}
                    onBlur={handleBlur(field.name)}
                    onChange={handleFieldChange(field.name)}
                    value={form.name}
                  />
                  {errorMessage ? (
                    <span className="field-error" id={errorId}>
                      {errorMessage}
                    </span>
                  ) : null}
                </label>
              )
            case 'gender':
              return (
                <label className="field" htmlFor={inputId} key={field.name}>
                  <span>{field.label}</span>
                  <select
                    aria-describedby={describedBy}
                    aria-invalid={errorMessage ? 'true' : undefined}
                    className={getClientFormFieldInputClassName(errorMessage)}
                    id={inputId}
                    onBlur={handleBlur(field.name)}
                    onChange={handleFieldChange(field.name)}
                    value={form.gender}
                  >
                    {CLIENT_GENDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errorMessage ? (
                    <span className="field-error" id={errorId}>
                      {errorMessage}
                    </span>
                  ) : null}
                </label>
              )
            case 'birthDate':
              return (
                <label className="field" htmlFor={inputId} key={field.name}>
                  <span>{field.label}</span>
                  <DateTextInput
                    aria-describedby={describedBy}
                    aria-invalid={errorMessage ? 'true' : undefined}
                    autoComplete={field.autoComplete}
                    className={getClientFormFieldInputClassName(errorMessage)}
                    id={inputId}
                    onBlur={handleBlur(field.name)}
                    onChange={handleDateFieldChange(field.name)}
                    value={form.birthDate}
                  />
                  {errorMessage ? (
                    <span className="field-error" id={errorId}>
                      {errorMessage}
                    </span>
                  ) : null}
                </label>
              )
            case 'phone':
              return (
                <label className="field" htmlFor={inputId} key={field.name}>
                  <span>{field.label}</span>
                  <input
                    aria-describedby={describedBy}
                    aria-invalid={errorMessage ? 'true' : undefined}
                    autoComplete={field.autoComplete}
                    className={getClientFormFieldInputClassName(errorMessage)}
                    id={inputId}
                    inputMode={field.inputMode}
                    maxLength={field.maxLength}
                    onBlur={handleBlur(field.name)}
                    onChange={handleFieldChange(field.name)}
                    value={form.phone}
                  />
                  {errorMessage ? (
                    <span className="field-error" id={errorId}>
                      {errorMessage}
                    </span>
                  ) : null}
                </label>
              )
            case 'primaryWorkerId':
              return (
                <label className="field" htmlFor={inputId} key={field.name} style={{ gridColumn: '1 / -1' }}>
                  <span>{field.label}</span>
                  <input
                    aria-describedby={describedBy}
                    aria-invalid={errorMessage ? 'true' : undefined}
                    className={getClientFormFieldInputClassName(errorMessage)}
                    disabled
                    id={inputId}
                    onBlur={handleBlur(field.name)}
                    value={user?.name ?? ''}
                  />
                  {errorMessage ? (
                    <span className="field-error" id={errorId}>
                      {errorMessage}
                    </span>
                  ) : null}
                </label>
              )
          }

          return null
        })}
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
