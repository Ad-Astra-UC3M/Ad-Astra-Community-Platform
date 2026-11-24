/**
 * @file Pruebas del JSX de acceso y verificación. Renderizan HTML con datos de prueba para comprobar los
 * formularios y destinos de App Router sin abrir el navegador.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SignInView } from "../sign-in/view";
import { VerifyEmailView } from "./view";

test("la verificación pide correo y seis dígitos, sin reutilizar tokens de la URL", () => {
  const html = renderToStaticMarkup(
    <VerifyEmailView
      params={{ sent: "1", token: "sample-single-use-token" }}
      email="sintetica@alumnos.uc3m.es"
    />,
  );

  assert.match(html, /name="email"/);
  assert.match(html, /value="sintetica@alumnos.uc3m.es"/);
  assert.match(html, /name="otp"/);
  assert.match(html, /pattern="\[0-9\]\{6\}"/);
  assert.match(html, /inputMode="numeric"/i);
  assert.match(html, /autoComplete="one-time-code"/i);
  assert.match(html, /Confirmar correo electrónico/);
  assert.doesNotMatch(html, /sample-single-use-token|name="token"/);
});

test("la verificación pendiente conserva el destino del acceso y permite retomarlo", () => {
  const html = renderToStaticMarkup(
    <VerifyEmailView params={{ pending: "1", next: "/bookmarks" }} />,
  );

  assert.match(html, /name="next"[^>]*value="\/bookmarks"/);
  assert.match(html, /href="\/sign-in\?next=%2Fbookmarks"/);
});

test("el acceso tras verificar sin sesión muestra la confirmación y conserva el destino", () => {
  const html = renderToStaticMarkup(
    <SignInView params={{ verified: "1", next: "/bookmarks" }} />,
  );

  assert.match(html, /ha sido verificado correctamente/i);
  assert.match(html, /name="next"[^>]*value="\/bookmarks"/);
});

test("un código caducado permite confirmar o solicitar otro y descarta destinos externos", () => {
  const html = renderToStaticMarkup(
    <VerifyEmailView params={{ error: "expired", next: "//external.invalid" }} />,
  );

  assert.match(html, /role="alert"/);
  assert.match(html, /ha caducado/i);
  assert.match(html, /Solicitar un nuevo código/);
  assert.match(html, /href="\/sign-in"/);
  assert.doesNotMatch(html, /external\.invalid/);
});

test("el panel editorial de acceso describe la plataforma gestionada con AnimatedWordmark", () => {
  const html = renderToStaticMarkup(<SignInView params={{}} />);

  assert.match(html, /La plataforma gestionada por.*<svg\b.*actividades que organizamos.*conectar con empresas del sector/s);
  assert.doesNotMatch(html, /Cuaderno aeroespacial universitario/i);
});
