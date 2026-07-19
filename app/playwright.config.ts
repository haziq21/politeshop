import { defineConfig } from "@playwright/test";

// Playwright test files run as plain Node scripts (not through Vite), so
// `$env/static/private` isn't available. Load `app/.env` directly instead —
// it provides `DATABASE_URL`, used both by the dev server this config starts
// and by `e2e/db.ts` for fixture seeding/cleanup.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch {
  // No .env file — assume DATABASE_URL etc. are already in the environment
  // (e.g. set directly in CI).
}

const PORT = 5173;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // tests share one database; avoid cross-test interference
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: process.env.PLAYWRIGHT_HTML_OPEN === "never" ? "never" : "on-failure" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx vite dev --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      // Swaps real POLITELib for fixture-based MockPOLITELib in hooks.server.ts.
      MOCK_POLITELIB: "1",
    },
  },
});
