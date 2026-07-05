import { defineConfig, devices } from "@playwright/test";

// In CI, E2E_BASE_URL points at the deployed preview. Locally, Playwright
// builds + serves the app itself via vite preview.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL, ...devices["Desktop Chrome"] },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm exec vite preview --port 4173 --strictPort",
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
});
