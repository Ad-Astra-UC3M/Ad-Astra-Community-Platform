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
  const marker = page.getByRole("button", { name: /^Marcador ·/ });
  await expect(marker).toHaveAttribute("aria-pressed", "false");
  await marker.click();
  await expect(page.getByRole("status")).toContainText("Guardar un marcador no envía ninguna candidatura.");
  await expect(marker).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Ver mis marcadores" }).click();
  await expect(page).toHaveURL(/\/bookmarks$/);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  await marker.click();
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

/**
 * Recorre el flujo completo de foto de perfil privada: bloqueo 401/404 sin sesión o sin imagen,
 * rechazo de SVG, subida de PNG, sustitución por WebP, consulta interna protegida por
 * `talent_consultation` y retirada con vuelta al monograma de iniciales.
 */
test("foto de perfil privada: subida, validación, sustitución, consulta de talento y retirada", async ({ page }, info) => {
  const email = `foto.${info.project.name}@alumnos.uc3m.es`;
  const password = "FotoPassword2026!";
  const lastName = `Orbital ${info.project.name}`;
  const fullName = `Lucas ${lastName}`;

  const unauthRes = await page.request.get("/api/profile/avatar");
  expect(unauthRes.status()).toBe(401);
  expect(unauthRes.headers()["cache-control"]).toBe("no-store");

  await registerVerifyAndSignIn(page, {
    firstName: "Lucas",
    lastName,
    email,
    password,
  });

  const emptyAvatarRes = await page.request.get("/api/profile/avatar");
  expect(emptyAvatarRes.status()).toBe(404);

  await page.goto("/profile");
  const summarySection = page.locator("section[aria-label='Resumen de identidad universitaria']");
  await expect(summarySection).toContainText("LO");

  const photoDialog = page.getByRole("dialog", { name: "Tu foto de perfil" });
  const addPhotoButton = page.getByRole("button", { name: "Añadir foto", exact: true });
  await expect(page.getByLabel("Foto de perfil (JPEG, PNG o WebP, máx. 2 MB)", { exact: true })).toBeHidden();
  await addPhotoButton.click();
  await expect(photoDialog).toBeVisible();
  await expect(photoDialog.getByRole("link", { name: /Crear mi avatar/ })).toHaveAttribute("href", "https://avatar.adastrauc3m.es/");
  await expect(photoDialog).toContainText("Tu cara. Tu universo.");
  const bannerWords = photoDialog.locator('aside[aria-label="Crea tu avatar Ad Astra"] h2 > span[aria-hidden="true"] > span');
  const wordPositions = await bannerWords.evaluateAll((words) => words.map((word) => {
    const rect = word.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  }));
  const firstWordsByLine = wordPositions.filter((word, index) => index === 0 || Math.abs(word.y - wordPositions[index - 1].y) > 2);
  expect(firstWordsByLine.length).toBeGreaterThan(1);
  for (const word of firstWordsByLine) expect(Math.abs(word.x - firstWordsByLine[0].x)).toBeLessThan(1);

  const pauseFaces = photoDialog.getByRole("button", { name: "Pausar animación de caras" });
  await pauseFaces.click();
  await expect(pauseFaces).toHaveAttribute("aria-pressed", "true");
  await expect(async () => {
    expect(await photoDialog.locator('img[src$="face-1.png"]').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }).toPass();
  expect(await photoDialog.getByTestId("profile-photo-panel").evaluate((panel) => panel.scrollWidth <= panel.clientWidth)).toBe(true);
  await photoDialog.getByRole("button", { name: "Cerrar ventana de foto" }).scrollIntoViewIfNeeded();
  await photoDialog.screenshot({ path: `test-results/avatar-dialog-${info.project.name}.png` });
  await pauseFaces.click();
  await expect(pauseFaces).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/Reducimos la imagen a un máximo/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(photoDialog).toBeHidden();
  await expect(addPhotoButton).toBeFocused();
  await addPhotoButton.click();
  await photoDialog.getByRole("button", { name: "Cerrar ventana de foto" }).click();
  await expect(photoDialog).toBeHidden();
  await expect(addPhotoButton).toBeFocused();
  await addPhotoButton.click();
  const fileInput = page.getByLabel("Foto de perfil (JPEG, PNG o WebP, máx. 2 MB)", { exact: true });

  // Rechaza SVG antes de persistir nada
  await fileInput.setInputFiles({
    name: "malicioso.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"),
  });
  await page.getByRole("button", { name: "Guardar foto" }).click();
  await expect(page).toHaveURL(/\/profile\?error=invalid_image$/);
  await expect(photoDialog.getByRole("alert")).toContainText("JPEG, PNG o WebP");
  expect((await page.request.get("/api/profile/avatar")).status()).toBe(404);

  // Subida válida de PNG 1x1
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  await fileInput.setInputFiles({
    name: "perfil.png",
    mimeType: "image/png",
    buffer: png1x1,
  });
  await page.getByRole("button", { name: "Guardar foto" }).click();
  await expect(page).toHaveURL(/\/profile\?status=avatar_saved$/);
  await expect(page.getByRole("status")).toContainText("Has actualizado tu foto de perfil correctamente.");

  const summaryImg = page.getByAltText(`Foto de perfil de ${fullName}`);
  await expect(summaryImg).toBeVisible();
  const firstSrc = await summaryImg.getAttribute("src");
  expect(firstSrc).toMatch(/^\/api\/profile\/avatar\?v=\d+$/);
  await expect(async () => {
    const loaded = await summaryImg.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
    expect(loaded).toBe(true);
  }).toPass();

  const barImg = page.locator("aside[aria-label='Sesión activa'] img");
  await expect(barImg).toHaveAttribute("src", firstSrc!);
  await expect(async () => {
    const loaded = await barImg.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
    expect(loaded).toBe(true);
  }).toPass();

  const ownPngRes = await page.request.get("/api/profile/avatar");
  expect(ownPngRes.status()).toBe(200);
  expect(ownPngRes.headers()["content-type"]).toMatch(/^image\/(webp|avif)$/);
  expect(ownPngRes.headers()["cache-control"]).toBe("no-store");
  expect(ownPngRes.headers()["x-content-type-options"]).toBe("nosniff");
  expect(ownPngRes.headers()["content-disposition"]).toBe("inline");
  expect(ownPngRes.headers()["vary"]).toContain("Cookie");

  await page.getByRole("button", { name: "Editar foto", exact: true }).click();

  // Sustitución por WebP 1x1 válido
  const webp1x1 = Buffer.from(
    "UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=",
    "base64",
  );
  await fileInput.setInputFiles({
    name: "perfil.webp",
    mimeType: "image/webp",
    buffer: webp1x1,
  });
  await page.getByRole("button", { name: "Cambiar foto" }).click();
  await expect(summaryImg).not.toHaveAttribute("src", firstSrc!);
  await expect(page).toHaveURL(/\/profile\?status=avatar_saved$/);

  const secondSrc = await summaryImg.getAttribute("src");
  expect(secondSrc).toMatch(/^\/api\/profile\/avatar\?v=\d+$/);
  expect(secondSrc).not.toBe(firstSrc);
  await expect(async () => {
    const loaded = await summaryImg.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
    expect(loaded).toBe(true);
  }).toPass();

  const ownWebpRes = await page.request.get("/api/profile/avatar");
  expect(ownWebpRes.status()).toBe(200);
  expect(ownWebpRes.headers()["content-type"]).toMatch(/^image\/(webp|avif)$/);

  // Completa perfil de talento y comprueba acceso autorizado vs denegado en /admin/talent
  await page.goto("/profile/talent");
  await page.getByLabel("Universidad", { exact: true }).fill("UC3M");
  await page.getByRole("button", { name: "Guardar perfil de talento" }).click();
  await expect(page.getByRole("status")).toContainText("Has guardado tu perfil de talento voluntario.");

  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/talent?q=${encodeURIComponent(lastName)}`);
  await page.getByRole("row").filter({ hasText: fullName }).getByRole("link", { name: "Ver perfil de talento" }).click();
  await expect(page).toHaveURL(/\/admin\/talent\/.+$/);

  const talentAvatarPath = `/api${new URL(page.url()).pathname}/avatar`;
  const adminImg = page.getByAltText(`Foto de perfil de ${fullName}`);
  await expect(adminImg).toBeVisible();
  await expect(async () => {
    const loaded = await adminImg.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
    expect(loaded).toBe(true);
  }).toPass();
  const talentAvatarRes = await page.request.get(talentAvatarPath);
  expect(talentAvatarRes.status()).toBe(200);
  expect(talentAvatarRes.headers()["cache-control"]).toBe("no-store");
  expect(talentAvatarRes.headers()["x-content-type-options"]).toBe("nosniff");

  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.generalAdminOnly);
  await expect(page).toHaveURL(/\/admin$/);
  const deniedTalentAvatarRes = await page.request.get(talentAvatarPath);
  expect(deniedTalentAvatarRes.status()).toBe(404);
  expect(deniedTalentAvatarRes.headers()["cache-control"]).toBe("no-store");

  // El titular retira la foto y vuelve al monograma de iniciales
  await signOut(page);
  await signInAs(page, { email, password });
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Editar foto", exact: true }).click();
  await photoDialog.getByRole("button", { name: "Quitar foto" }).click();
  await expect(page).toHaveURL(/\/profile\?status=avatar_removed$/);
  await expect(page.getByRole("status")).toContainText("Has eliminado tu foto de perfil.");
  expect((await page.request.get("/api/profile/avatar")).status()).toBe(404);
  await expect(summarySection.locator("img")).toHaveCount(0);
  await expect(summarySection).toContainText("LO");
});
