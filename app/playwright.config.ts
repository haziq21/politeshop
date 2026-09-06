import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const envFile = new URL("./.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = 5173;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx vite dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      MOCK_POLITELIB: "1",
    },
  },
});
