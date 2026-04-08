import { describe, expect, it } from 'vitest'
import { CLIENT_CREATE_VALIDATION_MESSAGE, type ClientCreateFormValues } from '../src/features/clients/api/clientCreateApi'
import {
  getClientFormBlurValidationState,
  getClientFormChangeValidationState,
  getClientFormSubmitValidationState,
  getNextClientFormFieldErrors,
} from '../src/features/clients/clientFormValidationState'

function createValidForm(overrides?: Partial<ClientCreateFormValues>): ClientCreateFormValues {
  return {
    name: '김대상',
    gender: 'MALE',
    birthDate: '1990-01-02',
    phone: '010-1111-2222',
    primaryWorkerId: 7,
    ...overrides,
  }
}

describe('client form validation state', () => {
  it('keeps the shared single-field validation sync stable', () => {
    const missingNameErrors = getNextClientFormFieldErrors({}, 'name', createValidForm({ name: '' }))
    const validNameErrors = getNextClientFormFieldErrors(
      { name: '이름을 입력해주세요.' },
      'name',
      createValidForm({ name: '새이름' }),
    )

    expect(missingNameErrors).toEqual({ name: '이름을 입력해주세요.' })
    expect(validNameErrors).toEqual({})
  })

  it('revalidates the full create form while the shared validation message is visible', () => {
    const partiallyFixedState = getClientFormChangeValidationState({
      currentFieldErrors: {
        name: '이름을 입력해주세요.',
        birthDate: '생년월일을 입력해주세요.',
      },
      field: 'name',
      formMessage: CLIENT_CREATE_VALIDATION_MESSAGE,
      mode: 'create',
      nextForm: createValidForm({ birthDate: '' }),
      touched: {},
    })
    const fullyFixedState = getClientFormChangeValidationState({
      currentFieldErrors: partiallyFixedState.fieldErrors,
      field: 'birthDate',
      formMessage: partiallyFixedState.formMessage,
      mode: 'create',
      nextForm: createValidForm(),
      touched: {},
    })

    expect(partiallyFixedState.fieldErrors).toEqual({ birthDate: '생년월일을 입력해주세요.' })
    expect(partiallyFixedState.formMessage).toBe(CLIENT_CREATE_VALIDATION_MESSAGE)
    expect(fullyFixedState.fieldErrors).toEqual({})
    expect(fullyFixedState.formMessage).toBeNull()
  })

  it('keeps the edit flow clearing only the changed field error while preserving other messages and errors', () => {
    const preservedMessageState = getClientFormChangeValidationState({
      currentFieldErrors: {
        name: '이름을 입력해주세요.',
        phone: '연락처 형식을 확인해주세요.',
      },
      field: 'phone',
      formMessage: '대상자 수정에 실패했습니다.',
      mode: 'edit',
      nextForm: createValidForm(),
      touched: {},
    })
    const clearedMessageState = getClientFormChangeValidationState({
      currentFieldErrors: { phone: '연락처 형식을 확인해주세요.' },
      field: 'phone',
      formMessage: '대상자 수정에 실패했습니다.',
      mode: 'edit',
      nextForm: createValidForm(),
      touched: {},
    })

    expect(preservedMessageState.fieldErrors).toEqual({ name: '이름을 입력해주세요.' })
    expect(preservedMessageState.formMessage).toBe('대상자 수정에 실패했습니다.')
    expect(clearedMessageState.fieldErrors).toEqual({})
    expect(clearedMessageState.formMessage).toBeNull()
  })

  it('keeps blur and submit sync behavior aligned for both shared forms', () => {
    const blurState = getClientFormBlurValidationState({
      currentFieldErrors: {},
      currentTouched: {},
      field: 'phone',
      form: createValidForm({ phone: '01012' }),
    })
    const submitState = getClientFormSubmitValidationState(createValidForm({ name: '', birthDate: '' }))

    expect(blurState.touched).toEqual({ phone: true })
    expect(blurState.fieldErrors).toEqual({ phone: '연락처 형식을 확인해주세요.' })
    expect(submitState.touched).toEqual({
      name: true,
      gender: true,
      birthDate: true,
      phone: true,
      primaryWorkerId: true,
    })
    expect(submitState.fieldErrors).toEqual({
      name: '이름을 입력해주세요.',
      birthDate: '생년월일을 입력해주세요.',
    })
    expect(submitState.hasErrors).toBe(true)
  })
})
