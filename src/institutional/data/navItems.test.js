import assert from "node:assert/strict";
import test from "node:test";
import { getCommunityNav } from "./navItems.js";

test("la navegación de visitante expone portada, actividades, acceso y registro", () => {
  assert.deepEqual(getCommunityNav(undefined), {
    homeHref: "/",
    links: [
      { label: "Inicio", href: "/" },
      { label: "Actividades", href: "/activities" },
      { label: "Iniciar sesión", href: "/sign-in" },
    ],
    cta: { label: "Crear cuenta", href: "/sign-up" },
  });
});

test("la navegación de estudiante expone inicio, actividades, mis actividades, oportunidades, marcadores, perfil y tarjeta QR", () => {
  assert.deepEqual(getCommunityNav("student"), {
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

test("la navegación de organizador expone inicio, actividades, oportunidades, marcadores, perfil y gestión", () => {
  assert.deepEqual(getCommunityNav("organizer"), {
    homeHref: "/home",
    links: [
      { label: "Inicio", href: "/home" },
      { label: "Actividades", href: "/activities" },
      { label: "Oportunidades", href: "/opportunities" },
      { label: "Marcadores", href: "/bookmarks" },
      { label: "Mi perfil", href: "/profile" },
      { label: "Gestión", href: "/admin" },
    ],
    cta: { label: "Gestión", href: "/admin" },
  });
});
