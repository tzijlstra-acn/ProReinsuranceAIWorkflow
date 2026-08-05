import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    // Run all test files serially (one at a time) to prevent SQLite "database is locked"
    // errors from parallel workers opening the same database file simultaneously.
    // fileParallelism: false is the Vitest 4 replacement for the removed singleFork option.
    fileParallelism: false,
    // Ensure tests run serially within each file
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
