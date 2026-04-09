import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    dir: 'tests',
    exclude: ['dist/**', 'node_modules/**'],
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'forks',
    root: '.',
  },
})
