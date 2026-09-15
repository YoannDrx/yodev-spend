import { defineConfig, devices } from "@playwright/test";
const port=process.env.PLAYWRIGHT_PORT??"3000";
const baseURL=`http://127.0.0.1:${port}`;
export const authTestSecret="spend-local-auth-integration-secret-at-least-32-chars";
export default defineConfig({
  testDir:"./e2e-auth",workers:1,timeout:120_000,expect:{timeout:30_000},
  use:{baseURL,trace:"retain-on-failure"},
  webServer:{command:`npm run dev -- --port ${port}`,url:`${baseURL}/fr/sign-in`,reuseExistingServer:false,timeout:180_000,
    env:{...process.env,NEXT_PUBLIC_APP_URL:baseURL,AUTH_TEST_MODE:"false",DEMO_DATA_ENABLED:"false",BETTER_AUTH_SECRET:authTestSecret,GITHUB_OAUTH_CLIENT_ID:"local-test-client",GITHUB_OAUTH_CLIENT_SECRET:"local-test-secret"}},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
});
