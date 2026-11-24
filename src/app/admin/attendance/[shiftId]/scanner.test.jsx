import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Scanner } from "./scanner";

test("el lector mantiene la alternativa manual y el campo esperado por la acción", () => {
  const html = renderToStaticMarkup(<Scanner action={async () => ""} />);
  assert.match(html, /Abrir cámara/);
  assert.match(html, /Código de la tarjeta/);
  assert.match(html, /name="token"/);
  assert.match(html, /Validar tarjeta/);
});
