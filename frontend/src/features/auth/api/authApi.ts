import { isAxiosError } from 'axios'
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

export interface UpdateMyProfilePayload {
  name: string
  phone?: string
  positionName?: string
  teamName?: string
}

export async function login(loginId: string, password: string) {
  const response = await http.post<ApiResponse<LoginResponse>>('/auth/login', { loginId, password })
  return response.data.data
}

export async function fetchMe() {
  const response = await http.get<ApiResponse<AuthUser>>('/auth/me')
  return response.data.data
}

export async function fetchMeOrNull() {
  try {
    return await fetchMe()
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return null
    }

    throw error
  }
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  const response = await http.patch<ApiResponse<AuthUser>>('/auth/me', payload)
  return response.data.data
}

export async function logout() {
  await http.post('/auth/logout')
}
