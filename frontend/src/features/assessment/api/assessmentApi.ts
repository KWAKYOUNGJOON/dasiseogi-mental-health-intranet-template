import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'
import { formatSeoulDateTimeText } from '../../../shared/utils/dateText'

export interface ScaleListItem {
  scaleCode: string
  scaleName: string
  displayOrder: number
  isActive: boolean
  implemented: boolean
}

export interface ScaleDetail {
  scaleCode: string
  scaleName: string
  displayOrder: number
  questionCount: number
  screeningThreshold: number | null
  questions: Array<{
    questionNo: number
    questionKey: string
    questionText: string
    reverseScored: boolean
    options: Array<{ value: string; label: string; score: number }>
  }>
}

export interface SessionDetail {
  id: number
  sessionNo: string
  status: string
  sessionDate: string
  sessionStartedAt: string
  sessionCompletedAt: string
  performedById: number
  performedByName: string
  clientId: number
  clientNo: string
  clientName: string
  clientBirthDate: string
  clientGender: string
  memo: string | null
  misenteredAt: string | null
  misenteredById: number | null
  misenteredByName: string | null
  misenteredReason: string | null
  hasAlert: boolean
  scales: Array<{
    sessionScaleId: number
    scaleCode: string
    scaleName: string
    displayOrder: number
    totalScore: number
    resultLevel: string
    hasAlert: boolean
    answers: Array<{
      questionNo: number
      questionKey: string
      questionText: string
      answerValue: string
      answerLabel: string
      scoreValue: number
    }>
    alerts: Array<{
      id: number
      scaleCode: string
      alertType: string
      alertCode: string
      alertMessage: string
      questionNo: number | null
      triggerValue: string | null
    }>
  }>
  alerts: Array<{
    id: number
    scaleCode: string
    alertType: string
    alertCode: string
    alertMessage: string
    questionNo: number | null
    triggerValue: string | null
  }>
}

export interface SessionPrintData {
  institutionName: string
  teamName: string | null
  performedByName: string
  sessionNo: string
  sessionStartedAt: string
  sessionCompletedAt: string
  client: {
    clientId: number
    clientNo: string
    name: string
    birthDate: string
    gender: string
  }
  scales: Array<{
    scaleCode: string
    scaleName: string
    totalScore: number
    resultLevel: string
    alertMessages: string[]
  }>
  hasAlert: boolean
  scaleCount: number
  alertCount: number
  summaryText: string
}

export interface AssessmentRecordPage {
  items: Array<{
    sessionId: number
    sessionScaleId: number
    sessionNo: string
    sessionCompletedAt: string
    clientId: number
    clientName: string
    performedByName: string
    scaleCode: string | null
    scaleName: string
    totalScore: number
    resultLevel: string
    hasAlert: boolean
    sessionStatus: string
  }>
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export async function fetchScales() {
  const response = await http.get<ApiResponse<ScaleListItem[]>>('/scales')
  return response.data.data
}

export async function fetchScaleDetail(scaleCode: string) {
  const response = await http.get<ApiResponse<ScaleDetail>>(`/scales/${scaleCode}`)
  return response.data.data
}

export async function createAssessmentSession(payload: {
  clientId: number
  sessionStartedAt: string
  sessionCompletedAt: string
  memo: string
  selectedScales: Array<{
    scaleCode: string
    answers: Array<{ questionNo: number; answerValue: string }>
  }>
}) {
  const response = await http.post<
    ApiResponse<{
      sessionId: number
      sessionNo: string
      clientId: number
      status: string
      scaleCount: number
      hasAlert: boolean
    }>
  >('/assessment-sessions', payload)
  return response.data.data
}

export async function fetchSessionDetail(sessionId: number, options?: { highlightScaleCode?: string }) {
  const response = await http.get<ApiResponse<SessionDetail>>(`/assessment-sessions/${sessionId}`, {
    params: options?.highlightScaleCode ? { highlightScaleCode: options.highlightScaleCode } : undefined,
  })
  const session = response.data.data

  return {
    ...session,
    sessionStartedAt: formatSeoulDateTimeText(session.sessionStartedAt),
    sessionCompletedAt: formatSeoulDateTimeText(session.sessionCompletedAt),
    misenteredAt: session.misenteredAt ? formatSeoulDateTimeText(session.misenteredAt) : null,
  }
}

export async function fetchSessionPrintData(sessionId: number) {
  const response = await http.get<ApiResponse<SessionPrintData>>(`/assessment-sessions/${sessionId}/print-data`)
  const data = response.data.data

  return {
    ...data,
    sessionStartedAt: formatSeoulDateTimeText(data.sessionStartedAt),
    sessionCompletedAt: formatSeoulDateTimeText(data.sessionCompletedAt),
  }
}

export async function markSessionMisentered(sessionId: number, reason: string) {
  const response = await http.post<
    ApiResponse<{
      sessionId: number
      status: string
      misenteredAt: string
    }>
  >(`/assessment-sessions/${sessionId}/mark-misentered`, { reason })
  return response.data.data
}

export async function fetchAssessmentRecords(params: {
  dateFrom?: string
  dateTo?: string
  clientName?: string
  scaleCode?: string
  includeMisentered?: boolean
  page?: number
  size?: number
}) {
  const response = await http.get<ApiResponse<AssessmentRecordPage>>('/assessment-records', { params })
  const page = response.data.data

  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      sessionCompletedAt: formatSeoulDateTimeText(item.sessionCompletedAt),
    })),
  }
}
