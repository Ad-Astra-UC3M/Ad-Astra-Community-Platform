import assert from "node:assert/strict";
import test from "node:test";
import { issueCard, readCard } from "./card";

test("una tarjeta es estable y solo es válida en el espacio donde fue emitida", async () => {
  const token = await issueCard("alpha", "test-person");
  assert.equal(await issueCard("alpha", "test-person"), token);
  assert.equal(await readCard("alpha", token), "test-person");
  assert.equal(await readCard("beta", token), null);
  assert.equal(await readCard("alpha", token.replace(/^[^.]+/, "invalid")), null);
  assert.equal(await readCard("alpha", ""), null);
});
