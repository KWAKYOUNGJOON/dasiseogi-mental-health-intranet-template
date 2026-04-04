import { mergeConfig } from 'vitest/config'
import sharedConfig from './vitest.shared.config'

export default mergeConfig(sharedConfig, {
  test: {
    environment: 'happy-dom',
    include: ['**/*.{test,spec}.tsx'],
    maxWorkers: 1,
    pool: 'threads',
    setupFiles: ['./tests/setup.ts'],
  },
})
