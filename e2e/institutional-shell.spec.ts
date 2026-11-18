import { expect, test } from "@playwright/test";

test("la navegación y el pie institucional acompañan al visitante y al estudiante", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const footer = page.getByRole("contentinfo");
  const logo = header.getByRole("img", {name: /Ad Astra/i}).first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(footer.getByRole("link", {name: "SIGMA", exact: true})).toHaveAttribute("href", /^https:\/\/www\.adastrauc3m\.es\//);
  await expect(footer.getByRole("link", {name: "Equipo", exact: true})).toHaveAttribute("href", /^https:\/\/www\.adastrauc3m\.es\//);
  const skip = page.getByRole("link", {name: "Saltar al contenido"});
  await expect(header.getByRole("link", {name: "Únete a IT / Eventos"}).first()).toHaveAttribute("href", "https://www.adastrauc3m.es/join");
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
  await page.goto("/activities/cubesat-lab");
  await skip.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const back = page.getByRole("link", {name: "Volver a actividades"});
  await expect(back).toBeFocused();
  expect(await back.evaluate(link => {
    const box = link.getBoundingClientRect();
    return link.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  })).toBeTruthy();
  await page.goto("/qr-card");
  await page.emulateMedia({media: "print"});
  await expect(page.getByRole("img", {name: "Código QR personal de asistencia"})).toBeVisible();
  await expect(header).toBeHidden();
  await expect(footer).toBeHidden();
});
