import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'

export interface ClientListItem {
  id: number
  clientNo: string
  name: string
  birthDate: string
  gender: string
  primaryWorkerName: string
  latestSessionDate: string | null
  status: string
}

export interface ClientListPage {
  items: ClientListItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface ClientDetail {
  id: number
  clientNo: string
  name: string
  gender: string
  birthDate: string
  phone: string | null
  registeredAt: string
  createdById: number
  createdByName: string
  primaryWorkerId: number
  primaryWorkerName: string
  status: string
  misregisteredAt: string | null
  misregisteredById: number | null
  misregisteredByName: string | null
  misregisteredReason: string | null
  recentSessions: Array<{
    id: number
    sessionNo: string
    sessionCompletedAt: string
    performedByName: string
    scaleCount: number
    hasAlert: boolean
    status: string
  }>
}

export async function fetchClients(params?: {
  name?: string
  birthDate?: string
  primaryWorkerId?: number
  includeMisregistered?: boolean
  page?: number
  size?: number
}) {
  const response = await http.get<ApiResponse<ClientListPage>>('/clients', { params })
  return response.data.data
}

export async function fetchClientDetail(clientId: number) {
  const response = await http.get<ApiResponse<ClientDetail>>(`/clients/${clientId}`)
  return response.data.data
}

export async function createClient(payload: {
  name: string
  gender: string
  birthDate: string
  phone?: string
  primaryWorkerId: number
}) {
  const response = await http.post<ApiResponse<{ id: number; clientNo: string }>>('/clients', payload)
  return response.data.data
}

export async function updateClient(
  clientId: number,
  payload: {
    name: string
    gender: string
    birthDate: string
    phone?: string
    primaryWorkerId: number
  },
) {
  const response = await http.patch<ApiResponse<ClientDetail>>(`/clients/${clientId}`, payload)
  return response.data.data
}

export async function duplicateCheck(payload: { name: string; birthDate: string }) {
  const response = await http.post<
    ApiResponse<{
      isDuplicate: boolean
      candidates: Array<{
        id: number
        clientNo: string
        name: string
        birthDate: string
        gender: string
        primaryWorkerName: string
        status: string
      }>
    }>
  >('/clients/duplicate-check', payload)
  return response.data.data
}

export async function markClientMisregistered(clientId: number, reason: string) {
  const response = await http.post<
    ApiResponse<{
      clientId: number
      status: string
      processedAt: string
    }>
  >(`/clients/${clientId}/mark-misregistered`, { reason })
  return response.data.data
}
