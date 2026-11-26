/**
 * Fixtures y utilidades del navegador para los recorridos Playwright. El seed
 * crea las cuentas sintéticas compartidas. Las pruebas usan la interfaz de
 * Next.js y leen los códigos del buzón JSONL que escribe el proveedor local.
 */

import { existsSync, readFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";

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
 * @param previousOtp Código anterior. Con él se espera a que cambie la última entrada del buzón.
 * @param timeoutMs Tiempo máximo de espera en milisegundos.
 * @returns Código de la última entrada para el correo y propósito, si difiere de previousOtp.
 * Lanza un error al agotar la espera.
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
 * Espera a que terminen las transiciones CSS de un elemento (la barra al reaparecer o el menú al abrirse) para
 * no interactuar con un control en movimiento.
 * @param locator Elemento cuyas animaciones se esperan.
 * @returns Una promesa que finaliza cuando no quedan animaciones en curso.
 */
async function finishAnimations(locator: Locator): Promise<void> {
  await locator.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
}

/**
 * Abre el menú que contiene la cuenta: el menú móvil en pantallas estrechas o el menú de cuenta en
 * escritorio. Vuelve antes al inicio de la página para que la barra institucional esté visible.
 * @param page Página con una sesión activa.
 * @returns `"mobile"` o `"desktop"` según el menú abierto.
 */
export async function openAccountMenu(page: Page): Promise<"mobile" | "desktop"> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const banner = page.getByRole("banner");
  await expect(banner).toBeInViewport();
  await finishAnimations(banner);
  const openMenu = banner.getByRole("button", { name: "Abrir menú" });
  if (await openMenu.isVisible()) {
    await openMenu.click();
    await finishAnimations(page.getByRole("navigation", { name: "Navegación móvil" }));
    return "mobile";
  }
  await banner.getByRole("button", { name: /^Menú de cuenta de / }).click();
  return "desktop";
}

/**
 * Cierra la sesión por la interfaz para que un mismo recorrido pueda cambiar de usuario.
 * @param page Página con una sesión activa; el botón Cerrar sesión está en el menú de cuenta o el menú móvil.
 * @returns Una promesa que finaliza cuando el navegador vuelve a la portada.
 */
export async function signOut(page: Page): Promise<void> {
  const menu = await openAccountMenu(page);
  const role = menu === "desktop" ? "menuitem" : "button";
  await page.getByRole(role, { name: "Cerrar sesión" }).click();
  await page.waitForURL(/\/$/);
}

/**
 * Cierra el menú que abrió `openAccountMenu` y espera a que desaparezca.
 * @param page Página con el menú abierto.
 * @param menu Menú abierto, según devolvió `openAccountMenu`.
 * @returns Una promesa que finaliza con el menú cerrado.
 */
export async function closeAccountMenu(page: Page, menu: "mobile" | "desktop"): Promise<void> {
  if (menu === "mobile") {
    await page.getByRole("banner").getByRole("button", { name: "Cerrar menú" }).click();
    await page.getByRole("navigation", { name: "Navegación móvil", includeHidden: true }).waitFor({ state: "hidden" });
    return;
  }
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "hidden" });
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
