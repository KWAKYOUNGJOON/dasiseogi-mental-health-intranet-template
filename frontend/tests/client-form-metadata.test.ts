import { describe, expect, it } from 'vitest'
import {
  CLIENT_FORM_FIELD_DEFINITIONS,
  getClientFormFieldDefinition,
  getClientFormFieldDescribedBy,
  getClientFormFieldErrorId,
  getClientFormFieldInputClassName,
  getClientFormFieldInputId,
} from '../src/features/clients/clientFormMetadata'

describe('client form metadata', () => {
  it('keeps the shared client form field order, labels, and input attrs stable', () => {
    expect(CLIENT_FORM_FIELD_DEFINITIONS).toEqual([
      { name: 'name', label: '이름', autoComplete: 'name', maxLength: 50 },
      { name: 'gender', label: '성별' },
      { name: 'birthDate', label: '생년월일' },
      { name: 'phone', label: '연락처', autoComplete: 'tel', inputMode: 'tel', maxLength: 20 },
      { name: 'primaryWorkerId', label: '담당자' },
    ])

    expect(getClientFormFieldDefinition('name')).toBe(CLIENT_FORM_FIELD_DEFINITIONS[0])
    expect(getClientFormFieldDefinition('gender')).toBe(CLIENT_FORM_FIELD_DEFINITIONS[1])
    expect(getClientFormFieldDefinition('birthDate')).toBe(CLIENT_FORM_FIELD_DEFINITIONS[2])
    expect(getClientFormFieldDefinition('phone')).toBe(CLIENT_FORM_FIELD_DEFINITIONS[3])
    expect(getClientFormFieldDefinition('primaryWorkerId')).toBe(CLIENT_FORM_FIELD_DEFINITIONS[4])
  })

  it('keeps the shared field helper outputs stable for create and edit variants', () => {
    expect(getClientFormFieldInputClassName(undefined)).toBeUndefined()
    expect(getClientFormFieldInputClassName('이름을 입력해주세요.')).toBe('input-error')

    expect(getClientFormFieldInputId('create', 'phone')).toBe('client-create-phone')
    expect(getClientFormFieldErrorId('create', 'phone')).toBe('client-create-phone-error')
    expect(getClientFormFieldDescribedBy('create', 'phone', false)).toBeUndefined()
    expect(getClientFormFieldDescribedBy('create', 'phone', true)).toBe('client-create-phone-error')

    expect(getClientFormFieldInputId('edit', 'primaryWorkerId')).toBe('client-edit-primaryWorkerId')
    expect(getClientFormFieldErrorId('edit', 'primaryWorkerId')).toBe('client-edit-primaryWorkerId-error')
    expect(getClientFormFieldDescribedBy('edit', 'primaryWorkerId', false)).toBeUndefined()
    expect(getClientFormFieldDescribedBy('edit', 'primaryWorkerId', true)).toBe('client-edit-primaryWorkerId-error')
  })
})
