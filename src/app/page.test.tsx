import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CommunityLanding } from "../components/community-landing";

const enterDemo = async () => {};

test("la portada identifica la comunidad y da acceso al registro y al inicio de sesión", () => {
  const html = renderToStaticMarkup(<CommunityLanding enterDemo={enterDemo} />);
  assert.match(html, /<h1>Comunidad <span>Ad Astra UC3M<\/span><\/h1>/);
  assert.match(html, /href="\/sign-up"[^>]*>Crear cuenta de prueba/);
  assert.match(html, /href="\/sign-in"[^>]*>Acceder/);
});

test("la portada identifica la demo y ofrece un itinerario directo de estudiante", () => {
  const html = renderToStaticMarkup(<CommunityLanding enterDemo={enterDemo} />);
  assert.match(html, /datos ficticios/);
  assert.match(html, /<form[^>]*>.*<button[^>]*>Entrar como estudiante<\/button><\/form>/);
});
