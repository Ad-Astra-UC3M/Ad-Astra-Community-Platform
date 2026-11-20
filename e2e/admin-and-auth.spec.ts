import { expect, test } from "@playwright/test";
import {
  E2E_ACCOUNTS,
  registerVerifyAndSignIn,
  signInAs,
  signOut,
  waitForMailboxToken,
} from "./helpers/e2e-env";

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

  // Recuperación de contraseña de un solo uso mediante buzón de pruebas (sin enlace simulado en UI)
  await signOut(page);
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "¿Has olvidado tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel(/Correo/i).fill(email);
  await page.getByRole("button", { name: "Solicitar recuperación" }).click();
  await expect(page).toHaveURL(/\/forgot-password\?sent=1$/);
  await expect(page.getByRole("status")).toContainText("recuperación");
  await expect(page.getByRole("link", { name: /Abrir enlace de recuperación/i })).toHaveCount(0);

  const resetToken = await waitForMailboxToken(email, "password-reset");
  await page.goto(`/reset-password?token=${encodeURIComponent(resetToken)}`);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(nextPassword);
  await page.getByLabel("Confirmar nueva contraseña", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  await expect(page).toHaveURL(/\/sign-in\?reset=ok$/);
  await expect(page.getByRole("status")).toContainText("Contraseña actualizada");

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
