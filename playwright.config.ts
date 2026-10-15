import { defineConfig } from "@playwright/test";

// Browser checks for what jsdom can't see (real layout: scroll positions,
// sizes). Runs the dev server and the locally installed Google Chrome
// (`channel: "chrome"`), so no Playwright browser download is needed.
// `npx playwright test`
const PORT = 5199;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}/agent-next-gen-demo/`,
    channel: "chrome",
    headless: true,
    viewport: { width: 1600, height: 1000 },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/agent-next-gen-demo/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
