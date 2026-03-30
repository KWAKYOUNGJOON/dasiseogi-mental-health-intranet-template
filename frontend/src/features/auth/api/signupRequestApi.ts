import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'

export interface CreateSignupRequestPayload {
  name: string
  loginId: string
  password: string
  phone: string
  positionName: string
  teamName: string
  requestMemo?: string
}

export interface CreateSignupRequestResponse {
  requestId: number
  userId: number
  requestStatus: string
}

export async function createSignupRequest(payload: CreateSignupRequestPayload) {
  const response = await http.post<ApiResponse<CreateSignupRequestResponse>>('/signup-requests', payload)
  return response.data.data
}
