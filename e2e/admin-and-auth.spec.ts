/**
 * Recorridos Playwright de acceso, recuperación por OTP y gestión por
 * capacidades. Ejercitan páginas y Server Actions del build de Next.js con las
 * cuentas y datos sintéticos preparados en PGlite.
 */

import { expect, test } from "@playwright/test";
import {
  E2E_ACCOUNTS,
  registerVerifyAndSignIn,
  signInAs,
  signOut,
  waitForMailboxOtp,
} from "./helpers/e2e-env";

/**
 * Comprueba los 404 y los accesos autorizados al cambiar de una cuenta con
 * general_admin a otra con consulta de talento y a un miembro sin capacidades.
 */
test("CA-01: capacidades independientes en /admin con 404 al carecer de permiso", async ({ page }) => {
  // Cuenta con solo general_admin: acceso a /admin y /admin/accounts, 404 en /admin/talent
  await signInAs(page, E2E_ACCOUNTS.generalAdminOnly);
  await expect(page).toHaveURL(/\/admin$/);
  expect((await page.request.get("/admin/talent")).status()).toBe(404);
  expect((await page.request.get("/admin/accounts")).status()).toBe(200);

  // Cuenta con talent_consultation: acceso a /admin/talent
  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin$/);
  const talentResponse = await page.goto("/admin/talent");
  expect(talentResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Perfiles voluntarios de talento" })).toBeVisible();

  // Cuenta sin capacidades: HTTP 404 en /admin y subrutas
  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.student);
  await expect(page).toHaveURL(/\/home$/);
  expect((await page.request.get("/admin")).status()).toBe(404);
  expect((await page.request.get("/admin/talent")).status()).toBe(404);
});

/**
 * Prueba el retorno a un destino protegido, el reintento con el mismo código
 * ante un error de formulario y el consumo del OTP tras el cambio de contraseña.
 */
