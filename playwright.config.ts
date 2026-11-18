import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseURL = "http://127.0.0.1:3941";
export default defineConfig({
  testDir: "./e2e",
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  projects: [
    {name: "desktop", use: {viewport: {width: 1280, height: 800}}},
    {name: "mobile", use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}}
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3941",
    url: baseURL,
    env: { AD_ASTRA_DEMO_DB: join(tmpdir(), "ad-astra-e2e-" + process.pid + ".sqlite") }
  }
});
