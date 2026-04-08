import { describe, expect, it } from 'vitest'
import type { ClientCreateFormValues } from '../src/features/clients/api/clientCreateApi'
import {
  getClientFormFieldValue,
  getNextClientFormFromDateValue,
  getNextClientFormFromInputValue,
  getNextClientFormWithFieldValue,
} from '../src/features/clients/clientFormInputState'

function createForm(overrides?: Partial<ClientCreateFormValues>): ClientCreateFormValues {
  return {
    name: '김대상',
    gender: 'MALE',
    birthDate: '1990-01-02',
    phone: '010-1111-2222',
    primaryWorkerId: 7,
    ...overrides,
  }
}

describe('client form input state', () => {
  it('keeps primaryWorkerId input coercion aligned to number-or-null semantics', () => {
    expect(getClientFormFieldValue('primaryWorkerId', '9')).toBe(9)
    expect(getClientFormFieldValue('primaryWorkerId', '')).toBeNull()
    expect(getClientFormFieldValue('primaryWorkerId', '0')).toBeNull()
    expect(getClientFormFieldValue('primaryWorkerId', 'worker-a')).toBeNull()
  })

  it('keeps text and select fields using their raw input values', () => {
    expect(getClientFormFieldValue('name', '이새대상')).toBe('이새대상')
    expect(getClientFormFieldValue('gender', 'FEMALE')).toBe('FEMALE')
    expect(getClientFormFieldValue('phone', '010-9999-8888')).toBe('010-9999-8888')
  })

  it('builds the next form from generic input values without changing other fields', () => {
    const baseForm = createForm()

    expect(getNextClientFormFromInputValue(baseForm, 'name', '이새대상')).toEqual(
      createForm({ name: '이새대상' }),
    )
    expect(getNextClientFormFromInputValue(baseForm, 'primaryWorkerId', '15')).toEqual(
      createForm({ primaryWorkerId: 15 }),
    )
  })

  it('keeps shared direct/date nextForm updates stable', () => {
    const baseForm = createForm()

    expect(getNextClientFormWithFieldValue(baseForm, 'phone', '010-0000-0000')).toEqual(
      createForm({ phone: '010-0000-0000' }),
    )
    expect(getNextClientFormFromDateValue(baseForm, 'birthDate', '1991-03-04')).toEqual(
      createForm({ birthDate: '1991-03-04' }),
    )
  })
})
