/**
 * Prueba Playwright del layout institucional compartido por visitantes, miembros
 * y administradores. Cambia de sesión con las cuentas sembradas en PGlite y
 * verifica enlaces, sección activa, menú de cuenta, barra inferior móvil, foco de
 * teclado, anchura e impresión.
 */

import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, signInAs, signOut } from "./helpers/e2e-env";

type Destination = { label: string; href: string };

type HeaderExpectation = {
  homeHref: string;
  cta: Destination;
  links: Destination[];
  accountLinks: Destination[];
  /** Entrada activa de la navegación principal. */
  activeLabel?: string;
  /** Entrada activa del menú de cuenta. */
  accountActiveLabel?: string;
  /** Nombre de la cuenta que encabeza el menú de cuenta. */
  accountName?: string;
};

const memberLinks: Destination[] = [
  { label: "Inicio", href: "/home" },
  { label: "Actividades", href: "/activities" },
  { label: "Mis actividades", href: "/my-activities" },
  { label: "Oportunidades", href: "/opportunities" },
  { label: "Marcadores", href: "/bookmarks" },
];

const memberAccountLinks: Destination[] = [
  { label: "Mi perfil", href: "/profile" },
  { label: "Difusión y privacidad", href: "/profile/privacy" },
];

const bottomLinks: Destination[] = [
  { label: "Inicio", href: "/home" },
  { label: "Actividades", href: "/activities" },
  { label: "Mis actividades", href: "/my-activities" },
  { label: "Oportunidades", href: "/opportunities" },
  { label: "Perfil", href: "/profile" },
];

/**
 * Indica si el proyecto de Playwright usa la composición móvil, que cambia a partir de 1080 px.
 * @param page Página bajo prueba.
 * @returns `true` por debajo de 1080 px de ancho.
 */
function isNarrow(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 1080;
}

/**
 * Comprueba los destinos del encabezado para el rol bajo prueba. En móvil con sesión abre el menú
 * desplegable, que reúne enlaces, cuenta y cierre de sesión. En escritorio comprueba la navegación
 * principal y, con sesión, el menú de cuenta; sin sesión exige que no exista.
 * @param page Página con el rol ya establecido.
 * @param expected Logotipo, CTA, enlaces, enlaces de cuenta y entrada activa esperada.
 * @returns Una promesa que finaliza al cerrar los menús abiertos.
 */
async function expectHeaderNav(page: Page, expected: HeaderExpectation) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Ad Astra UC3M" })).toHaveAttribute("href", expected.homeHref);
  await expect(header.getByRole("link", { name: expected.cta.label, exact: true }).first()).toHaveAttribute("href", expected.cta.href);

  const openMenu = header.getByRole("button", { name: "Abrir menú" });
  if (await openMenu.isVisible()) {
    await openMenu.click();
    const nav = header.getByRole("navigation", { name: "Navegación móvil" });
    const all = [...expected.links, ...expected.accountLinks];
    for (const link of all) {
      await expect(nav.getByRole("link", { name: link.label, exact: true })).toHaveAttribute("href", link.href);
    }
    await expect(nav.getByRole("link")).toHaveCount(all.length);
    await expect(nav.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    const mobileActive = expected.activeLabel ?? expected.accountActiveLabel;
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(mobileActive ? 1 : 0);
    if (mobileActive) {
      await expect(nav.getByRole("link", { name: mobileActive, exact: true })).toHaveAttribute("aria-current", "page");
    }
    await header.getByRole("button", { name: "Cerrar menú" }).click();
    await expect(header.getByRole("navigation", { name: "Navegación móvil", includeHidden: true })).toBeHidden();
    return;
  }

  const nav = header.getByRole("navigation", { name: "Navegación principal" });
  for (const link of expected.links) {
    await expect(nav.getByRole("link", { name: link.label, exact: true })).toHaveAttribute("href", link.href);
  }
  await expect(nav.getByRole("link")).toHaveCount(expected.links.length);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(expected.activeLabel ? 1 : 0);
  if (expected.activeLabel) {
    await expect(nav.getByRole("link", { name: expected.activeLabel, exact: true })).toHaveAttribute("aria-current", "page");
  }

  const accountButton = header.getByRole("button", { name: /^Menú de cuenta de / });
  if (expected.accountLinks.length === 0) {
    await expect(accountButton).toHaveCount(0);
    return;
  }
  await accountButton.click();
  const menu = page.getByRole("menu");
  for (const link of expected.accountLinks) {
    await expect(menu.getByRole("menuitem", { name: link.label, exact: true })).toHaveAttribute("href", link.href);
  }
  await expect(menu.getByRole("menuitem", { name: "Cerrar sesión" })).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(expected.accountLinks.length + 1);
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(expected.accountActiveLabel ? 1 : 0);
  if (expected.accountActiveLabel) {
    await expect(menu.getByRole("menuitem", { name: expected.accountActiveLabel, exact: true })).toHaveAttribute("aria-current", "page");
  }
  if (expected.accountName) {
    await expect(menu.getByRole("group", { name: expected.accountName })).toHaveCount(1);
  }

  // La opción activa por teclado debe distinguirse a simple vista, no solo por un fondo casi igual al menú.
  await page.keyboard.press("ArrowDown");
  const focusedItem = menu.locator("[data-focus]");
  await expect(focusedItem).toHaveCount(1);
  expect(await focusedItem.evaluate((item) => getComputedStyle(item).textDecorationLine)).toContain("underline");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(accountButton).toBeFocused();
}

