import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    dir: 'tests',
    exclude: ['dist/**', 'node_modules/**'],
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'forks',
    root: '.',
  },
})
