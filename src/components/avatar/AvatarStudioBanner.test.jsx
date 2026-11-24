import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AvatarStudioBanner from "./AvatarStudioBanner";

test("renders the original Avatar Studio invitation and opens its external link in a new tab", () => {
  const html = renderToStaticMarkup(<AvatarStudioBanner />);
  assert.match(html, /<h2\b[^>]*aria-label="Tu cara\. Tu universo\."/);
  assert.match(html, />Crea tu avatar y dale tu toque al universo Ad Astra\.</);
  assert.match(html, />Muchas caras\. Un mismo universo\.</);
  assert.match(html, /<a\b[^>]*href="https:\/\/avatar\.adastrauc3m\.es\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Crear mi avatar/);
});

test("renders two cycles of the decorative portrait strip and exposes its pause control", () => {
  const html = renderToStaticMarkup(<AvatarStudioBanner />);
  const portraits = [...html.matchAll(/<img\b[^>]*src="\/brand\/avatar-studio\/face-(\d+)\.png"[^>]*alt=""/g)];
  assert.equal(portraits.length, 20);
  assert.equal(new Set(portraits.map((portrait) => portrait[1])).size, 10);
  assert.match(html, /role="group"[^>]*aria-label="Ejemplos de avatares Ad Astra"/);
  assert.match(html, /<button\b[^>]*type="button"[^>]*aria-label="Pausar animación de caras"[^>]*aria-pressed="false"/);
});
