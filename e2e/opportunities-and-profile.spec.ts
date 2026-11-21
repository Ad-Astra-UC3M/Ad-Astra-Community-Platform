/**
 * Recorridos Playwright de actividades, catálogo de oportunidades y edición
 * del perfil. Usan la interfaz de Next.js con PGlite sembrado y crean cuentas
 * verificadas para aislar el estado de cada caso.
 */

import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS, registerVerifyAndSignIn, signInAs, signOut } from "./helpers/e2e-env";

/**
 * Comprueba la galería ordenada, el cambio al turno de destino y la reemisión
 * de la tarjeta. El panel rechaza el código anterior y valida el vigente.
 */
test("turno único con imágenes ordenadas, cambio atómico de turno y reemisión QR con revocación", async ({ page }, info) => {
  const email = `turnos.${info.project.name}@alumnos.uc3m.es`;
  await registerVerifyAndSignIn(page, {
    firstName: "Nora",
    lastName: `Turnos ${info.project.name}`,
    email,
    password: "TurnosPassword2026!",
  });

  await page.goto("/activities/propulsion-visit");
  await expect(page.getByText("Turno único seleccionado automáticamente")).toBeVisible();
  const figures = page.locator("section[aria-label='Imágenes de la actividad'] figure");
  await expect(figures).toHaveCount(2);
  await expect(figures.first()).toContainText("Portada ·");
  await page.getByRole("button", { name: /Reservar plaza/ }).click();
  await expect(page.getByText("Tu plaza está reservada.")).toBeVisible();

  await page.goto("/activities/avionics-lab");
  await page.getByRole("button", { name: "Reservar plaza · Grupo A" }).click();
  await expect(page.getByText("Tu plaza está reservada.")).toBeVisible();

  await page.goto("/my-activities");
  const avionicsCard = page.locator("article", { hasText: "Práctica de telemetría y aviónica" });
  await expect(avionicsCard).toContainText("Grupo A");
  await avionicsCard.getByRole("button", { name: /Cambiar turno/ }).click();
  await expect(page.getByRole("status")).toContainText("Has cambiado de turno correctamente.");
  await expect(avionicsCard).toContainText("Grupo B");

  await page.goto("/qr-card");
  await expect(page.getByText("Versión vigente: v1")).toBeVisible();
  await page.getByText("Usar el código sin cámara").click();
  const firstToken = await page.getByLabel("Código de la tarjeta").inputValue();

  await page.getByRole("button", { name: "Reemitir tarjeta QR" }).click();
  await expect(page.getByRole("status")).toContainText("versión v2");
  await expect(page.getByText("Versión vigente: v2")).toBeVisible();
  await page.getByText("Usar el código sin cámara").click();
  const secondToken = await page.getByLabel("Código de la tarjeta").inputValue();
  expect(secondToken).not.toBe(firstToken);

  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: /Validar Grupo B/i }).click();

  await page.getByLabel("Código de la tarjeta").fill(firstToken);
  await page.getByRole("button", { name: "Validar tarjeta" }).click();
  await expect(page.getByRole("status")).toContainText("Tarjeta no válida");

  await page.getByLabel("Código de la tarjeta").fill(secondToken);
  await page.getByRole("button", { name: "Validar tarjeta" }).click();
  await expect(page.getByRole("status")).toContainText("Asistencia registrada.");
});

/**
 * Recorre el filtro de investigación, el detalle y los marcadores. Comprueba
 * la aparición de una sola ficha guardada y su retirada desde /bookmarks.
 */
