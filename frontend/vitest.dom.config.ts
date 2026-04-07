import { mergeConfig } from 'vitest/config'
import sharedConfig from './vitest.shared.config'

export default mergeConfig(sharedConfig, {
  test: {
    environment: 'node',
    globalSetup: ['./tests/vitest.global-setup.ts'],
    include: ['**/*.{test,spec}.tsx'],
    maxWorkers: 1,
    pool: 'forks',
    setupFiles: ['./tests/setup.ts'],
  },
})
