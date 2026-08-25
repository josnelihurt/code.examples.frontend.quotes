import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// The default e2e suite: the real SPA against the MSW mock platform — no backend,
// no database, nothing outside this repository. The same feature files also run
// full-stack from a net-examples checkout (playwright.fullstack.config.ts); the
// steps are shared, so journeys stay identical across both.
const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: 'e2e/steps/**/*.ts',
  outputDir: '.features-gen',
});

// scripts/e2e.sh hands its Vite port over via E2E_VITE_PORT when it drives this
// suite; the fallback matches the historical fixed port. Unlike the full-stack
// config there is no e2e.env to parse — nothing here reaches the parent tree.
const VITE_PORT = process.env.E2E_VITE_PORT ?? '5173';
const VITE_HTTP = `http://127.0.0.1:${VITE_PORT}`;

export default defineConfig({
  testDir,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'html',
  use: { baseURL: VITE_HTTP, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  // Not the full-stack suite's single-worker constraint: every scenario here gets
  // its own browser context and therefore its own fresh seeded catalog, so
  // scenarios cannot observe each other's publishes no matter how they interleave.
  fullyParallel: true,
  // dev:mock is `VITE_MSW=1 vite` — the app boots the mock worker before it
  // renders (src/main.tsx), so journeys hit the mock platform from the first
  // click. --host pins IPv4 loopback: Vite binds ::1 only by default, which
  // leaves the 127.0.0.1 readiness probe refused even though the server is up.
  webServer: [
    {
      command: `pnpm run dev:mock --host 127.0.0.1 --port ${VITE_PORT} --strictPort`,
      url: VITE_HTTP,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
