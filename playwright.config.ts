import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${port}`;
const databaseURL = process.env.DATABASE_URL ?? "postgresql://spend:spend@127.0.0.1:5432/spend";

export default defineConfig({
  testDir: "./e2e",
  // The smoke suite shares one seeded workspace and one Next dev server.
  // Serial execution avoids concurrent first-compilation races and DB fixture contention.
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    env: { ...process.env, AUTH_TEST_MODE: "true", DATABASE_URL: databaseURL },
    url: `${baseURL}/fr/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
