import { defineConfig, devices } from '@playwright/test'

const DEFAULT_BASE_URL = 'http://127.0.0.1:4173'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL
const webServer = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: DEFAULT_BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    }

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.smoke.spec.ts'],
  fullyParallel: false,
  reporter: 'list',
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  ...(webServer ? { webServer } : {}),
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