test("oportunidades con filtro por tipo y marcadores idempotentes", async ({ page }, info) => {
  await registerVerifyAndSignIn(page, {
    firstName: "Inés",
    lastName: `Oportunidades ${info.project.name}`,
    email: `oportunidades.${info.project.name}@alumnos.uc3m.es`,
    password: "OportPassword2026!",
  });

  await page.getByRole("navigation", { name: "Accesos directos" }).locator('a[href="/opportunities"]').click();
  await expect(page).toHaveURL(/\/opportunities$/);

  await page.getByRole("navigation", { name: "Filtrar oportunidades por tipo" })
    .getByRole("link", { name: "Investigación", exact: true })
    .click();
  await expect(page).toHaveURL(/type=research$/);

  await page.getByRole("link", { name: "Ver detalle" }).first().click();
  await expect(page.getByRole("link", { name: "Volver a oportunidades", exact: true })).toHaveAttribute("href", "/opportunities");
  await expect(page.getByRole("link", { name: "Consultar información externa" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar marcador" }).click();
  await expect(page.getByRole("status")).toContainText("Guardar un marcador no envía ninguna candidatura.");

  await page.getByRole("link", { name: "Ver mis marcadores" }).click();
  await expect(page).toHaveURL(/\/bookmarks$/);
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: /Retirar marcador/ }).click();
  await expect(page.getByText("Todavía no tienes oportunidades guardadas.")).toBeVisible();
});

/**
 * Verifica el enlace al aviso, la edición del perfil con correo de solo lectura
 * y la validación de enlaces de talento. Comprueba el historial de difusión y
 * que la solicitud de supresión queda pendiente.
 */
test("aviso de privacidad, perfil básico, talento voluntario, difusión y solicitud de supresión", async ({ page }, info) => {
  await page.goto("/sign-up");
  await page.getByRole("link", { name: "aviso de privacidad" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Aviso de privacidad" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver al registro" })).toHaveAttribute("href", "/sign-up");

  await registerVerifyAndSignIn(page, {
    firstName: "Clara",
    lastName: `Perfil ${info.project.name}`,
    email: `perfil.${info.project.name}@alumnos.uc3m.es`,
    password: "PerfilPassword2026!",
  });

  await page.getByRole("navigation", { name: "Accesos directos" }).locator('a[href="/profile"]').click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel(/Correo UC3M/i)).toHaveAttribute("readonly", "");
  await page.getByLabel("Nombre", { exact: true }).fill("Elena");
  await page.getByLabel("Apellidos", { exact: true }).fill("Ejemplo");
  await page.getByLabel("Titulación", { exact: true }).fill("Ingeniería Aeroespacial");
  await page.getByLabel("Curso", { exact: true }).fill("3.º");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("Has actualizado tu perfil básico correctamente.");

  await page.getByRole("link", { name: /Perfil de talento voluntario/i }).click();
  await expect(page).toHaveURL(/\/profile\/talent$/);
  await page.getByLabel("GitHub", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Guardar perfil de talento" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("http:// o https://");

  await page.getByLabel("Universidad", { exact: true }).fill("UC3M");
  await page.getByLabel("Año de graduación estimado", { exact: true }).fill("2027");
  await page.getByLabel("Habilidades", { exact: true }).fill("Aviónica, C++");
  await page.getByLabel("GitHub", { exact: true }).fill("https://github.com/ad-astra-e2e");
  await page.getByRole("button", { name: "Guardar perfil de talento" }).click();
  await expect(page.getByRole("status")).toContainText("Has guardado tu perfil de talento voluntario.");
  await expect(page.getByRole("link", { name: "https://github.com/ad-astra-e2e" })).toBeVisible();

  await page.getByRole("link", { name: "Volver a mi perfil" }).click();
  await page.getByRole("link", { name: /Difusión y privacidad/i }).click();
  await expect(page).toHaveURL(/\/profile\/privacy$/);
  await expect(page.getByText("No autorizada (valor por defecto)")).toBeVisible();

  await page.getByRole("button", { name: "Autorizar difusión profesional" }).click();
  await expect(page.getByRole("status")).toContainText("autorización de difusión profesional");
  await page.getByRole("button", { name: "Retirar autorización de difusión" }).click();
  await expect(page.getByRole("status")).toContainText("Tu perfil de talento permanece intacto");
  await expect(page.locator("section", { hasText: "Historial de decisiones" }).locator("li")).toHaveCount(2);

  await page.getByLabel("Motivo (opcional)").fill("Solicitud de baja en recorrido E2E");
  await page.getByRole("button", { name: "Solicitar supresión de cuenta" }).click();
  await expect(page.getByRole("status")).toContainText("No se ha ejecutado ningún borrado automático.");
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();
});