test("CA-02 y CA-03: retorno a ruta protegida tras acceso y recuperación de contraseña", async ({ page }, info) => {
  const email = `recuperacion.${info.project.name}@alumnos.uc3m.es`;
  const initialPassword = "ClaveInicial2026!";
  const nextPassword = "ClaveNueva2026!";

  await registerVerifyAndSignIn(page, {
    firstName: "Marco",
    lastName: `Acceso ${info.project.name}`,
    email,
    password: initialPassword,
  });
  await signOut(page);

  // Acceso directo a ruta interna protegida redirige con ?next= y retorna tras iniciar sesión
  await page.goto("/bookmarks");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fbookmarks$/);
  await page.getByLabel(/Correo/i).fill(email);
  await page.getByLabel(/Contraseña/i).fill(initialPassword);
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
  await expect(page).toHaveURL(/\/bookmarks$/);

  // El buzón de pruebas permite copiar el código que recibe el usuario.
  await signOut(page);
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "¿Has olvidado tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel(/Correo/i).fill(email);
  await page.getByRole("button", { name: "Solicitar recuperación" }).click();
  await expect(page).toHaveURL(/\/reset-password\?sent=1$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("status")).toContainText("código de recuperación");
  const emailField = main.getByLabel("Correo institucional UC3M");
  await expect(emailField).toHaveValue(email);

  const otp = await waitForMailboxOtp(email, "password-reset");
  expect(otp).toMatch(/^\d{6}$/);
  /**
   * Envía el formulario con el OTP ya leído por el caso de recuperación.
   * @param password Contraseña nueva que se prueba en este intento.
   * @param confirmation Confirmación, igual por defecto. Un valor distinto provoca el error de formulario.
   * @returns Una promesa que finaliza al pulsar Guardar nueva contraseña. El caso comprueba el resultado.
   */
  const submitPasswordReset = async (password: string, confirmation = password) => {
    await main.getByLabel("Código de recuperación").fill(otp);
    await main.getByLabel("Nueva contraseña", { exact: true }).fill(password);
    await main.getByLabel("Confirmar nueva contraseña", { exact: true }).fill(confirmation);
    await main.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  };

  // Un error de formulario permite reintentar con el mismo código.
  await submitPasswordReset(nextPassword, initialPassword);
  await expect(page).toHaveURL(/\/reset-password\?error=mismatch$/);
  await expect(main.getByRole("alert")).toContainText("no coinciden");
  await expect(emailField).toHaveValue(email);

  await submitPasswordReset(nextPassword);
  await expect(page).toHaveURL(/\/sign-in\?reset=ok$/);
  await expect(page.getByRole("status")).toContainText("Contraseña actualizada");

  await page.goto("/reset-password");
  await emailField.fill(email);
  await submitPasswordReset("ClaveReutilizada2026!");
  await expect(page).toHaveURL(/\/reset-password\?error=invalid$/);
  await expect(main.getByRole("alert")).toBeVisible();
  await page.goto("/sign-in");

  // Contraseña antigua rechazada y nueva aceptada
  await page.getByLabel(/Correo/i).fill(email);
  await page.getByLabel(/Contraseña/i).fill(initialPassword);
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Comprueba");

  await page.getByLabel(/Correo/i).fill(email);
  await page.getByLabel(/Contraseña/i).fill(nextPassword);
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

/**
 * Sigue tres tareas del panel iniciadas con datos del mismo recorrido. Verifica
 * el turno normal, la separación entre inscripción en puerta y asistencia con
 * auditoría, y el cierre motivado de la solicitud de supresión.
 */
test("CA-06, CA-10 y CA-11: alta en puerta, confirmación manual, actividad con turno normal y resolución de supresión", async ({ page }, info) => {
  const email = `puerta.${info.project.name}@alumnos.uc3m.es`;
  await registerVerifyAndSignIn(page, {
    firstName: "Sofía",
    lastName: `Puerta ${info.project.name}`,
    email,
    password: "PuertaPassword2026!",
  });

  await page.goto("/profile/privacy");
  await page.getByLabel("Motivo (opcional)").fill(`Solicitud E2E ${info.project.name}`);
  await page.getByRole("button", { name: "Solicitar supresión de cuenta" }).click();
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();

  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin$/);

  // CA-06: crear actividad dejando vacío el nombre de turno -> crea turno «normal»
  const activityTitle = `Seminario de guiado orbital (${info.project.name})`;
  await page.goto("/admin/activities");
  await page.getByLabel("Título", { exact: true }).fill(activityTitle);
  await page.getByLabel("Descripción", { exact: true }).fill("Introducción práctica a trayectorias y guiado.");
  await page.getByLabel("Ubicación", { exact: true }).fill("Aula 1.2 · Leganés");
  await page.getByRole("button", { name: "Crear actividad" }).click();
  await expect(page.getByRole("status")).toContainText("Actividad creada correctamente.");
  const createdCard = page.locator("article", { hasText: activityTitle });
  await expect(createdCard).toContainText("normal");

  // CA-10: inscripción manual en puerta (deja en Apuntado) + confirmación manual separada con auditoría
  await page.goto("/admin");
  await page.getByRole("link", { name: /Validar Grupo A/i }).click();
  const doorSelect = page.getByLabel("Cuenta activa a inscribir");
  const studentOptionValue = await doorSelect
    .locator("option", { hasText: email })
    .first()
    .getAttribute("value");
  expect(studentOptionValue).toBeTruthy();
  await doorSelect.selectOption(studentOptionValue!);
  await page.getByLabel("Motivo del alta en puerta").fill("Alta presencial con plaza libre");
  await page.getByRole("button", { name: "Inscribir en puerta" }).click();
  await expect(page.getByText("Inscripción en puerta registrada en estado «Apuntado»")).toBeVisible();

  const attendeeRow = page.locator("li", { hasText: email });
  await attendeeRow.getByLabel(/Motivo de confirmación manual/).fill("Verificación manual sin cámara");
  await attendeeRow.getByRole("button", { name: "Confirmar asistencia manualmente" }).click();
  await expect(page.getByText("Asistencia confirmada manualmente y registrada en auditoría.")).toBeVisible();
  const auditSection = page.locator("section[aria-label='Historial de correcciones y altas en puerta']");
  await expect(auditSection).toContainText("Alta en puerta");
  await expect(auditSection).toContainText("Confirmación manual");

  // CA-11: resolución motivada de la solicitud de supresión
  await page.goto("/admin/deletion-requests");
  await page.locator("li", { hasText: email }).getByRole("link", { name: "Gestionar solicitud" }).click();
  await expect(page).toHaveURL(/\/admin\/deletion-requests\/.+$/);
  await page.getByLabel("Resultado motivado de la resolución").fill("Solicitud revisada y resuelta conforme al aviso de privacidad.");
  await page.getByRole("button", { name: "Marcar como resuelta" }).click();
  await expect(page.getByRole("status")).toContainText("Solicitud resuelta con resultado motivado");
  await expect(page.getByText("Resuelta por")).toBeVisible();
});
