import { expect, test } from "@playwright/test";
import { registerForVerification, waitForMailboxOtp } from "./helpers/e2e-env";

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

test("el portal no expone un proxy público de Neon Auth", async ({ request }) => {
  for (const path of ["get-session", "admin/list-users", "email-otp/verify-email"]) {
    const response = await request.get("/api/auth/" + path);
    expect(response.status()).toBe(404);
  }
});
