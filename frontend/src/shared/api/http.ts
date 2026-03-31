import axios from 'axios'
import { attachSessionExpirationInterceptor } from './interceptors'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
})

attachSessionExpirationInterceptor(http)
