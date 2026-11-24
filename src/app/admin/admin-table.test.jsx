import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminTable } from "./admin-table";

test("la tabla administrativa ofrece una región desplazable y encabezados accesibles", () => {
  const html = renderToStaticMarkup(<AdminTable label="Cuentas" headers={["Nombre", "Estado"]}><tr><td>Ana</td><td>Activa</td></tr></AdminTable>);
  assert.match(html, /role="region" aria-label="Cuentas" tabindex="0"/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /<th scope="col"[^>]*>Nombre<\/th>/);
  assert.match(html, /<td>Activa<\/td>/);
});
