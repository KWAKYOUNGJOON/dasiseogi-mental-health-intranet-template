import type { ClientCreateFieldName } from './api/clientCreateApi'

export type ClientFormVariant = 'create' | 'edit'

export interface ClientFormFieldDefinition {
  name: ClientCreateFieldName
  label: string
  autoComplete?: string
  inputMode?: 'tel' | 'text'
  maxLength?: number
}

export const CLIENT_FORM_FIELD_DEFINITIONS: ReadonlyArray<ClientFormFieldDefinition> = [
  { name: 'name', label: '이름', autoComplete: 'name', maxLength: 50 },
  { name: 'gender', label: '성별' },
  { name: 'birthDate', label: '생년월일' },
  { name: 'phone', label: '연락처', autoComplete: 'tel', inputMode: 'tel', maxLength: 20 },
  { name: 'primaryWorkerId', label: '담당자' },
]

const CLIENT_FORM_FIELD_DEFINITION_MAP = CLIENT_FORM_FIELD_DEFINITIONS.reduce<Record<ClientCreateFieldName, ClientFormFieldDefinition>>(
  (definitions, field) => {
    definitions[field.name] = field
    return definitions
  },
  {} as Record<ClientCreateFieldName, ClientFormFieldDefinition>,
)

export function getClientFormFieldDefinition(field: ClientCreateFieldName) {
  return CLIENT_FORM_FIELD_DEFINITION_MAP[field]
}

function getClientFormFieldIdPrefix(variant: ClientFormVariant) {
  return variant === 'create' ? 'client-create' : 'client-edit'
}

export function getClientFormFieldInputClassName(error: string | undefined) {
  return error ? 'input-error' : undefined
}

export function getClientFormFieldInputId(variant: ClientFormVariant, field: ClientCreateFieldName) {
  return `${getClientFormFieldIdPrefix(variant)}-${field}`
}

export function getClientFormFieldErrorId(variant: ClientFormVariant, field: ClientCreateFieldName) {
  return `${getClientFormFieldInputId(variant, field)}-error`
}

export function getClientFormFieldDescribedBy(variant: ClientFormVariant, field: ClientCreateFieldName, hasError: boolean) {
  return hasError ? getClientFormFieldErrorId(variant, field) : undefined
}
