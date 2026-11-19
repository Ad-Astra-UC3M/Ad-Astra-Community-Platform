import { expect, test } from "@playwright/test";

test("CA-01: capacidades independientes en /admin con 404 al carecer de permiso", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Entrar como organizador" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // general_admin nunca incluye talent_consultation
  expect((await page.request.get("/admin/talent")).status()).toBe(404);

  // Activar talent_consultation habilita /admin/talent
  await page.locator('button[data-capability="talent_consultation"]').click();
  await expect(page.locator('button[data-capability="talent_consultation"]')).toHaveAttribute("aria-pressed", "true");
  const talentResponse = await page.goto("/admin/talent");
  expect(talentResponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Perfiles voluntarios de talento" })).toBeVisible();

  // Quitar todas las capacidades bloquea /admin con 404
  await page.goto("/home");
  for (const cap of ["general_admin", "content_editing", "attendance_validation", "talent_consultation"]) {
    const button = page.locator(`button[data-capability="${cap}"]`);
    if ((await button.getAttribute("aria-pressed")) === "true") {
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "false");
    }
  }

  expect((await page.request.get("/admin")).status()).toBe(404);
  expect((await page.request.get("/admin/talent")).status()).toBe(404);
});

test("CA-02 y CA-03: retorno a ruta protegida tras acceso y recuperación de contraseña", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Correo UC3M de prueba").fill("recuperacion@alumnos.uc3m.es");
  await page.getByLabel("Contraseña de prueba").fill("ClaveInicial2026!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Simular verificación" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Acceso directo a ruta interna protegida redirige con ?next= y retorna tras iniciar sesión
  await page.goto("/bookmarks");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fbookmarks$/);
  await page.getByLabel("Correo UC3M de prueba").fill("recuperacion@alumnos.uc3m.es");
  await page.getByLabel("Contraseña de prueba").fill("ClaveInicial2026!");
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
  await expect(page).toHaveURL(/\/bookmarks$/);

  // Recuperación de contraseña de un solo uso
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "¿Has olvidado tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Correo UC3M de prueba").fill("recuperacion@alumnos.uc3m.es");
  await page.getByRole("button", { name: "Solicitar recuperación" }).click();
  await expect(page.getByRole("status")).toContainText("enlace de recuperación");

  await page.getByRole("link", { name: "Abrir enlace de recuperación" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("Nueva contraseña").fill("ClaveNueva2026!");
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  await expect(page).toHaveURL(/\/sign-in\?reset=ok$/);
  await expect(page.getByRole("status")).toContainText("Contraseña actualizada");

  // Contraseña antigua rechazada y nueva aceptada
  await page.getByLabel("Correo UC3M de prueba").fill("recuperacion@alumnos.uc3m.es");
  await page.getByLabel("Contraseña de prueba").fill("ClaveInicial2026!");
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Comprueba el correo y la contraseña");

  await page.getByLabel("Correo UC3M de prueba").fill("recuperacion@alumnos.uc3m.es");
  await page.getByLabel("Contraseña de prueba").fill("ClaveNueva2026!");
  await page.getByRole("button", { name: "Acceder", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("CA-06, CA-10 y CA-11: alta en puerta, confirmación manual, actividad con turno normal y resolución de supresión", async ({ page }) => {
  // Estudiante crea solicitud de supresión en su espacio
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar como estudiante" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/profile/privacy");
  await page.getByLabel("Motivo (opcional)").fill("Solicitud de prueba para revisión admin");
  await page.getByRole("button", { name: "Solicitar supresión de cuenta" }).click();
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();

  // Cambiamos a organizador
  await page.getByRole("button", { name: "Probar como organizador" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // CA-06: crear actividad dejando vacío el nombre de turno -> crea turno «normal»
  await page.goto("/admin/activities");
  await page.getByLabel("Título", { exact: true }).fill("Seminario de guiado orbital");
  await page.getByLabel("Descripción", { exact: true }).fill("Introducción práctica a trayectorias y guiado.");
  await page.getByLabel("Ubicación", { exact: true }).fill("Aula 1.2 · Leganés");
  await page.getByRole("button", { name: "Crear actividad" }).click();
  await expect(page.getByRole("status")).toContainText("Actividad creada correctamente.");
  const createdCard = page.locator("article", { hasText: "Seminario de guiado orbital" });
  await expect(createdCard).toContainText("normal");

  // CA-10: inscripción manual en puerta (deja en Apuntado) + confirmación manual separada con auditoría
  await page.goto("/admin/attendance/avionics-lab-a");
  const doorSelect = page.getByLabel("Cuenta activa a inscribir");
  const studentOptionValue = await doorSelect.locator("option[value]:not([value=''])").first().getAttribute("value");
  expect(studentOptionValue).toBeTruthy();
  await doorSelect.selectOption(studentOptionValue!);
  await page.getByLabel("Motivo del alta en puerta").fill("Alta presencial con plaza libre");
  await page.getByRole("button", { name: "Inscribir en puerta" }).click();
  await expect(page.getByText("Inscripción en puerta registrada en estado «Apuntado»")).toBeVisible();

  await page.getByLabel(/Motivo de confirmación manual/).first().fill("Verificación manual sin cámara");
  await page.getByRole("button", { name: "Confirmar asistencia manualmente" }).first().click();
  await expect(page.getByText("Asistencia confirmada manualmente y registrada en auditoría.")).toBeVisible();
  const auditSection = page.locator("section[aria-label='Historial de correcciones y altas en puerta']");
  await expect(auditSection).toContainText("Alta en puerta");
  await expect(auditSection).toContainText("Confirmación manual");

  // CA-11: resolución motivada de la solicitud de supresión
  await page.goto("/admin/deletion-requests");
  await page.getByRole("link", { name: "Gestionar solicitud" }).first().click();
  await expect(page).toHaveURL(/\/admin\/deletion-requests\/.+$/);
  await page.getByLabel("Resultado motivado de la resolución").fill("Solicitud revisada y resuelta conforme al aviso de privacidad.");
  await page.getByRole("button", { name: "Marcar como resuelta" }).click();
  await expect(page.getByRole("status")).toContainText("Solicitud resuelta con resultado motivado");
  await expect(page.getByText("Resuelta por")).toBeVisible();
});
