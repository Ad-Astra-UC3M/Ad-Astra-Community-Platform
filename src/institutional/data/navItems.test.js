import assert from "node:assert/strict";
import test from "node:test";
import { getCommunityNav } from "./navItems.js";

test("la navegación de visitante expone portada, actividades, acceso y registro", () => {
  assert.deepEqual(getCommunityNav({ authenticated: false, hasAdmin: false }), {
    homeHref: "/",
    links: [
      { label: "Inicio", href: "/" },
      { label: "Actividades", href: "/activities" },
      { label: "Iniciar sesión", href: "/sign-in" },
    ],
    cta: { label: "Crear cuenta", href: "/sign-up" },
  });
});

test("la navegación de miembro autenticado sin capacidades oculta Gestión y muestra los enlaces de comunidad", () => {
  assert.deepEqual(getCommunityNav({ authenticated: true, hasAdmin: false }), {
    homeHref: "/home",
    links: [
      { label: "Inicio", href: "/home" },
      { label: "Actividades", href: "/activities" },
      { label: "Mis actividades", href: "/my-activities" },
      { label: "Oportunidades", href: "/opportunities" },
      { label: "Marcadores", href: "/bookmarks" },
      { label: "Mi perfil", href: "/profile" },
    ],
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
  });
});

test("la navegación de miembro con capacidades administrativas añade Gestión manteniendo los enlaces de comunidad", () => {
  assert.deepEqual(getCommunityNav({ authenticated: true, hasAdmin: true }), {
    homeHref: "/home",
    links: [
      { label: "Inicio", href: "/home" },
      { label: "Actividades", href: "/activities" },
      { label: "Mis actividades", href: "/my-activities" },
      { label: "Oportunidades", href: "/opportunities" },
      { label: "Marcadores", href: "/bookmarks" },
      { label: "Mi perfil", href: "/profile" },
      { label: "Gestión", href: "/admin" },
    ],
    cta: { label: "Mi tarjeta QR", href: "/qr-card" },
  });
});
