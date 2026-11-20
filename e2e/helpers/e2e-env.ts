import { existsSync, readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

export const E2E_ACCOUNTS = {
  admin: {
    email: "admin.e2e@uc3m.es",
    password: "AdminE2E2026!",
    name: "Elena Admin",
  },
  generalAdminOnly: {
    email: "general.e2e@uc3m.es",
    password: "GeneralE2E2026!",
    name: "Carlos General",
  },
  student: {
    email: "estudiante.e2e@alumnos.uc3m.es",
    password: "StudentE2E2026!",
    name: "Lucía Estudiante",
  },
  studentTwo: {
    email: "estudiante2.e2e@alumnos.uc3m.es",
    password: "StudentTwo2026!",
    name: "Mateo Estudiante",
  },
  doorCandidate: {
    email: "puerta.e2e@alumnos.uc3m.es",
    password: "PuertaE2E2026!",
    name: "Sara Puerta",
  },
} as const;

export type MailboxEntry = {
  kind: "email-verification" | "password-reset";
  email: string;
  token: string;
  createdAt: string;
};

export function readMailboxEntries(): MailboxEntry[] {
  const filePath = process.env.AD_ASTRA_TEST_MAILBOX_FILE;
  if (!filePath || !existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf8").trim();
  if (!content) return [];

  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MailboxEntry);
}

export async function waitForMailboxToken(
  email: string,
  kind: MailboxEntry["kind"],
  previousToken?: string,
  timeoutMs = 10_000,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const entries = readMailboxEntries().filter(
      (entry) => entry.email === normalized && entry.kind === kind,
    );
    const latest = entries.at(-1);
    if (latest && latest.token !== previousToken) {
      return latest.token;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${kind} token for ${normalized} in mailbox`);
}

export async function signInAs(
  page: Page,
  account: { email: string; password: string },
): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/Correo/i).fill(account.email);
  await page.getByLabel(/Contraseña/i).fill(account.password);
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/\/$/);
}

export async function registerVerifyAndSignIn(
  page: Page,
  account: {
    firstName: string;
    lastName: string;
    email: string;
    degree?: string;
    course?: string;
    password: string;
  },
): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Nombre", { exact: true }).fill(account.firstName);
  await page.getByLabel("Apellidos", { exact: true }).fill(account.lastName);
  await page.getByLabel(/Correo institucional UC3M/i).fill(account.email);
  await page.getByLabel("Titulación", { exact: true }).fill(account.degree ?? "Ingeniería Aeroespacial");
  await page.getByLabel("Curso", { exact: true }).fill(account.course ?? "2.º");
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.waitForURL(/\/verify-email\?sent=1$/);

  const token = await waitForMailboxToken(account.email, "email-verification");
  await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
  await page.getByRole("button", { name: "Confirmar correo electrónico" }).click();
  await page.waitForURL(/\/verify-email\?verified=1$/);
  await page.getByRole("link", { name: "Acceder a la comunidad" }).click();
  await page.waitForURL(/\/sign-in$/);

  await page.getByLabel(/Correo/i).fill(account.email);
  await page.getByLabel(/Contraseña/i).fill(account.password);
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
  await page.waitForURL(/\/home$/);
}