/**
 * Comprueba la barra inferior de accesos rápidos: solo existe para miembros en pantallas estrechas,
 * marca la entrada activa y deja visible el final del pie.
 * @param page Página con el rol ya establecido.
 * @param activeLabel Entrada que debe anunciar la página actual, si la hay.
 * @returns Una promesa que finaliza tras las aserciones.
 */
async function expectBottomNav(page: Page, activeLabel?: string) {
  const bottom = page.getByRole("navigation", { name: "Accesos rápidos", includeHidden: true });
  if (!isNarrow(page)) {
    await expect(bottom).toBeHidden();
    return;
  }

  await expect(bottom).toBeVisible();
  for (const link of bottomLinks) {
    await expect(bottom.getByRole("link", { name: link.label, exact: true })).toHaveAttribute("href", link.href);
  }
  await expect(bottom.getByRole("link")).toHaveCount(bottomLinks.length);
  await expect(bottom.locator('[aria-current="page"]')).toHaveCount(activeLabel ? 1 : 0);
  if (activeLabel) {
    await expect(bottom.getByRole("link", { name: activeLabel, exact: true })).toHaveAttribute("aria-current", "page");
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastFooterLink = page.getByRole("contentinfo").getByRole("link").last();
  await expect(async () => {
    const footerBox = await lastFooterLink.boundingBox();
    const barBox = await bottom.boundingBox();
    expect(footerBox && barBox && footerBox.y + footerBox.height <= barBox.y).toBeTruthy();
  }).toPass();
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("la navegación y el pie institucional acompañan al visitante, miembro y administrador", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const footer = page.getByRole("contentinfo");
  const logo = header.getByRole("img", { name: /Ad Astra/i }).first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await expectHeaderNav(page, {
    homeHref: "/",
    cta: { label: "Crear cuenta", href: "/sign-up" },
    links: [{ label: "Acceder", href: "/sign-in" }],
    accountLinks: [],
  });
  await expect(header.getByRole("link", { name: "Actividades" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Abrir menú" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Accesos rápidos", includeHidden: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Únete a IT / Eventos" })).toHaveCount(0);

  await expect(footer.getByRole("link", { name: "SIGMA", exact: true })).toHaveAttribute("href", /^https:\/\/www\.adastrauc3m\.es\//);
  await expect(footer.getByRole("link", { name: "Equipo", exact: true })).toHaveAttribute("href", /^https:\/\/www\.adastrauc3m\.es\//);

  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await signInAs(page, E2E_ACCOUNTS.student);
  await expect(page).toHaveURL(/\/home$/);
  await expect(footer).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await expect(page.getByRole("complementary", { name: "Sesión activa" })).toHaveCount(0);

  await expectHeaderNav(page, {
    homeHref: "/home",
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
    links: memberLinks,
    accountLinks: memberAccountLinks,
    accountName: E2E_ACCOUNTS.student.name,
    activeLabel: "Inicio",
  });
  await expectBottomNav(page, "Inicio");

  await page.goto("/activities/cubesat-lab");
  await expectHeaderNav(page, {
    homeHref: "/home",
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
    links: memberLinks,
    accountLinks: memberAccountLinks,
    accountName: E2E_ACCOUNTS.student.name,
    activeLabel: "Actividades",
  });
  await expectBottomNav(page, "Actividades");

  await page.goto("/profile/privacy");
  await expectHeaderNav(page, {
    homeHref: "/home",
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
    links: memberLinks,
    accountLinks: memberAccountLinks,
    accountName: E2E_ACCOUNTS.student.name,
    accountActiveLabel: "Difusión y privacidad",
  });
  await expectBottomNav(page, "Perfil");

  await page.goto("/qr-card");
  await expect(header.getByRole("link", { name: "Mi tarjeta QR", exact: true })).toHaveAttribute("aria-current", "page");
  await expectBottomNav(page);

  await page.goto("/home");
  await signOut(page);
  await signInAs(page, E2E_ACCOUNTS.admin);
  await expect(page).toHaveURL(/\/admin$/);
  await expectHeaderNav(page, {
    homeHref: "/home",
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
    links: memberLinks,
    accountLinks: [...memberAccountLinks, { label: "Panel administrativo", href: "/admin" }],
    accountName: E2E_ACCOUNTS.admin.name,
    accountActiveLabel: "Panel administrativo",
  });
  await expect(header.getByRole("link", { name: "Gestión" })).toHaveCount(0);

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

  // Con el foco de teclado fuera de la barra, desplazarse hacia abajo la oculta; al volver a ella con
  // Mayús+Tab (último control del encabezado) debe reaparecer.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(header).not.toBeInViewport();
  await page.keyboard.press("Shift+Tab");
  expect(await header.evaluate((node) => node.contains(document.activeElement))).toBeTruthy();
  await expect(header).toBeInViewport();

  await page.goto("/qr-card");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("img", { name: "Código QR personal de asistencia" })).toBeVisible();
  await expect(header).toBeHidden();
  await expect(footer).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Accesos rápidos", includeHidden: true })).toBeHidden();
});
