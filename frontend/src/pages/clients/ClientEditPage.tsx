import { isAxiosError } from 'axios'
import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useState } from 'react'
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
import { DateTextInput } from '../../shared/components/DateTextInput'
import { PageHeader } from '../../shared/components/PageHeader'
import { CLIENT_GENDER_OPTIONS } from '../../shared/display/entityDisplayMetadata'
import type { ApiResponse } from '../../shared/types/api'
import { hasAdminAccess } from '../../shared/user/userMetadata'

const DEFAULT_CLIENT_EDIT_ERROR_MESSAGE = '대상자 수정에 실패했습니다.'

function getFieldInputClassName(error: string | undefined) {
  return error ? 'input-error' : undefined
}

function getFieldInputId(field: ClientCreateFieldName) {
  return `client-edit-${field}`
}

function getFieldErrorId(field: ClientCreateFieldName) {
  return `client-edit-${field}-error`
}

function getFieldDescribedBy(field: ClientCreateFieldName, hasError: boolean) {
  return hasError ? getFieldErrorId(field) : undefined
}

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

  useEffect(() => {
    if (!clientId) {
      return
    }
    void load(Number(clientId))
  }, [clientId, hasAdminPrivileges])

  async function load(id: number) {
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
  }

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

          <label className="field" htmlFor={getFieldInputId('birthDate')}>
            <span>생년월일</span>
            <DateTextInput
              aria-describedby={getFieldDescribedBy('birthDate', Boolean(fieldErrors.birthDate))}
              aria-invalid={fieldErrors.birthDate ? 'true' : undefined}
              className={getFieldInputClassName(fieldErrors.birthDate)}
              id={getFieldInputId('birthDate')}
              onBlur={handleBlur('birthDate')}
              onChange={handleDateFieldChange('birthDate')}
              value={form.birthDate}
            />
            {fieldErrors.birthDate ? (
              <span className="field-error" id={getFieldErrorId('birthDate')}>
                {fieldErrors.birthDate}
              </span>
            ) : null}
          </label>

          <label className="field" htmlFor={getFieldInputId('phone')}>
            <span>연락처</span>
            <input
              aria-describedby={getFieldDescribedBy('phone', Boolean(fieldErrors.phone))}
              aria-invalid={fieldErrors.phone ? 'true' : undefined}
              autoComplete="tel"
              className={getFieldInputClassName(fieldErrors.phone)}
              id={getFieldInputId('phone')}
              inputMode="tel"
              maxLength={20}
              onBlur={handleBlur('phone')}
              onChange={handleFieldChange('phone')}
              value={form.phone}
            />
            {fieldErrors.phone ? (
              <span className="field-error" id={getFieldErrorId('phone')}>
                {fieldErrors.phone}
              </span>
            ) : null}
          </label>

          <label className="field" htmlFor={getFieldInputId('primaryWorkerId')} style={{ gridColumn: '1 / -1' }}>
            <span>담당자</span>
            {hasAdminPrivileges ? (
              <select
                aria-describedby={getFieldDescribedBy('primaryWorkerId', Boolean(fieldErrors.primaryWorkerId))}
                aria-invalid={fieldErrors.primaryWorkerId ? 'true' : undefined}
                className={getFieldInputClassName(fieldErrors.primaryWorkerId)}
                id={getFieldInputId('primaryWorkerId')}
                onBlur={handleBlur('primaryWorkerId')}
                onChange={handleFieldChange('primaryWorkerId')}
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
                aria-describedby={getFieldDescribedBy('primaryWorkerId', Boolean(fieldErrors.primaryWorkerId))}
                aria-invalid={fieldErrors.primaryWorkerId ? 'true' : undefined}
                className={getFieldInputClassName(fieldErrors.primaryWorkerId)}
                disabled
                id={getFieldInputId('primaryWorkerId')}
                onBlur={handleBlur('primaryWorkerId')}
                value={client.primaryWorkerName}
              />
            )}
            {fieldErrors.primaryWorkerId ? (
              <span className="field-error" id={getFieldErrorId('primaryWorkerId')}>
                {fieldErrors.primaryWorkerId}
              </span>
            ) : null}
          </label>
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
