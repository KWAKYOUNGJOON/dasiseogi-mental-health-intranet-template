import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'

export interface StatisticsSummary {
  dateFrom: string
  dateTo: string
  totalSessionCount: number
  totalScaleCount: number
  alertSessionCount: number
  alertScaleCount: number
  performedByStats: Array<{
    userId: number
    userName: string
    sessionCount: number
  }>
}

export interface StatisticsScaleDisplayMetadata {
  scaleCode: string
  scaleName: string
  displayTitle?: string | null
  displaySubtitle?: string | null
}

export interface StatisticsScaleItem extends StatisticsScaleDisplayMetadata {
  totalCount: number
  alertCount: number
  isActive: boolean
}

export interface StatisticsScaleResponse {
  dateFrom: string
  dateTo: string
  items: StatisticsScaleItem[]
}

export interface StatisticsAlertItem extends StatisticsScaleDisplayMetadata {
  clientName: string
  sessionCompletedAt: string
  performedByName: string
  alertType: string
  alertMessage: string
  sessionId: number
}

export interface StatisticsAlertPage {
  items: StatisticsAlertItem[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export async function fetchStatisticsSummary(params: { dateFrom?: string; dateTo?: string }) {
  const response = await http.get<ApiResponse<StatisticsSummary>>('/statistics/summary', { params })
  return response.data.data
}

export async function fetchStatisticsScales(params: { dateFrom?: string; dateTo?: string }) {
  const response = await http.get<ApiResponse<StatisticsScaleResponse>>('/statistics/scales', { params })
  return response.data.data
}

export async function fetchStatisticsAlerts(params: {
  dateFrom?: string
  dateTo?: string
  scaleCode?: string
  alertType?: string
  page?: number
  size?: number
}) {
  const response = await http.get<ApiResponse<StatisticsAlertPage>>('/statistics/alerts', { params })
  const page = response.data.data

  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      sessionCompletedAt: formatSeoulDateTimeText(item.sessionCompletedAt),
    })),
  }
}

export async function downloadStatisticsExport(params: { dateFrom?: string; dateTo?: string; type: 'SUMMARY' | 'SCALE_COMPARE' | 'ALERT_LIST' }) {
  const response = await http.get('/statistics/export', {
    params,
    responseType: 'blob',
  })

  const contentDisposition = response.headers['content-disposition']
  const filenameMatch = /filename="?(.*?)"?$/i.exec(contentDisposition ?? '')
  const filename = filenameMatch?.[1] ?? `statistics-${params.type.toLowerCase()}.csv`
  const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] ?? 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
