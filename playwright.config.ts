import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    channel: process.platform === "win32" ? "msedge" : "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
