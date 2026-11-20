import assert from "node:assert/strict";
import test from "node:test";
import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

import { createNeonAuthProvider } from "./neon-auth";

const email = "alumna@uc3m.es";
const otp = "012345";

test("Neon uses the verification OTP endpoints and returns the verified identity", async () => {
  const user = { id: "auth-user", email, name: "Alumna", emailVerified: true };
  const sends: unknown[] = [];
  const verifications: unknown[] = [];
  const tokens = ["new-session-token", null, ""];

  const neonAuth = {
    emailOtp: {
      async sendVerificationOtp(input: unknown) {
        sends.push(input);
        return { data: { success: true }, error: null };
      },
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
