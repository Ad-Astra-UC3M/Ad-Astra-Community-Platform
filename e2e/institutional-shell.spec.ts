/**
 * Prueba Playwright del layout institucional compartido por visitantes, miembros
 * y administradores. Cambia de sesión con las cuentas sembradas en PGlite y
 * verifica enlaces, foco de teclado, anchura e impresión.
 */

import { expect, test, type Locator } from "@playwright/test";
import { E2E_ACCOUNTS, signInAs, signOut } from "./helpers/e2e-env";

/**
 * Comprueba los destinos visibles del encabezado para el rol bajo prueba.
 * Abre el menú móvil para evaluar los enlaces y espera a que desaparezca al cerrarlo.
 * @param header Localizador del encabezado institucional.
 * @param expected Destino del logotipo, CTA y lista exacta de enlaces del rol por comprobar.
 * @returns Una promesa que finaliza al completar las aserciones y cerrar el menú si se abrió.
 */
async function expectHeaderNav(
  header: Locator,
  expected: { homeHref: string; cta: { label: string; href: string }; links: { label: string; href: string }[] },
) {
  await expect(header.getByRole("link", { name: "Ad Astra UC3M" })).toHaveAttribute("href", expected.homeHref);
  await expect(header.getByRole("link", { name: expected.cta.label, exact: true }).first()).toHaveAttribute("href", expected.cta.href);

  const openMenu = header.getByRole("button", { name: "Abrir menú" });
  const isMobile = await openMenu.isVisible();
  if (isMobile) await openMenu.click();

  const nav = header.getByRole("navigation");
  for (const link of expected.links) {
    await expect(nav.getByRole("link", { name: link.label, exact: true })).toHaveAttribute("href", link.href);
  }
  await expect(nav.getByRole("link")).toHaveCount(expected.links.length);

  if (isMobile) {
    await header.getByRole("button", { name: "Cerrar menú" }).click();
    await expect(header.getByRole("navigation", { name: "Navegación móvil", includeHidden: true })).toBeHidden();
  }
}

test("la navegación y el pie institucional acompañan al visitante, miembro y administrador", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const footer = page.getByRole("contentinfo");
  const logo = header.getByRole("img", { name: /Ad Astra/i }).first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await expectHeaderNav(header, {
    homeHref: "/",
    cta: { label: "Crear cuenta", href: "/sign-up" },
    links: [
      { label: "Inicio", href: "/" },
      { label: "Actividades", href: "/activities" },
      { label: "Iniciar sesión", href: "/sign-in" },
    ],
  });
  await expect(header.getByRole("link", { name: "Únete a IT / Eventos" })).toHaveCount(0);

  await expect(footer.getByRole("link", { name: "SIGMA", exact: true })).toHaveAttribute("href", /^https:\/\/www\.adastrauc3m\.es\//);
  await expect(footer.getByRole("link", { name: "Equipo", exact: true })).toHaveAttribute("href", /^https:\/\/www\.adastrauc3m\.es\//);

  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await signInAs(page, E2E_ACCOUNTS.student);
  await expect(page).toHaveURL(/\/home$/);
  await expect(footer).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  await expectHeaderNav(header, {
    homeHref: "/home",
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
    links: [
      { label: "Inicio", href: "/home" },
      { label: "Actividades", href: "/activities" },
      { label: "Mis actividades", href: "/my-activities" },
      { label: "Oportunidades", href: "/opportunities" },
      { label: "Marcadores", href: "/bookmarks" },
      { label: "Mi perfil", href: "/profile" },
    ],
  });

  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin$/);
  await expectHeaderNav(header, {
    homeHref: "/home",
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
    links: [
      { label: "Inicio", href: "/home" },
      { label: "Actividades", href: "/activities" },
      { label: "Mis actividades", href: "/my-activities" },
      { label: "Oportunidades", href: "/opportunities" },
      { label: "Marcadores", href: "/bookmarks" },
      { label: "Mi perfil", href: "/profile" },
      { label: "Gestión", href: "/admin" },
    ],
  });

  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.student);
  await expect(page).toHaveURL(/\/home$/);

  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
    const box = heading.getBoundingClientRect();
    return heading.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  })).toBeTruthy();

  await page.goto("/activities/cubesat-lab");
  await skip.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const back = page.getByRole("link", { name: "Volver a actividades" });
  await expect(back).toBeFocused();
  expect(await back.evaluate((link) => {
    const box = link.getBoundingClientRect();
    return link.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  })).toBeTruthy();

  await page.goto("/qr-card");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("img", { name: "Código QR personal de asistencia" })).toBeVisible();
  await expect(header).toBeHidden();
  await expect(footer).toBeHidden();
});
