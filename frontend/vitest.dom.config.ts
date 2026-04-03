import { mergeConfig } from 'vitest/config'
import sharedConfig from './vitest.shared.config'

export default mergeConfig(sharedConfig, {
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    include: ['**/*.{test,spec}.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
})
