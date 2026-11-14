import { defineConfig } from "@playwright/test";

// E2E_BASE_URL runs the tests against a deployed copy instead of a local server,
// e.g. E2E_BASE_URL=https://junmcao.github.io/exile-leveling/ npm run test:e2e
const deployedUrl = process.env.E2E_BASE_URL;
const localUrl = "http://localhost:5173/exile-leveling/";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: deployedUrl ?? localUrl,
    // The installed Chrome, so no browser has to be downloaded
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: deployedUrl
    ? undefined
    : {
        command: "npm run dev -w web",
        url: localUrl,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
