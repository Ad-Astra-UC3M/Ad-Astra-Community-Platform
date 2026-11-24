import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getCommunityNav } from "../../data/navItems";
import { AccountMenu } from "./AccountMenu";
import { MemberBottomNav } from "./MemberBottomNav";
import { NavLink } from "./NavLink";

test("el enlace activo anuncia la página actual y aplica su estilo; el inactivo no", () => {
  const active = renderToStaticMarkup(
    <NavLink href="/activities" active className="base" activeClassName="is-active">Actividades</NavLink>,
  );
  const idle = renderToStaticMarkup(
    <NavLink href="/home" active={false} className="base" activeClassName="is-active">Inicio</NavLink>,
  );

  assert.match(active, /<a [^>]*href="\/activities"/);
  assert.match(active, /aria-current="page"/);
  assert.match(active, /class="base is-active"/);
  assert.doesNotMatch(idle, /aria-current/);
  assert.match(idle, /class="base"/);
});

test("la barra inferior móvil ofrece los cinco accesos con icono decorativo y marca el activo", () => {
  const { bottomLinks } = getCommunityNav({ authenticated: true });
  const html = renderToStaticMarkup(<MemberBottomNav links={bottomLinks} activeHref="/qr-card" />);

  assert.match(html, /^<nav [^>]*aria-label="Accesos rápidos"/);
  for (const { label, href } of bottomLinks) {
    assert.match(html, new RegExp(`href="${href}"[^>]*>.*?${label}</span>`));
  }
  assert.equal(html.match(/aria-current="page"/g)?.length, 1);
  assert.match(html, /<a aria-current="page"[^>]*href="\/qr-card"/);
  assert.match(html, /<a aria-current="page" class="[^"]*text-brand-primary[^"]*"/);
  assert.doesNotMatch(html, /<a aria-current="page" class="[^"]*text-brand-ink/);
  assert.equal(html.match(/<svg [^>]*aria-hidden="true"/g)?.length, 5);
  // AnimateIcon usa `asChild`: el propio enlace dispara la animación, sin un envoltorio adicional en la lista.
  assert.equal(html.match(/<li class="min-w-0"><a /g)?.length, 5);
  // Legibilidad: etiquetas de al menos 12 px en una sola línea y una marca no cromática en el activo.
  assert.equal(html.match(/<span class="[^"]*whitespace-nowrap[^"]*text-xs/g)?.length, 5);
  assert.doesNotMatch(html, /clamp\(|hyphens-auto|break-words/);
  assert.equal(html.match(/data-active-indicator/g)?.length, 1);
});

test("el botón del menú de cuenta nombra a la persona y no expone el correo hasta abrirse", () => {
  const html = renderToStaticMarkup(
    <AccountMenu
      account={{ name: "Lucía Martín", email: "lucia@alumnos.uc3m.es", avatarUrl: null }}
      links={getCommunityNav({ authenticated: true, hasAdmin: true }).accountLinks}
      activeHref={null}
      signOutAction={() => {}}
    />,
  );

  assert.match(html, /<button[^>]*aria-label="Menú de cuenta de Lucía Martín"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /LM/);
  assert.doesNotMatch(html, /lucia@alumnos\.uc3m\.es/);
  assert.doesNotMatch(html, /Cerrar sesión/);
  // El formulario de cierre se monta fuera del menú para sobrevivir a su cierre al elegir la opción.
  assert.match(html, /<form[^>]*hidden/);
});
