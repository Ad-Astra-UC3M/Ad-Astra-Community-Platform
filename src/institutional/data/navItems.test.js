import assert from "node:assert/strict";
import test from "node:test";
import { findActiveHref, getCommunityNav } from "./navItems.js";

const memberLinks = [
  { label: "Inicio", href: "/home" },
  { label: "Actividades", href: "/activities" },
  { label: "Mis actividades", href: "/my-activities" },
  { label: "Oportunidades", href: "/opportunities" },
  { label: "Marcadores", href: "/bookmarks" },
];

const bottomLinks = [
  { label: "Inicio", href: "/home", icon: "home" },
  { label: "Actividades", href: "/activities", icon: "activities" },
  { label: "Mis actividades", href: "/my-activities", icon: "reservations" },
  { label: "Oportunidades", href: "/opportunities", icon: "opportunities" },
  { label: "Perfil", href: "/profile", icon: "profile" },
];

test("la navegación de visitante deja el logotipo, el acceso y el registro sin listados privados", () => {
  assert.deepEqual(getCommunityNav({ authenticated: false, hasAdmin: false }), {
    homeHref: "/",
    links: [{ label: "Acceder", href: "/sign-in" }],
    cta: { label: "Crear cuenta", href: "/sign-up" },
    accountLinks: [],
    bottomLinks: [],
  });
});

test("un miembro sin capacidades recibe cinco enlaces, la tarjeta QR, su menú de cuenta y la barra inferior", () => {
  assert.deepEqual(getCommunityNav({ authenticated: true, hasAdmin: false }), {
    homeHref: "/home",
    links: memberLinks,
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
    accountLinks: [
      { label: "Mi perfil", href: "/profile" },
      { label: "Difusión y privacidad", href: "/profile/privacy" },
    ],
    bottomLinks,
  });
});

test("el panel administrativo aparece una sola vez, en el menú de cuenta, cuando hay capacidades", () => {
  const nav = getCommunityNav({ authenticated: true, hasAdmin: true });
  assert.deepEqual(nav.links, memberLinks);
  assert.deepEqual(nav.accountLinks, [
    { label: "Mi perfil", href: "/profile" },
    { label: "Difusión y privacidad", href: "/profile/privacy" },
    { label: "Panel administrativo", href: "/admin" },
  ]);
  assert.deepEqual(nav.bottomLinks, bottomLinks);
});

test("la ruta activa elige el enlace más específico y respeta los límites de segmento", () => {
  const items = [
    { href: "/home" },
    { href: "/activities" },
    { href: "/my-activities" },
    { href: "/profile" },
    { href: "/profile/privacy" },
  ];

  assert.equal(findActiveHref("/home", items), "/home");
  assert.equal(findActiveHref("/activities/cubesat-lab", items), "/activities");
  assert.equal(findActiveHref("/my-activities", items), "/my-activities");
  assert.equal(findActiveHref("/profile/talent", items), "/profile");
  assert.equal(findActiveHref("/profile/privacy", items), "/profile/privacy");
  assert.equal(findActiveHref("/activitiesx", items), null);
  assert.equal(findActiveHref("/qr-card", items), null);
  assert.equal(findActiveHref(null, items), null);
});

test("la portada solo es activa en su propia ruta", () => {
  assert.equal(findActiveHref("/", [{ href: "/" }]), "/");
  assert.equal(findActiveHref("/sign-in", [{ href: "/" }, { href: "/sign-in" }]), "/sign-in");
  assert.equal(findActiveHref("/privacy", [{ href: "/" }]), null);
});
