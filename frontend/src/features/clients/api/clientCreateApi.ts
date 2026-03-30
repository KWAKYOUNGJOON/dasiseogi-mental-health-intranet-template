import { isAxiosError } from 'axios'
import type { ApiResponse } from '../../../shared/types/api'
import { createClient, duplicateCheck } from './clientApi'

const CLIENT_CREATE_GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'] as const

export const CLIENT_CREATE_FIELDS = ['name', 'gender', 'birthDate', 'phone', 'primaryWorkerId'] as const
export const CLIENT_CREATE_VALIDATION_MESSAGE = '입력값을 다시 확인해주세요.'
export const DEFAULT_CLIENT_CREATE_ERROR_MESSAGE = '대상자 등록에 실패했습니다.'
export const CLIENT_DUPLICATE_FOUND_MESSAGE = '동일 이름/생년월일 대상자가 이미 있습니다. 계속 등록할 수 있습니다.'
export const CLIENT_DUPLICATE_EMPTY_MESSAGE = '중복 후보가 없습니다.'

const PHONE_PATTERN = /^\d{2,3}-?\d{3,4}-?\d{4}$/
const SERVER_FIELD_ALIASES: Readonly<Record<string, ClientCreateFieldName>> = {
  birthDate: 'birthDate',
  contact: 'phone',
  gender: 'gender',
  name: 'name',
  phone: 'phone',
  primaryWorker: 'primaryWorkerId',
  primaryWorkerId: 'primaryWorkerId',
}

export type ClientCreateFieldName = (typeof CLIENT_CREATE_FIELDS)[number]
export type ClientGender = (typeof CLIENT_CREATE_GENDERS)[number]
export type ClientCreateFieldErrors = Partial<Record<ClientCreateFieldName, string>>
export type ClientCreateTouched = Partial<Record<ClientCreateFieldName, boolean>>

export interface ClientCreateFormValues {
  name: string
  gender: ClientGender
  birthDate: string
  phone: string
  primaryWorkerId: number | null
}

export function getDefaultClientCreateFormValues(primaryWorkerId: number | null): ClientCreateFormValues {
  return {
    name: '',
    gender: 'MALE',
    birthDate: '',
    phone: '',
    primaryWorkerId,
  }
}

function trimValue(value: string) {
  return value.trim()
}

function normalizeFormValues(values: ClientCreateFormValues): ClientCreateFormValues {
  return {
    name: trimValue(values.name),
    gender: values.gender,
    birthDate: trimValue(values.birthDate),
    phone: trimValue(values.phone),
    primaryWorkerId: values.primaryWorkerId,
  }
}

function getTodayDateText() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000

  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function isValidDateText(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsedDate = new Date(Date.UTC(year, month - 1, day))

  if (Number.isNaN(parsedDate.getTime())) {
    return false
  }

  return parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day
}

function isGenderValue(value: string): value is ClientGender {
  return CLIENT_CREATE_GENDERS.includes(value as ClientGender)
}

export function validateClientCreateField(field: ClientCreateFieldName, values: ClientCreateFormValues) {
  const normalized = normalizeFormValues(values)

  switch (field) {
    case 'name':
      if (!normalized.name) {
        return '이름을 입력해주세요.'
      }
      if (normalized.name.length > 50) {
        return '이름은 50자 이하로 입력해주세요.'
      }
      return undefined
    case 'gender':
      if (!normalized.gender) {
        return '성별을 입력해주세요.'
      }
      if (!isGenderValue(normalized.gender)) {
        return '성별을 다시 확인해주세요.'
      }
      return undefined
    case 'birthDate':
      if (!normalized.birthDate) {
        return '생년월일을 입력해주세요.'
      }
      if (!isValidDateText(normalized.birthDate)) {
        return '생년월일 형식을 다시 확인해주세요.'
      }
      if (normalized.birthDate > getTodayDateText()) {
        return '생년월일은 미래일 수 없습니다.'
      }
      return undefined
    case 'phone':
      if (normalized.phone && !PHONE_PATTERN.test(normalized.phone)) {
        return '연락처 형식을 확인해주세요.'
      }
      return undefined
    case 'primaryWorkerId':
      if (!normalized.primaryWorkerId) {
        return '담당자를 선택해주세요.'
      }
      return undefined
  }
}

export function validateClientCreateForm(values: ClientCreateFormValues) {
  return CLIENT_CREATE_FIELDS.reduce<ClientCreateFieldErrors>((errors, field) => {
    const message = validateClientCreateField(field, values)

    if (message) {
      errors[field] = message
    }

    return errors
  }, {})
}

export function hasClientCreateErrors(errors: ClientCreateFieldErrors) {
  return Object.keys(errors).length > 0
}

export async function requestClientDuplicateCheck(values: Pick<ClientCreateFormValues, 'name' | 'birthDate'>) {
  return duplicateCheck({
    name: trimValue(values.name),
    birthDate: trimValue(values.birthDate),
  })
}

export function getDuplicateCheckMessage(isDuplicate: boolean) {
  return isDuplicate ? CLIENT_DUPLICATE_FOUND_MESSAGE : CLIENT_DUPLICATE_EMPTY_MESSAGE
}

export async function submitClientCreate(values: ClientCreateFormValues) {
  const normalized = normalizeFormValues(values)

  return createClient({
    name: normalized.name,
    gender: normalized.gender,
    birthDate: normalized.birthDate,
    phone: normalized.phone || undefined,
    primaryWorkerId: normalized.primaryWorkerId!,
  })
}

export function getClientCreateApiResponse(error: unknown) {
  if (!isAxiosError<ApiResponse<unknown>>(error)) {
    return undefined
  }

  return error.response?.data
}

function resolveClientCreateField(field: string) {
  return SERVER_FIELD_ALIASES[field.trim()]
}

export function mapClientCreateFieldErrors(response: ApiResponse<unknown> | undefined) {
  return (response?.fieldErrors ?? []).reduce<ClientCreateFieldErrors>((errors, fieldError) => {
    const field = resolveClientCreateField(fieldError.field)
    const reason = fieldError.reason.trim()

    if (field && reason) {
      errors[field] = reason
    }

    return errors
  }, {})
}

export function resolveClientCreateRepresentativeMessage(response: ApiResponse<unknown> | undefined) {
  if (response?.errorCode === 'VALIDATION_ERROR') {
    return response.message?.trim() || CLIENT_CREATE_VALIDATION_MESSAGE
  }

  return response?.message?.trim() || DEFAULT_CLIENT_CREATE_ERROR_MESSAGE
}
