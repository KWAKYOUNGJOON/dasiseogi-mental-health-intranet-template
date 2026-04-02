import { isAxiosError } from 'axios'
import type { ApiResponse } from '../../../shared/types/api'

export interface LoginFormValues {
  loginId: string
  password: string
}

export const DEFAULT_LOGIN_FORM_VALUES: LoginFormValues = {
  loginId: '',
  password: '',
}

export const DEFAULT_LOGIN_ERROR_MESSAGE = '로그인에 실패했습니다.'
export const SIGNUP_REQUEST_NOTICE = 'signup-requested'
export const SIGNUP_REQUEST_NOTICE_MESSAGE = '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.'
export const SESSION_EXPIRED_NOTICE = 'session-expired'
export const SESSION_EXPIRED_NOTICE_MESSAGE = '세션이 만료되었습니다. 다시 로그인해주세요.'

export function resolveLoginErrorMessage(error: unknown) {
  if (isAxiosError<ApiResponse<unknown>>(error)) {
    return error.response?.data?.message ?? DEFAULT_LOGIN_ERROR_MESSAGE
  }

  return DEFAULT_LOGIN_ERROR_MESSAGE
}
