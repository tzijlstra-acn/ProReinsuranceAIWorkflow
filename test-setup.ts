import { beforeAll, afterAll } from 'vitest'

// Set test database path
process.env.DATABASE_URL = './data/test-aoc.db'

beforeAll(() => {
  // Ensure test DB starts clean
})

afterAll(() => {
  // Cleanup
})
