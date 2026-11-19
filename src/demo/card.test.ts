import assert from "node:assert/strict";
import test from "node:test";
import { getCardVersion, issueCard, readCard, reissueCard, verifyCard } from "./card";

test("una tarjeta es estable y solo es válida en el espacio donde fue emitida", async () => {
  const token = await issueCard("alpha", "test-person");
  assert.equal(await issueCard("alpha", "test-person"), token);
  assert.equal(await readCard("alpha", token), "test-person");
  assert.equal(await verifyCard("alpha", token), "test-person");
  assert.equal(await readCard("beta", token), null);
  assert.equal(await readCard("alpha", token.replace(/^[^.]+/, "invalid")), null);
  assert.equal(await readCard("alpha", ""), null);
});

test("reemitir una tarjeta incrementa su versión e invalida las tarjetas anteriores de esa cuenta", async () => {
  const firstToken = await issueCard("reissue-ws", "student-a");
  const otherStudentToken = await issueCard("reissue-ws", "student-b");
  assert.equal(getCardVersion("reissue-ws", "student-a"), 1);

  const reissued = await reissueCard("reissue-ws", "student-a");
  assert.equal(reissued.version, 2);
  assert.notEqual(reissued.token, firstToken);
  assert.equal(getCardVersion("reissue-ws", "student-a"), 2);
  assert.equal(await issueCard("reissue-ws", "student-a"), reissued.token);

  assert.equal(await verifyCard("reissue-ws", firstToken), null);
  assert.equal(await verifyCard("reissue-ws", reissued.token), "student-a");
  assert.equal(await verifyCard("reissue-ws", otherStudentToken), "student-b");

  const third = await reissueCard("reissue-ws", "student-a");
  assert.equal(third.version, 3);
  assert.equal(await verifyCard("reissue-ws", reissued.token), null);
  assert.equal(await verifyCard("reissue-ws", third.token), "student-a");
});
