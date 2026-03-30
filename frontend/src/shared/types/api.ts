export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string | null
  errorCode: string | null
  fieldErrors: Array<{ field: string; reason: string }>
}
