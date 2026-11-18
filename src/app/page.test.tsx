import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "./page";

test("la portada identifica la comunidad con un encabezado principal", () => {
  const html = renderToStaticMarkup(<Page />);
  assert.match(html, /<h1>Comunidad Ad Astra UC3M<\/h1>/);
});
