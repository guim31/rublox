import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the production build served by `apps/server` (both origins on one
 * port: `localhost` for the studio, `127.0.0.1` for the player). Run `pnpm test:e2e`.
 *
 * Without a downloaded Playwright browser (cloud sessions), point PLAYWRIGHT_CHROMIUM_PATH at
 * a Chromium binary, e.g. /opt/pw-browsers/chromium-1194/chrome-linux/chrome.
 */
const port = Number(process.env.E2E_PORT ?? 4310)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node apps/server/dist/index.js',
        url: `${baseURL}/healthz`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          NODE_ENV: 'production',
          PORT: String(port),
          STUDIO_URL: `http://localhost:${port}`,
          APPS_URL: `http://127.0.0.1:${port}`,
          DATABASE_URL: 'memory://',
          LOG_LEVEL: 'warn',
        },
      },
})
