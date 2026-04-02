import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['jsdom', '@testing-library/react', '@testing-library/user-event', '@testing-library/jest-dom'],
        },
      },
    },
    dir: 'tests',
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['dist/**', 'node_modules/**'],
    root: '.',
    setupFiles: ['./tests/setup.ts'],
  },
})
