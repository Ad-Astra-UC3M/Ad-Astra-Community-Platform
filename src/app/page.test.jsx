import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CommunityLanding } from "../components/community-landing";

test("la portada identifica la comunidad y da acceso al registro, al inicio de sesión y a la privacidad", () => {
  const html = renderToStaticMarkup(<CommunityLanding />);
  assert.match(html, /<h1>Comunidad <span>Ad Astra UC3M<\/span><\/h1>/);
  assert.match(html, /href="\/sign-up"[^>]*>Crear cuenta<\/a>/);
  assert.match(html, /href="\/sign-in"[^>]*>Acceder<\/a>/);
  assert.match(html, /href="\/privacy"[^>]*>aviso de privacidad<\/a>/);
});

test("la portada no incluye botones ni menciones al antiguo sistema de demostración", () => {
  const html = renderToStaticMarkup(<CommunityLanding />);
  assert.doesNotMatch(html, /demo|ficticios|de prueba|Entrar como estudiante/i);
});
