import { http } from '../../../shared/api/http'
import type { ApiResponse } from '../../../shared/types/api'

export interface AppMetadata {
  organizationName: string
  positionNames: string[]
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? ''
}

export async function fetchAppMetadata(): Promise<AppMetadata> {
  const response = await http.get<ApiResponse<AppMetadata>>('/app/metadata')
  const metadata = response.data.data

  return {
    organizationName: normalizeText(metadata.organizationName),
    positionNames: metadata.positionNames
      .map((value) => normalizeText(value))
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index),
  }
}
