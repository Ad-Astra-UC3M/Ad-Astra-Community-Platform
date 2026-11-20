/**
 * @file Pruebas del proveedor de autenticación aislado. Comprueban el reenvío, la caducidad y la separación
 * de códigos que reutiliza Playwright.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createTestDb } from "../../db/client";
import { createTestAuthProvider, getLatestTestOtp } from "./test-auth-provider";

const email = "alumna@uc3m.es";
const otherEmail = "otra@uc3m.es";
const password = "strong-password";
const newPassword = "changed-password";

test("test auth issues a six-digit verification code per address and replaces it on resend", async () => {
  const db = await createTestDb();

  try {
    const provider = createTestAuthProvider(db);
    assert.equal((await provider.signUp({ email, name: "Alumna", password })).ok, true);
    assert.equal((await provider.signUp({ email: otherEmail, name: "Otra", password })).ok, true);
    const firstOtp = await getLatestTestOtp(db, email, "email-verification");
    assert.ok(firstOtp);
    assert.match(firstOtp, /^\d{6}$/);

    assert.deepEqual(await provider.sendVerificationOtp({ email }), { ok: true });
    const otp = await getLatestTestOtp(db, email, "email-verification");
    assert.ok(otp);
    assert.notEqual(otp, firstOtp);

    assert.deepEqual(await provider.verifyEmailOtp({ email, otp: firstOtp }), { ok: false, errorCode: "INVALID_TOKEN" });
    if (await getLatestTestOtp(db, otherEmail, "email-verification") === otp) {
      await provider.sendVerificationOtp({ email: otherEmail });
    }
    assert.deepEqual(await provider.verifyEmailOtp({ email: otherEmail, otp }), {
      ok: false,
      errorCode: "INVALID_TOKEN",
    });
    const results = await Promise.all([
      provider.verifyEmailOtp({ email, otp }),
      provider.verifyEmailOtp({ email, otp }),
    ]);
    const verified = results.find((result) => result.ok);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(verified?.user?.email, email);
    assert.equal(verified?.user?.emailVerified, true);
    assert.equal(verified?.sessionCreated, true);
    assert.equal((await provider.getSession())?.user.email, email);

    const otherOtp = await getLatestTestOtp(db, otherEmail, "email-verification");
    assert.ok(otherOtp);
    const invalidOtp = otherOtp === "000000" ? "000001" : "000000";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await provider.verifyEmailOtp({ email: otherEmail, otp: invalidOtp })).ok, false);
    }
    assert.equal((await provider.verifyEmailOtp({ email: otherEmail, otp: otherOtp })).ok, false);
    assert.equal(await getLatestTestOtp(db, otherEmail, "email-verification"), null);
  } finally {
    await db.close();
  }
});

test("test auth expires codes and keeps password reset separate from verification", async () => {
  const db = await createTestDb();
  let now = new Date("2026-11-20T12:00:00Z");

  try {
    /** Usa el reloj de la prueba para emitir y caducar los códigos. */
    const provider = createTestAuthProvider(db, { now: () => now });
    await provider.signUp({ email, name: "Alumna", password });
    const expiredOtp = await getLatestTestOtp(db, email, "email-verification", now);
    assert.ok(expiredOtp);
    now = new Date("2026-11-20T12:05:00Z");
    assert.deepEqual(await provider.verifyEmailOtp({ email, otp: expiredOtp }), { ok: false, errorCode: "TOKEN_EXPIRED" });

    await provider.sendVerificationOtp({ email });
    const verifyOtp = await getLatestTestOtp(db, email, "email-verification", now);
    assert.ok(verifyOtp);
    assert.deepEqual(await provider.resetPasswordWithOtp({ email, otp: verifyOtp, newPassword }), { ok: false, errorCode: "INVALID_TOKEN" });
    assert.equal((await provider.verifyEmailOtp({ email, otp: verifyOtp })).ok, true);

    /** Usa la misma hora con una segunda sesión que debe revocarse. */
    const anotherDevice = createTestAuthProvider(db, { now: () => now });
    assert.equal((await anotherDevice.signIn({ email, password })).ok, true);
    assert.deepEqual(await provider.requestPasswordResetOtp({ email }), { ok: true });
    const resetOtp = await getLatestTestOtp(db, email, "password-reset", now);
    assert.ok(resetOtp);
    assert.deepEqual(await provider.verifyEmailOtp({ email, otp: resetOtp }), { ok: false, errorCode: "INVALID_TOKEN" });

    /** Comparte la hora en el acceso concurrente con el cambio de contraseña. */
    const racingDevice = createTestAuthProvider(db, { now: () => now });
    const [, reset] = await Promise.all([
      racingDevice.signIn({ email, password }),
      provider.resetPasswordWithOtp({ email, otp: resetOtp, newPassword }),
    ]);
    assert.deepEqual(reset, { ok: true });
    assert.equal(await racingDevice.getSession(), null);
    assert.deepEqual(await provider.resetPasswordWithOtp({ email, otp: resetOtp, newPassword }), { ok: false, errorCode: "INVALID_TOKEN" });
    assert.equal(await anotherDevice.getSession(), null);
    assert.equal((await provider.signIn({ email, password })).ok, false);
    assert.equal((await provider.signIn({ email, password: newPassword })).ok, true);
  } finally {
    await db.close();
  }
});
