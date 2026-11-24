/**
 * @file Pruebas del adaptador de Neon. Sustituyen el transporte del SDK para comprobar rutas y respuestas
 * OTP con el contrato de Comunidad.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { NEON_AUTH_SESSION_COOKIE_NAME } from "@neondatabase/auth/server";
import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

import { createNeonAuthProvider, readNeonSession } from "./neon-auth";

const email = "alumna@uc3m.es";
const otp = "012345";

test("Neon uses the verification OTP endpoints and returns the verified identity", async () => {
  const user = { id: "auth-user", email, name: "Alumna", emailVerified: true };
  const sends: unknown[] = [];
  const verifications: unknown[] = [];
  const tokens = ["new-session-token", null, ""];

  const neonAuth = {
    emailOtp: {
      /** Registra input para comprobar el propósito enviado por el adaptador. */
      async sendVerificationOtp(input: unknown) {
        sends.push(input);
        return { data: { success: true }, error: null };
      },
      /** Registra input y alterna la presencia de token para comprobar sessionCreated. */
      async verifyEmail(input: unknown) {
        verifications.push(input);
        return { data: { status: true, token: tokens.shift(), user }, error: null };
      },
    },
  } as unknown as NeonAuth;

  const provider = createNeonAuthProvider(neonAuth);
  assert.deepEqual(await provider.sendVerificationOtp({ email }), { ok: true });
  for (const sessionCreated of [true, false, false]) {
    assert.deepEqual(await provider.verifyEmailOtp({ email, otp }), {
      ok: true,
      user,
      sessionCreated,
    });
  }
  assert.deepEqual(sends, [{ email, type: "email-verification" }]);
  assert.deepEqual(verifications, Array.from({ length: 3 }, () => ({ email, otp })));
});

test("Neon maps OTP errors without trusting an unrelated or unverified identity", async () => {
  const replies: unknown[] = [
    { error: { code: "OTP_EXPIRED", status: 400 } },
    { error: { code: "INVALID_OTP", status: 401 } },
    { error: { code: "TOO_MANY_ATTEMPTS", status: 403 } },
    { data: { status: true, user: { id: "other", email: "otra@uc3m.es", emailVerified: true } } },
    { data: { status: true, user: { id: "unverified", email, emailVerified: false } } },
  ];
  const neonAuth = {
    /** Proporciona a verifyEmail el siguiente fallo o identidad simulada que debe interpretar el adaptador. */
    emailOtp: { verifyEmail: async () => replies.shift() },
  } as unknown as NeonAuth;

  const provider = createNeonAuthProvider(neonAuth);
  for (const errorCode of [
    "TOKEN_EXPIRED",
    "INVALID_TOKEN",
    "INVALID_TOKEN",
    "PROVIDER_ERROR",
    "PROVIDER_ERROR",
  ]) {
    assert.deepEqual(await provider.verifyEmailOtp({ email, otp }), { ok: false, errorCode });
  }
});

test("Neon's server proxy sends the recovery and completion requests to the Better Auth OTP routes", async (t) => {
  const baseUrl = "https://auth.example.test/db/auth";
  const neonAuth = createNeonAuth({
    baseUrl,
    cookies: { secret: "a-test-cookie-secret-at-least-32-bytes" },
  });
  const args: unknown[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    args.push([url, init.method, JSON.parse(String(init.body))]);
    return Response.json({ status: true, success: true });
  });

  const provider = createNeonAuthProvider(neonAuth);
  assert.deepEqual(await provider.requestPasswordResetOtp({ email }), { ok: true });
  assert.deepEqual(
    await provider.resetPasswordWithOtp({ email, otp, newPassword: "a-new-password" }),
    { ok: true },
  );
  assert.deepEqual(args, [
    [baseUrl + "/email-otp/request-password-reset", "POST", { email }],
    [baseUrl + "/email-otp/reset-password", "POST", { email, otp, password: "a-new-password" }],
  ]);
});


test("session reads bypass cookie caches and tolerate upstream Set-Cookie without a Next cookie writer", async (t) => {
  const baseUrl = "https://auth.example.test/db/auth";
  const neonAuth = createNeonAuth({ baseUrl, cookies: { secret: "a-test-cookie-secret-at-least-32-bytes" } });
  const session = { id: "session-id", userId: "auth-user", expiresAt: "2030-01-01T00:00:00Z" };
  const user = { id: "auth-user", email, name: "Alumna", emailVerified: true };
  const calls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL, init?: RequestInit) => {
    calls.push(new URL(url));
    assert.match(new Headers(init?.headers).get("cookie") ?? "", /session_token=opaque-test-session/);
    return Response.json({ session, user }, { headers: { "set-cookie": "__Secure-neon-auth.local.session_data=cache; HttpOnly; Path=/" } });
  });
  assert.deepEqual(await readNeonSession(neonAuth, `${NEON_AUTH_SESSION_COOKIE_NAME}=opaque-test-session`), {
    session: { ...session, expiresAt: new Date(session.expiresAt) }, user,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, "/db/auth/get-session");
  assert.equal(calls[0].searchParams.get("disableCookieCache"), "true");
  assert.equal(calls[0].searchParams.get("disableRefresh"), "true");
});

test("session reads return null for missing, expired or revoked sessions", async (t) => {
  const neonAuth = createNeonAuth({ baseUrl: "https://auth.example.test/db/auth", cookies: { secret: "a-test-cookie-secret-at-least-32-bytes" } });
  const replies = [Response.json(null), Response.json({ message: "invalid session" }, { status: 401 }), Response.json({ session: { id: "bad", userId: "a", expiresAt: "not-a-date" }, user: { id: "a", email, name: "Alumna", emailVerified: true } })];
  t.mock.method(globalThis, "fetch", async () => replies.shift()!);
  assert.equal(await readNeonSession(neonAuth, ""), null);
  for (let i = 0; i < 3; i++) assert.equal(await readNeonSession(neonAuth, `${NEON_AUTH_SESSION_COOKIE_NAME}=opaque-test-session`), null);
});
