import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import TextSpanWrapper2 from "./TextSpanWrapper2";

test("TextSpanWrapper2 acepta etiqueta as, tamaño personalizado y aplana hijos en array", () => {
  const name = "Lucía";
  const html = renderToStaticMarkup(
    <TextSpanWrapper2 as="h2" className="text-3xl sm:text-5xl">
      {"Hola, "}
      {name}
    </TextSpanWrapper2>,
  );
  assert.match(html, /^<h2\b/);
  assert.match(html, /class="[^"]*\btext-3xl\b[^"]*\bsm:text-5xl\b/);
  assert.match(html, /aria-label="Hola, Lucía"/);
  assert.match(html, /<span class="sr-only[^"]*">Hola, Lucía<\/span>/);
  assert.doesNotMatch(html, /Hola,\s*,/);
  assert.match(html, /<span aria-hidden="true" class="inline">/);
  assert.match(html, /ease-astra/);
  assert.match(html, /motion-reduce:transition-none/);
});

test("TextSpanWrapper2 soporta hijos numéricos y etiqueta span manteniendo la accesibilidad", () => {
  const html = renderToStaticMarkup(
    <TextSpanWrapper2 as="span" animateOnLoad className="text-xl">
      {["Actividades (", 4, ")"]}
    </TextSpanWrapper2>,
  );
  assert.match(html, /^<span\b/);
  assert.match(html, /class="[^"]*\btext-xl\b/);
  assert.match(html, /<span class="sr-only[^"]*">Actividades \(4\)<\/span>/);
  assert.match(html, /motion-safe:translate-y-full/);
  assert.match(html, /print:hidden/);
});
