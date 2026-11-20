import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import VerifyEmailPage from "./page";

test("GET /verify-email?token=... muestra confirmación explícita sin consumir el token durante el render", async () => {
  const html = renderToStaticMarkup(
    await VerifyEmailPage({
      searchParams: Promise.resolve({ token: "sample-single-use-token" }),
    }),
  );

  assert.match(html, /Confirmar correo electrónico/);
  assert.match(html, /name="token"[^>]*value="sample-single-use-token"|value="sample-single-use-token"[^>]*name="token"/);
  assert.doesNotMatch(html, /ha sido verificado correctamente/i);
});

test("GET /verify-email?verified=1 muestra la confirmación y accesos a la comunidad", async () => {
  const html = renderToStaticMarkup(
    await VerifyEmailPage({
      searchParams: Promise.resolve({ verified: "1" }),
    }),
  );

  assert.match(html, /ha sido verificado correctamente/i);
  assert.match(html, /href="\/sign-in"/);
  assert.match(html, /href="\/home"/);
});

test("GET /verify-email?error=expired muestra alerta de enlace caducado y formulario de reenvío", async () => {
  const html = renderToStaticMarkup(
    await VerifyEmailPage({
      searchParams: Promise.resolve({ error: "expired" }),
    }),
  );

  assert.match(html, /ha caducado/i);
  assert.match(html, /Reenviar correo de verificación/);
});
