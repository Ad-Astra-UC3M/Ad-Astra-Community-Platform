/**
 * Fixtures y utilidades del navegador para los recorridos Playwright. El seed
 * crea las cuentas sintéticas compartidas. Las pruebas usan la interfaz de
 * Next.js y leen los códigos del buzón JSONL que escribe el proveedor local.
 */

import { existsSync, readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/**
 * Credenciales y nombres de las cuentas sintéticas recreadas por el seed.
 * Los recorridos las usan para elegir el perfil y las capacidades de la sesión.
 */
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
  otp: string;
  createdAt: string;
};

/**
 * Lee el buzón JSONL de la ejecución configurada en AD_ASTRA_TEST_MAILBOX_FILE.
 * Cada línea incluye correo, propósito, código y fecha. waitForMailboxOtp
 * lo consulta para encontrar el código emitido por el proveedor de pruebas.
 * @returns Las entradas en orden de archivo o una lista vacía si el buzón no existe o está vacío.
 */
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

/**
 * Espera a que el proveedor de Auth de pruebas escriba un código para el flujo
 * que se está probando. Los recorridos de verificación y recuperación lo llaman
 * tras enviar el formulario de Next.js.
 * @param email Correo que se normaliza antes de filtrar el buzón.
 * @param kind Propósito del código, verificación del alta o recuperación.
 * @param previousOtp Código anterior que debe ignorarse para comprobar el reenvío.
 * @param timeoutMs Tiempo máximo de espera en milisegundos.
 * @returns El código más reciente que cumple el filtro. Rechaza al agotar la espera.
 */
export async function waitForMailboxOtp(
  email: string,
  kind: MailboxEntry["kind"],
  previousOtp?: string,
  timeoutMs = 10_000,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const entries = readMailboxEntries().filter(
      (entry) => entry.email === normalized && entry.kind === kind,
    );
    const latest = entries.at(-1);
    if (latest && latest.otp !== previousOtp) {
      return latest.otp;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${kind} OTP for ${normalized} in mailbox`);
}

/**
 * Envía el formulario de acceso de Next.js. Los recorridos comprueban después
 * el destino que corresponde a las capacidades o a la ruta de retorno.
 * @param page Página Playwright donde se abre /sign-in.
 * @param account Correo y contraseña de la cuenta elegida para el caso.
 * @returns Una promesa que finaliza tras pulsar Acceder.
 */
export async function signInAs(
  page: Page,
  account: { email: string; password: string },
): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/Correo/i).fill(account.email);
  await page.getByLabel(/Contraseña/i).fill(account.password);
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
}

/**
 * Cierra la sesión por la interfaz para que un mismo recorrido pueda cambiar de usuario.
 * @param page Página con una sesión activa y el botón Cerrar sesión.
 * @returns Una promesa que finaliza cuando el navegador vuelve a la portada.
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/\/$/);
}

type Registration = {
  firstName: string;
  lastName: string;
  email: string;
  degree?: string;
  course?: string;
  password: string;
};

/**
 * Completa el alta de Next.js y deja el navegador en el formulario de OTP.
 * Lo usan email-otp.spec.ts y registerVerifyAndSignIn.
 * @param page Página donde se abre /sign-up y se envía el formulario.
 * @param account Nombre, correo, contraseña y datos académicos del alta. Titulación y curso tienen valores de prueba por defecto.
 * @returns Una promesa que finaliza al llegar a /verify-email?sent=1.
 */
export async function registerForVerification(page: Page, account: Registration): Promise<void> {
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
}

/**
 * Completa el alta por la interfaz y verifica el correo con el OTP leído del
 * buzón local. Los recorridos que necesitan una cuenta nueva parten de esta sesión.
 * @param page Página Playwright que conserva la sesión después de confirmar.
 * @param account Datos sintéticos para el alta, incluido el correo con que se busca el OTP.
 * @returns Una promesa que finaliza cuando la cuenta verificada llega a /home.
 */
export async function registerVerifyAndSignIn(page: Page, account: Registration): Promise<void> {
  await registerForVerification(page, account);

  const otp = await waitForMailboxOtp(account.email, "email-verification");
  await page.getByLabel("Código de verificación").fill(otp);
  await page.getByRole("button", { name: "Confirmar correo electrónico" }).click();
  await page.waitForURL(/\/home$/);
}
