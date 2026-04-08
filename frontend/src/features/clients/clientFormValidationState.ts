import {
  CLIENT_CREATE_FIELDS,
  CLIENT_CREATE_VALIDATION_MESSAGE,
  hasClientCreateErrors,
  validateClientCreateField,
  validateClientCreateForm,
  type ClientCreateFieldErrors,
  type ClientCreateFieldName,
  type ClientCreateFormValues,
  type ClientCreateTouched,
} from './api/clientCreateApi'

export type ClientFormValidationChangeMode = 'create' | 'edit'

interface ClientFormChangeValidationStateOptions {
  currentFieldErrors: ClientCreateFieldErrors
  field: ClientCreateFieldName
  formMessage: string | null
  mode: ClientFormValidationChangeMode
  nextForm: ClientCreateFormValues
  touched: ClientCreateTouched
}

interface ClientFormBlurValidationStateOptions {
  currentFieldErrors: ClientCreateFieldErrors
  currentTouched: ClientCreateTouched
  field: ClientCreateFieldName
  form: ClientCreateFormValues
}

interface ClientFormValidationStateResult {
  fieldErrors: ClientCreateFieldErrors
  formMessage: string | null
}

interface ClientFormBlurValidationStateResult {
  fieldErrors: ClientCreateFieldErrors
  touched: ClientCreateTouched
}

interface ClientFormSubmitValidationStateResult {
  fieldErrors: ClientCreateFieldErrors
  hasErrors: boolean
  touched: ClientCreateTouched
}

export function getNextClientFormFieldErrors(
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

export function getNextClientFormTouched(currentTouched: ClientCreateTouched, field: ClientCreateFieldName) {
  return { ...currentTouched, [field]: true }
}

export function getClientFormChangeValidationState({
  currentFieldErrors,
  field,
  formMessage,
  mode,
  nextForm,
  touched,
}: ClientFormChangeValidationStateOptions): ClientFormValidationStateResult {
  if (mode === 'create' && formMessage === CLIENT_CREATE_VALIDATION_MESSAGE) {
    const nextErrors = validateClientCreateForm(nextForm)

    return {
      fieldErrors: nextErrors,
      formMessage: hasClientCreateErrors(nextErrors) ? CLIENT_CREATE_VALIDATION_MESSAGE : null,
    }
  }

  const shouldSyncFieldError =
    mode === 'create' ? Boolean(touched[field]) : Boolean(touched[field] || currentFieldErrors[field])

  if (shouldSyncFieldError) {
    const nextErrors = getNextClientFormFieldErrors(currentFieldErrors, field, nextForm)

    if (mode === 'edit' && formMessage === CLIENT_CREATE_VALIDATION_MESSAGE) {
      return {
        fieldErrors: nextErrors,
        formMessage: hasClientCreateErrors(nextErrors) ? CLIENT_CREATE_VALIDATION_MESSAGE : null,
      }
    }

    if (mode === 'create') {
      return {
        fieldErrors: nextErrors,
        formMessage: null,
      }
    }

    return {
      fieldErrors: nextErrors,
      formMessage: formMessage && !hasClientCreateErrors(nextErrors) ? null : formMessage,
    }
  }

  if (mode === 'create') {
    return {
      fieldErrors: currentFieldErrors,
      formMessage: null,
    }
  }

  return {
    fieldErrors: currentFieldErrors,
    formMessage: formMessage && !hasClientCreateErrors(currentFieldErrors) ? null : formMessage,
  }
}

export function getClientFormBlurValidationState({
  currentFieldErrors,
  currentTouched,
  field,
  form,
}: ClientFormBlurValidationStateOptions): ClientFormBlurValidationStateResult {
  return {
    fieldErrors: getNextClientFormFieldErrors(currentFieldErrors, field, form),
    touched: getNextClientFormTouched(currentTouched, field),
  }
}

export function getClientFormSubmitValidationState(
  form: ClientCreateFormValues,
): ClientFormSubmitValidationStateResult {
  const nextErrors = validateClientCreateForm(form)
  const nextTouched = CLIENT_CREATE_FIELDS.reduce<ClientCreateTouched>((current, field) => {
    current[field] = true
    return current
  }, {})

  return {
    fieldErrors: nextErrors,
    hasErrors: hasClientCreateErrors(nextErrors),
    touched: nextTouched,
  }
}
