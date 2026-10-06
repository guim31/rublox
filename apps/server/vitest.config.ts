import { defineConfig } from 'vitest/config'

// Each API test file starts a PGlite database and Better Auth: slow under `turbo run test`,
// which runs every package at once.
export default defineConfig({
  test: { hookTimeout: 60_000, testTimeout: 30_000 },
})
