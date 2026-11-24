import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("globals.css importa Tailwind CSS v4 con tokens de Ad Astra y sin hojas CSS tradicionales", () => {
  const globalsPath = resolve("src/app/globals.css");
  const css = readFileSync(globalsPath, "utf8");

  assert.match(css, /^@import "tailwindcss";/m);
  assert.match(css, /@theme\s*\{/);
  assert.match(css, /--color-brand-primary:/);
  assert.match(css, /--font-display:/);
  assert.match(css, /--font-serif:/);
  assert.match(css, /--ease-astra:/);

  assert.equal(existsSync(resolve("src/components/navigation-links.css")), false);
  assert.equal(existsSync(resolve("src/components/institutional-shell.css")), false);
  assert.equal(existsSync(resolve("src/institutional/institutional.css")), false);
});
