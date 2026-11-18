import { expect, test } from "@playwright/test";

test("la navegación y el pie institucional acompañan al visitante y al estudiante", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const footer = page.getByRole("contentinfo");
  await expect(header.getByRole("img", {name: /Ad Astra/i}).first()).toBeVisible();
  await expect(footer.getByRole("link", {name: "SIGMA", exact: true})).toHaveAttribute("href", /^https:\/\/adastrauc3m\.es\//);
  await expect(footer.getByRole("link", {name: "Equipo", exact: true})).toHaveAttribute("href", /^https:\/\/adastrauc3m\.es\//);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", {name: "Saltar al contenido"});
  await expect(skip).toBeFocused();
  expect(await skip.evaluate(link => {
    const box = link.getBoundingClientRect();
    return link.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  })).toBeTruthy();
  const team = footer.getByRole("link", {name: "Equipo", exact: true});
  await team.focus();
  await expect(team).toHaveCSS("outline-color", "rgb(255, 219, 90)");
  const access = header.getByRole("link", {name: "Acceder"});
  await access.hover();
  await expect(access).toHaveCSS("color", "rgb(254, 255, 238)");
  await page.getByRole("button", {name: "Entrar como estudiante"}).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(footer).toBeVisible();
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(await page.getByRole("heading", {level: 1}).evaluate(heading => {
    const box = heading.getBoundingClientRect();
    return heading.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  })).toBeTruthy();
  await page.goto("/qr-card");
  await page.emulateMedia({media: "print"});
  await expect(page.getByRole("img", {name: "Código QR personal de asistencia"})).toBeVisible();
  await expect(header).toBeHidden();
  await expect(footer).toBeHidden();
});
