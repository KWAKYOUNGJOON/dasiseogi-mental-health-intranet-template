import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'

export interface AuthUser {
  id: number
  loginId: string
  name: string
  phone: string | null
  positionName: string | null
  teamName: string | null
  role: 'ADMIN' | 'USER'
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'REJECTED'
}

export interface LoginResponse {
  user: AuthUser
  sessionTimeoutMinutes: number
}

export interface CreateSignupRequestPayload {
  name: string
  loginId: string
  password: string
  phone?: string
  positionName?: string
  teamName?: string
  requestMemo?: string
}

export async function login(loginId: string, password: string) {
  const response = await http.post<ApiResponse<LoginResponse>>('/auth/login', { loginId, password })
  return response.data.data
}

export async function createSignupRequest(payload: CreateSignupRequestPayload) {
  const response = await http.post<ApiResponse<{ requestId: number; userId: number; requestStatus: string }>>('/signup-requests', payload)
  return response.data.data
}

export async function fetchMe() {
  const response = await http.get<ApiResponse<AuthUser>>('/auth/me')
  return response.data.data
}

export async function logout() {
  await http.post('/auth/logout')
}
