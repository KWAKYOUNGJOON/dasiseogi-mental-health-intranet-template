import type { ClientCreateFieldName, ClientCreateFormValues } from './api/clientCreateApi'

export function getClientFormFieldValue<Field extends ClientCreateFieldName>(
  field: Field,
  value: string,
): ClientCreateFormValues[Field] {
  if (field === 'primaryWorkerId') {
    return (Number(value) || null) as ClientCreateFormValues[Field]
  }

  return value as ClientCreateFormValues[Field]
}

export function getNextClientFormWithFieldValue<Field extends ClientCreateFieldName>(
  form: ClientCreateFormValues,
  field: Field,
  value: ClientCreateFormValues[Field],
) {
  return { ...form, [field]: value } as ClientCreateFormValues
}

export function getNextClientFormFromInputValue<Field extends ClientCreateFieldName>(
  form: ClientCreateFormValues,
  field: Field,
  value: string,
) {
  return getNextClientFormWithFieldValue(form, field, getClientFormFieldValue(field, value))
}

export function getNextClientFormFromDateValue<Field extends Extract<ClientCreateFieldName, 'birthDate'>>(
  form: ClientCreateFormValues,
  field: Field,
  value: ClientCreateFormValues[Field],
) {
  return getNextClientFormWithFieldValue(form, field, value)
}
