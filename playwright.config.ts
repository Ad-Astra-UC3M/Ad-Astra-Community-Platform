/**
 * Prepara los recorridos E2E de Next.js en escritorio y móvil. El webServer
 * ejecuta el seed y arranca el build de producción en 127.0.0.1. Los workers y
 * el servidor comparten el directorio PGlite y el buzón JSONL de la ejecución.
 * El servidor recibe credenciales de Neon vacías y usa el proveedor de Auth de
 * pruebas y una clave QR de prueba.
 */

import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseURL = "http://127.0.0.1:3941";
const runId = (process.env.AD_ASTRA_E2E_RUN_ID ||= String(process.pid));
const pgTestDir = (process.env.AD_ASTRA_PG_TEST_DIR ||= join(tmpdir(), `ad-astra-e2e-pg-${runId}`));
const mailboxFile = (process.env.AD_ASTRA_TEST_MAILBOX_FILE ||= join(tmpdir(), `ad-astra-e2e-mailbox-${runId}.jsonl`));
const qrSecret = "e2e-test-attendance-qr-secret-at-least-32-bytes-long";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npx tsx e2e/seed-e2e-db.ts && node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3941",
    url: baseURL,
    timeout: 120_000,
    env: {
      AD_ASTRA_TEST_AUTH: "1",
      AD_ASTRA_PG_TEST_DIR: pgTestDir,
      AD_ASTRA_TEST_MAILBOX_FILE: mailboxFile,
      ATTENDANCE_QR_SECRET: qrSecret,
      APP_ORIGIN: baseURL,
      DATABASE_URL: "",
      NEON_AUTH_BASE_URL: "",
      NEON_AUTH_COOKIE_SECRET: "",
    },
  },
});
