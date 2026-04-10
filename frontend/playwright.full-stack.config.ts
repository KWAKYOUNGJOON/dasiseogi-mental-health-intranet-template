import { defineConfig, devices } from '@playwright/test'

const FULL_STACK_HOST = '127.0.0.1'
const FULL_STACK_PORT = 4174
const DEFAULT_BASE_URL = `http://${FULL_STACK_HOST}:${FULL_STACK_PORT}`
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL
const webServer = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: 'npm run dev:e2e:full-stack',
      url: DEFAULT_BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    }

export default defineConfig({
  testDir: './e2e/full-stack',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
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
