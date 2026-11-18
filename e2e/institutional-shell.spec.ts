import { expect, test } from "@playwright/test";

test("la navegación y el pie institucional acompañan al visitante y al estudiante", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const footer = page.getByRole("contentinfo");
  await expect(header.getByRole("img", {name: /Ad Astra/i}).first()).toBeVisible();
  await expect(footer.getByRole("link", {name: "SIGMA", exact: true})).toHaveAttribute("href", /^https:\/\/adastrauc3m\.es\//);
  await expect(footer.getByRole("link", {name: "Equipo", exact: true})).toHaveAttribute("href", /^https:\/\/adastrauc3m\.es\//);
  await page.getByRole("button", {name: "Entrar como estudiante"}).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(footer).toBeVisible();
  await page.goto("/qr-card");
  await page.emulateMedia({media: "print"});
  await expect(page.getByRole("img", {name: "Código QR personal de asistencia"})).toBeVisible();
  await expect(header).toBeHidden();
  await expect(footer).toBeHidden();
});
