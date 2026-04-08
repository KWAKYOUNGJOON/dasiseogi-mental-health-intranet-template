import { isAxiosError } from 'axios'
import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { fetchAdminUsers } from '../../features/admin/api/adminApi'
import {
  CLIENT_CREATE_FIELDS,
  CLIENT_CREATE_VALIDATION_MESSAGE,
  getClientCreateApiResponse,
  hasClientCreateErrors,
  mapClientCreateFieldErrors,
  validateClientCreateField,
  validateClientCreateForm,
  type ClientCreateFieldErrors,
  type ClientCreateFieldName,
  type ClientCreateFormValues,
  type ClientCreateTouched,
} from '../../features/clients/api/clientCreateApi'
import { fetchClientDetail, updateClient, type ClientDetail } from '../../features/clients/api/clientApi'
import {
  CLIENT_FORM_FIELD_DEFINITIONS,
  getClientFormFieldDescribedBy,
  getClientFormFieldErrorId,
  getClientFormFieldInputClassName,
  getClientFormFieldInputId,
} from '../../features/clients/clientFormMetadata'
import { DateTextInput } from '../../shared/components/DateTextInput'
import { PageHeader } from '../../shared/components/PageHeader'
import { CLIENT_GENDER_OPTIONS } from '../../shared/display/entityDisplayMetadata'
import type { ApiResponse } from '../../shared/types/api'
import { hasAdminAccess } from '../../shared/user/userMetadata'

const DEFAULT_CLIENT_EDIT_ERROR_MESSAGE = '대상자 수정에 실패했습니다.'
const CLIENT_EDIT_FORM_VARIANT = 'edit' as const

function resolveClientEditRepresentativeMessage(response: ReturnType<typeof getClientCreateApiResponse>) {
  if (response?.errorCode === 'VALIDATION_ERROR') {
    return response.message?.trim() || CLIENT_CREATE_VALIDATION_MESSAGE
  }

  return response?.message?.trim() || DEFAULT_CLIENT_EDIT_ERROR_MESSAGE
}

function getClientEditLoadErrorMessage(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return '대상자 정보를 불러오지 못했습니다.'
  }

  return error.response?.data?.message ?? '대상자 정보를 불러오지 못했습니다.'
}

