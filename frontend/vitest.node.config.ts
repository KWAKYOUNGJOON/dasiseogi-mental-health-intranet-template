import { mergeConfig } from 'vitest/config'
import sharedConfig from './vitest.shared.config'

export default mergeConfig(sharedConfig, {
  test: {
    environment: 'node',
    include: ['**/*.{test,spec}.ts'],
  },
})
