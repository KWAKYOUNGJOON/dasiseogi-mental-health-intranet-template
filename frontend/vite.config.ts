import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.APP_SERVER_PORT || '8080'
  const frontendPort = Number(env.APP_FRONTEND_PORT || '4173')
  const proxyTarget = env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${backendPort}`

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
    },
  }
})
