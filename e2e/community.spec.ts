import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS, registerVerifyAndSignIn, signInAs, signOut } from "./helpers/e2e-env";

test("alta UC3M verificada, reserva, tarjeta digital y control de asistencia", async ({ page }, info) => {
  const email = `alta.${info.project.name}@alumnos.uc3m.es`;
  const password = "ComunidadAlta2026!";

  await page.goto("/");
  await page.screenshot({ path: info.outputPath("landing.png"), fullPage: true });
  await registerVerifyAndSignIn(page, {
    firstName: "Lucía",
    lastName: `Navegación ${info.project.name}`,
    email,
    password,
  });

  await page.getByRole("navigation", { name: "Accesos directos" }).locator('a[href="/activities"]').click();
  await page.locator("article", { hasText: "CubeSat" }).getByRole("link", { name: "Ver turnos" }).click();
  const backToActivities = page.getByRole("link", { name: "Volver a actividades", exact: true });
  await expect(backToActivities).toHaveAttribute("href", "/activities");
  await expect(backToActivities).toHaveCSS("min-height", "44px");
  await expect(page.locator("main > :first-child")).toHaveAccessibleName("Volver a actividades");
  await backToActivities.click();
  await expect(page).toHaveURL(/\/activities$/);

  await page.locator("article", { hasText: "CubeSat" }).getByRole("link", { name: "Ver turnos" }).click();
  await expect(page.getByText("Completo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Reservar plaza/ }).click();
  await expect(page.getByText("Tu plaza está reservada.")).toBeVisible();

  await page.getByRole("link", { name: "Ver mis actividades" }).click();
  await expect(page.getByText("Reserva confirmada")).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Mi tarjeta QR" }).click();
  await page.screenshot({ path: info.outputPath("card.png"), fullPage: true });
  await page.getByText("Usar el código sin cámara").click();
  const token = await page.getByLabel("Código de la tarjeta").inputValue();
  const qrImage = await page.getByRole("img", { name: "Código QR personal de asistencia" }).getAttribute("src");
  expect(qrImage).toContain("data:image/png;");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  for (const url of ["/admin", "/admin/attendance/cubesat-lab-early"]) {
    expect((await page.request.get(url)).status()).toBe(404);
  }

  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("link", { name: /Validar.*tarde/i }).click();
  await page.getByLabel("Código de la tarjeta").fill(token);
  await page.getByRole("button", { name: "Validar tarjeta" }).click();
  await expect(page.getByRole("status")).toContainText("no tiene reserva");
  const backToShifts = page.getByRole("link", { name: "Volver a turnos", exact: true });
  await expect(backToShifts).toHaveAttribute("href", "/admin");
  await expect(page.locator("main > :first-child")).toHaveAccessibleName("Volver a turnos");
  await backToShifts.click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: /Validar.*mañana/i }).click();

  // Supply the issued PNG as camera frames. Decoding and submission use the real reader.
  await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src!;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const paint = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 480, 480);
      ctx.drawImage(image, 60, 60, 360, 360);
    };
    paint();
    const stream = canvas.captureStream(8);
    const clock = setInterval(paint, 125);
    window.addEventListener("pagehide", () => clearInterval(clock), { once: true });
    navigator.mediaDevices.getUserMedia = async () => stream;
  }, qrImage);

  await page.getByRole("button", { name: "Abrir cámara" }).click();
  await expect(page.getByRole("status")).toContainText("Asistencia registrada.", { timeout: 15000 });
  await page.getByLabel("Código de la tarjeta").fill(token);
  await page.getByRole("button", { name: "Validar tarjeta" }).click();
  await expect(page.getByRole("status")).toContainText("Ya registrado.");

  await signOut(page);
  await signInAs(page, { email, password });
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("navigation", { name: "Accesos directos" }).locator('a[href="/my-activities"]').click();
  await expect(page.getByText("Asistencia registrada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cancelar reserva/ })).toHaveCount(0);
});

test("un visitante recibe 404 en el panel y sus subrutas", async ({ request }) => {
  for (const url of ["/admin", "/admin/attendance/cubesat-lab-early"]) {
    const response = await request.get(url);
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("Página no encontrada");
  }
});
