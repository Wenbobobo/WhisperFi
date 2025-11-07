import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./frontend/tests",
  // Match either classic e2e.test.ts or files ending with .playwright.ts
  testMatch: /(e2e\.test\.ts|\.playwright\.ts)$/,
  timeout: 120 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    cwd: "./frontend",
    timeout: 180 * 1000,
  },
});
