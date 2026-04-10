import { mergeConfig } from 'vitest/config'
import { resolve } from 'node:path'
import sharedConfig from './vitest.shared.config'

export default mergeConfig(sharedConfig, {
  resolve: {
    alias: {
      'aria-query': resolve(import.meta.dirname, 'node_modules/aria-query/lib/index.js'),
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['./tests/vitest.global-setup.ts'],
    include: ['**/*.{test,spec}.tsx'],
    maxWorkers: 1,
    pool: 'forks',
    setupFiles: ['./tests/setup.ts'],
  },
})
