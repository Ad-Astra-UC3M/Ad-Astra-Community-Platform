import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BackLink } from "./back-link";

test("el enlace de vuelta conserva el destino y el texto con una flecha decorativa", () => {
  const html = renderToStaticMarkup(<BackLink href="/activities">Volver a actividades</BackLink>);

  assert.match(html, /^<a [^>]*href="\/activities"/);
  assert.match(html, /<svg [^>]*aria-hidden="true"[^>]*>/);
  assert.match(html, /<svg [^>]*focusable="false"[^>]*>/);
  assert.match(html, /<span>Volver a actividades<\/span><\/a>$/);
});
