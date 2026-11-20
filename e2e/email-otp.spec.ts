/**
 * Regresiones Playwright de verificación de correo. Comprueban el formulario
 * Next.js con el proveedor local de Auth y el buzón JSONL de la ejecución. La
 * prueba HTTP comprueba la retirada de las rutas públicas del proxy.
 */

import { expect, test } from "@playwright/test";
import { registerForVerification, waitForMailboxOtp } from "./helpers/e2e-env";

/**
 * Prueba el error de código, el reenvío, la invalidación del código anterior y
 * la llegada a /bookmarks al abrir sesión con el código nuevo.
 */
test("verifica el alta por código, rechaza el código anterior y recupera el destino protegido", async ({ page }, info) => {
  const email = `verificacion.${info.project.name}.${info.repeatEachIndex}.${info.retry}@alumnos.uc3m.es`;
  const password = "VerificacionE2E2026!";

  await registerForVerification(page, {
    firstName: "Marco",
    lastName: `Verificación ${info.project.name}`,
    email,
    password,
  });
  await expect(page).toHaveURL(/\/verify-email\?sent=1$/);

  const main = page.getByRole("main");
  const emailField = main.getByLabel("Correo institucional UC3M");
  const codeField = main.getByLabel("Código de verificación");
  const confirmButton = main.getByRole("button", { name: "Confirmar correo electrónico" });
  await expect(codeField).toBeVisible();
  await expect(emailField).toHaveValue(email);

  await page.goto("/bookmarks");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fbookmarks$/);
  await emailField.fill(email);
  await main.getByLabel("Contraseña").fill(password);
  await main.getByRole("button", { name: "Acceder", exact: true }).click();

  /**
   * Comprueba el estado y el destino de retorno visibles en la URL de verificación.
   * @param param Parámetro del estado que espera el paso actual.
   * @param value Valor esperado del parámetro.
   * @returns La aserción Playwright sobre /verify-email y sus dos parámetros, incluido next.
   */
  const expectVerificationStep = (param: string, value: string) =>
    expect(page).toHaveURL(url =>
      url.pathname === "/verify-email" &&
      url.searchParams.get(param) === value &&
      url.searchParams.get("next") === "/bookmarks" &&
      url.searchParams.size === 2
    );
  await expectVerificationStep("pending", "1");
  await expect(emailField).toHaveValue(email);

  const firstCode = await waitForMailboxOtp(email, "email-verification");
  expect(firstCode).toMatch(/^\d{6}$/);

  const wrongCode = `${firstCode.startsWith("0") ? "1" : "0"}${firstCode.slice(1)}`;
  await codeField.fill(wrongCode);
  await confirmButton.click();
  await expectVerificationStep("error", "invalid");
  await expect(main.getByRole("alert")).toBeVisible();

  await main.getByRole("button", { name: "Solicitar un nuevo código" }).click();
  await expectVerificationStep("resent", "1");
  const newCode = await waitForMailboxOtp(email, "email-verification", firstCode);
  expect(newCode).toMatch(/^\d{6}$/);

  await codeField.fill(firstCode);
  await confirmButton.click();
  await expectVerificationStep("error", "invalid");
  await expect(main.getByRole("alert")).toBeVisible();

  await codeField.fill(newCode);
  await confirmButton.click();
  await expect(page).toHaveURL(/\/bookmarks$/);
});

/**
 * Comprueba que GET para sesión y administración y POST para verificar correo
 * devuelven 404 en las rutas que usaba el proxy de Neon Auth.
 */
test("el portal no expone un proxy público de Neon Auth", async ({ request }) => {
  for (const path of ["get-session", "admin/list-users"]) {
    const response = await request.get("/api/auth/" + path);
    expect(response.status()).toBe(404);
  }
  const verification = await request.post("/api/auth/email-otp/verify-email");
  expect(verification.status()).toBe(404);
});
