import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AnimatedWordmark from "./AnimatedWordmark";

test("AnimatedWordmark renderiza los siete glifos SVG en Node con color heredable y texto accesible", () => {
  const html = renderToStaticMarkup(<AnimatedWordmark as="h2" className="h-10" />);
  assert.match(html, /^<h2\b/);
  assert.match(html, /class="[^"]*\bh-10\b/);
  assert.match(html, /<span class="sr-only[^"]*">Ad Astra<\/span>/);

  const svgMatches = html.match(/<svg\b/g) ?? [];
  assert.equal(svgMatches.length, 14);
  assert.match(html, /fill="currentColor"/);
  assert.match(html, /aria-hidden="true"/);
});

test("AnimatedWordmark respeta ariaLabel y tamaño personalizado en línea sin relleno vertical extra", () => {
  const html = renderToStaticMarkup(
    <AnimatedWordmark inline ariaLabel="AD ASTRA" className="h-[0.82em] text-brand-ink" />,
  );
  assert.match(html, /^<span\b/);
  assert.match(html, /class="[^"]*\bh-\[0\.82em\][^"]*\btext-brand-ink\b/);
  assert.match(html, /<span class="sr-only[^"]*">AD ASTRA<\/span>/);
  assert.match(html, /\bpy-0\b/);
  assert.doesNotMatch(html, /\bpy-0\.5\b/);
});