export function ClientEditPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [form, setForm] = useState<ClientCreateFormValues>({
    name: '',
    gender: 'MALE',
    birthDate: '',
    phone: '',
    primaryWorkerId: null,
  })
  const [touched, setTouched] = useState<ClientCreateTouched>({})
  const [fieldErrors, setFieldErrors] = useState<ClientCreateFieldErrors>({})
  const [workerOptions, setWorkerOptions] = useState<Array<{ userId: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const hasAdminPrivileges = hasAdminAccess(user)

  const load = useCallback(async (id: number) => {
    setLoading(true)
    setLoadError(null)
    try {
      const clientData = await fetchClientDetail(id)
      setClient(clientData)
      setForm({
        name: clientData.name,
        gender: clientData.gender as ClientCreateFormValues['gender'],
        birthDate: clientData.birthDate,
        phone: clientData.phone ?? '',
        primaryWorkerId: clientData.primaryWorkerId,
      })
      setTouched({})
      setFieldErrors({})
      setFormMessage(null)

      if (hasAdminPrivileges) {
        const workers = await fetchAdminUsers({ status: 'ACTIVE', size: 100 })
        const nextOptions = workers.items.map((item) => ({ userId: item.userId, name: item.name }))
        if (!nextOptions.some((item) => item.userId === clientData.primaryWorkerId)) {
          nextOptions.unshift({ userId: clientData.primaryWorkerId, name: clientData.primaryWorkerName })
        }
        setWorkerOptions(nextOptions)
      } else {
        setWorkerOptions([{ userId: clientData.primaryWorkerId, name: clientData.primaryWorkerName }])
      }
    } catch (requestError: unknown) {
      setLoadError(getClientEditLoadErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [hasAdminPrivileges])

  useEffect(() => {
    if (!clientId) {
      return
    }
    void load(Number(clientId))
  }, [clientId, load])

  function getNextFieldErrors(
    currentFieldErrors: ClientCreateFieldErrors,
    field: ClientCreateFieldName,
    nextForm: ClientCreateFormValues,
  ) {
    const nextErrors = { ...currentFieldErrors }
    const message = validateClientCreateField(field, nextForm)

    if (message) {
      nextErrors[field] = message
    } else {
      delete nextErrors[field]
    }

    return nextErrors
  }

  function syncFieldError(field: ClientCreateFieldName, nextForm: ClientCreateFormValues) {
    const nextErrors = getNextFieldErrors(fieldErrors, field, nextForm)

    setFieldErrors(nextErrors)

    if (formMessage === CLIENT_CREATE_VALIDATION_MESSAGE) {
      setFormMessage(hasClientCreateErrors(nextErrors) ? CLIENT_CREATE_VALIDATION_MESSAGE : null)
      return
    }

    if (formMessage && !hasClientCreateErrors(nextErrors)) {
      setFormMessage(null)
    }
  }

  function handleFieldChange(field: ClientCreateFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        field === 'primaryWorkerId' ? Number(event.target.value) || null : (event.target.value as ClientCreateFormValues[typeof field])
      const nextForm = { ...form, [field]: value } as ClientCreateFormValues

      setForm(nextForm)

      if (fieldErrors[field] || touched[field]) {
        syncFieldError(field, nextForm)
        return
      }

      if (formMessage && !hasClientCreateErrors(fieldErrors)) {
        setFormMessage(null)
      }
    }
  }

  function handleDateFieldChange(field: Extract<ClientCreateFieldName, 'birthDate'>) {
    return (value: string) => {
      const nextForm = { ...form, [field]: value } as ClientCreateFormValues

      setForm(nextForm)

      if (fieldErrors[field] || touched[field]) {
        syncFieldError(field, nextForm)
        return
      }

      if (formMessage && !hasClientCreateErrors(fieldErrors)) {
        setFormMessage(null)
      }
    }
  }

  function handleBlur(field: ClientCreateFieldName) {
    return () => {
      setTouched((current) => ({ ...current, [field]: true }))
      syncFieldError(field, form)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !client) {
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

    setSaving(true)
    setFormMessage(null)
    try {
      const updated = await updateClient(client.id, {
        name: form.name.trim(),
        gender: form.gender,
        birthDate: form.birthDate.trim(),
        phone: form.phone.trim() || undefined,
        primaryWorkerId: form.primaryWorkerId!,
      })
      navigate(`/clients/${updated.id}`)
    } catch (requestError) {
      const response = getClientCreateApiResponse(requestError)

      setFieldErrors(mapClientCreateFieldErrors(response))
      setFormMessage(resolveClientEditRepresentativeMessage(response))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div>대상자 정보를 불러오는 중...</div>
  }

  if (loadError && !client) {
    return <div className="error-text">{loadError}</div>
  }

  if (!client) {
    return <div className="error-text">대상자 정보를 찾을 수 없습니다.</div>
  }

  const canEdit = hasAdminPrivileges || user?.id === client.createdById

  if (!canEdit) {
    return <div className="error-text">해당 대상자를 수정할 권한이 없습니다.</div>
  }

  return (
    <div className="stack">
      <PageHeader description={`${client.name} / 사례번호 ${client.clientNo}`} title="대상자 정보 수정" />
      <form className="card stack" noValidate onSubmit={handleSubmit}>
        {formMessage ? (
          <div className="error-text" role="alert">
            {formMessage}
          </div>
        ) : null}

        <div className="grid-2">
          {CLIENT_FORM_FIELD_DEFINITIONS.map((field) => {
            const errorMessage = fieldErrors[field.name]
            const inputId = getClientFormFieldInputId(CLIENT_EDIT_FORM_VARIANT, field.name)
            const errorId = getClientFormFieldErrorId(CLIENT_EDIT_FORM_VARIANT, field.name)
            const describedBy = getClientFormFieldDescribedBy(CLIENT_EDIT_FORM_VARIANT, field.name, Boolean(errorMessage))

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
                    {hasAdminPrivileges ? (
                      <select
                        aria-describedby={describedBy}
                        aria-invalid={errorMessage ? 'true' : undefined}
                        className={getClientFormFieldInputClassName(errorMessage)}
                        id={inputId}
                        onBlur={handleBlur(field.name)}
                        onChange={handleFieldChange(field.name)}
                        value={form.primaryWorkerId ?? ''}
                      >
                        {workerOptions.map((item) => (
                          <option key={item.userId} value={item.userId}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-describedby={describedBy}
                        aria-invalid={errorMessage ? 'true' : undefined}
                        className={getClientFormFieldInputClassName(errorMessage)}
                        disabled
                        id={inputId}
                        onBlur={handleBlur(field.name)}
                        value={client.primaryWorkerName}
                      />
                    )}
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
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? '저장 중...' : '저장'}
          </button>
          <Link className="secondary-button" to={`/clients/${client.id}`}>
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
