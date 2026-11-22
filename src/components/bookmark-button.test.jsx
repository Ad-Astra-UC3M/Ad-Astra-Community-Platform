import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BookmarkButton } from "./bookmark-button";

test("el marcador muestra la acción, su estado y un icono, y conserva el filtro", () => {
  const html = renderToStaticMarkup(
    <BookmarkButton
      action={() => {}}
      id="opportunity-1"
      title="Diseño de antenas"
      saved={false}
      returnTo="/opportunities?type=research"
    />,
  );

  assert.match(html, /<button[^>]*type="submit"[^>]*aria-label="Guardar marcador · Diseño de antenas"[^>]*aria-pressed="false"/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /\[&amp;_path\]:fill-current/);
  assert.match(html, /name="opportunityId" value="opportunity-1"/);
  assert.match(html, /name="returnTo" value="\/opportunities\?type=research"/);
});

test("un marcador guardado tiene icono relleno y permite retirarlo", () => {
  const html = renderToStaticMarkup(
    <BookmarkButton
      action={() => {}}
      id="opportunity-1"
      title="Diseño de antenas"
      saved
      returnTo="/bookmarks"
    />,
  );

  assert.match(html, /aria-label="Retirar marcador · Diseño de antenas"[^>]*aria-pressed="true"/);
  assert.match(html, /\[&amp;_path\]:fill-current/);
  assert.match(html, /name="returnTo" value="\/bookmarks"/);
});
