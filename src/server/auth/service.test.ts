import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";

import { createTestDb } from "../../db/client";
import { accountCapabilities, profiles } from "../../db/schema";
import type { AuthProvider } from "../../lib/auth/neon-auth";
import {
  createTestAuthProvider,
  getLatestTestOtp,
} from "../../lib/auth/test-auth-provider";
import {
  isUc3mEmail,
  normalizeEmail,
  sanitizeNextPath,
} from "../../lib/auth/uc3m";
import {
  DELETE as authRouteDelete,
  GET as authRouteGet,
  PATCH as authRoutePatch,
  POST as authRoutePost,
  PUT as authRoutePut,
} from "../../app/api/auth/[...path]/route";
import {
  PRIVACY_VERSION,
  authenticateAccount,
  completePasswordReset,
  registerAccount,
  requestPasswordReset,
  resendAccountVerification,
  resolveCurrentUser,
  verifyAccountEmail,
} from "./service";

describe("UC3M email validation and next-path sanitization", () => {
  it("normalizes and validates root uc3m.es and subdomains with dot boundary", () => {
    assert.equal(normalizeEmail("  Ana.Garcia@ALUMNOS.UC3M.ES "), "ana.garcia@alumnos.uc3m.es");
    assert.equal(normalizeEmail("invalid-email"), null);
    assert.equal(normalizeEmail("user@uc3m.es\n"), null);

    assert.equal(isUc3mEmail("docente@uc3m.es"), true);
    assert.equal(isUc3mEmail("100456789@ALUMNOS.UC3M.ES"), true);
    assert.equal(isUc3mEmail("coord@ing.dept.uc3m.es"), true);

    assert.equal(isUc3mEmail("user@notuc3m.es"), false);
    assert.equal(isUc3mEmail("user@uc3m.es.evil.com"), false);
    assert.equal(isUc3mEmail("user@fake-uc3m.es"), false);
    assert.equal(isUc3mEmail("user@.uc3m.es"), false);
    assert.equal(isUc3mEmail("user@-sub.uc3m.es"), false);
    assert.equal(isUc3mEmail("user..name@uc3m.es"), false);
    assert.equal(isUc3mEmail(".user@uc3m.es"), false);
    assert.equal(isUc3mEmail("user@gmail.com"), false);
    assert.equal(isUc3mEmail(""), false);
  });

  it("sanitizes next paths and blocks open redirects or schemes", () => {
    assert.equal(sanitizeNextPath("/activities/cubesat-lab?tab=shifts"), "/activities/cubesat-lab?tab=shifts");
    assert.equal(sanitizeNextPath("/admin/accounts"), "/admin/accounts");
    assert.equal(sanitizeNextPath("//evil.com/phish"), "/home");
    assert.equal(sanitizeNextPath("/\\evil.com"), "/home");
    assert.equal(sanitizeNextPath("https://evil.com/home"), "/home");
    assert.equal(sanitizeNextPath("http://evil.com/home"), "/home");
    assert.equal(sanitizeNextPath("javascript:alert(1)"), "/home");
    assert.equal(sanitizeNextPath("/home\r\nSet-Cookie: a=b"), "/home");
    assert.equal(sanitizeNextPath("relative/path", "/admin"), "/admin");
    assert.equal(sanitizeNextPath(null, "//bad-fallback"), "/home");
  });
});

describe("Auth service (Neon Auth + public.profiles on PGlite)", () => {
  it("validates UC3M domain and privacy acceptance BEFORE calling AuthProvider (RF-02, CA-02)", async () => {
    const db = await createTestDb();
    try {
      let signUpCalls = 0;
      const baseProvider = createTestAuthProvider(db);
      const spyProvider: AuthProvider = {
        ...baseProvider,
        async signUp(input) {
          signUpCalls += 1;
          return baseProvider.signUp(input);
        },
      };

      const noPrivacy = await registerAccount(db, spyProvider, {
        firstName: "Lucía",
        lastName: "Pérez",
        email: "lucia@alumnos.uc3m.es",
        degree: "Ingeniería Aeroespacial",
        course: "2.º",
        password: "PasswordSegura2026!",
        privacyAccepted: false,
      });
      assert.deepEqual(noPrivacy, { ok: false, error: "privacy" });
      assert.equal(signUpCalls, 0);

      const nonUc3m = await registerAccount(db, spyProvider, {
        firstName: "Lucía",
        lastName: "Pérez",
        email: "lucia@gmail.com",
        degree: "Ingeniería Aeroespacial",
        course: "2.º",
        password: "PasswordSegura2026!",
        privacyAccepted: true,
      });
      assert.deepEqual(nonUc3m, { ok: false, error: "email" });
      assert.equal(signUpCalls, 0);

      const weakPassword = await registerAccount(db, spyProvider, {
        firstName: "Lucía",
        lastName: "Pérez",
        email: "lucia@uc3m.es",
        degree: "Ingeniería Aeroespacial",
        course: "2.º",
        password: "short",
        privacyAccepted: true,
      });
      assert.deepEqual(weakPassword, { ok: false, error: "password" });
      assert.equal(signUpCalls, 0);
    } finally {
      await db.close();
    }
  });

  it("registers, verifies email (single-use), signs in, resolves user with capabilities, and signs out (CA-02, CA-03)", async () => {
    const db = await createTestDb();
    try {
      const authProvider = createTestAuthProvider(db);

      const registered = await registerAccount(db, authProvider, {
        firstName: "Carlos",
        lastName: "Ruiz",
        email: "Carlos.Ruiz@ALUMNOS.UC3M.ES",
        degree: "Ingeniería Informática",
        course: "3.º",
        password: "PasswordSegura2026!",
        privacyAccepted: true,
      });
      assert.equal(registered.ok, true);
      if (!registered.ok) return;
      assert.equal(registered.email, "carlos.ruiz@alumnos.uc3m.es");
      assert.equal(registered.verificationRequired, true);
      assert.equal(registered.recovered, false);

      // Profile persisted with privacy metadata and null emailVerifiedAt.
      const [profileRow] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, registered.profileId));
      assert.ok(profileRow);
      assert.equal(profileRow.authUserId, registered.authUserId);
      assert.equal(profileRow.privacyAccepted, true);
      assert.equal(profileRow.privacyVersion, PRIVACY_VERSION);
      assert.ok(profileRow.registeredAt instanceof Date);
      assert.equal(profileRow.emailVerifiedAt, null);

      // Unverified user cannot sign in.
      const unverifiedSignIn = await authenticateAccount(
        db,
        authProvider,
        "carlos.ruiz@alumnos.uc3m.es",
        "PasswordSegura2026!",
      );
      assert.deepEqual(unverifiedSignIn, { ok: false, error: "unverified" });
      assert.equal(await resolveCurrentUser(db, authProvider), null);

      // Verify email using test code from neon_auth.verification.
      const otp = await getLatestTestOtp(db, "carlos.ruiz@alumnos.uc3m.es", "email-verification");
      assert.ok(otp);
      const email = "carlos.ruiz@alumnos.uc3m.es";
      assert.deepEqual(
        await completePasswordReset(db, authProvider, { email, otp, password: "NewPassword2026!" }),
        { ok: false, error: "invalid" },
      );
      assert.deepEqual(
        await verifyAccountEmail(db, authProvider, { email: "otra@uc3m.es", otp }),
        { ok: false, error: "invalid" },
      );
      const verified = await verifyAccountEmail(db, authProvider, { email, otp });
      assert.equal(verified.ok, true);
      assert.equal(verified.ok && verified.sessionUser?.email, email);

      // The code is single-use.
      const reused = await verifyAccountEmail(db, authProvider, { email, otp });
      assert.deepEqual(reused, { ok: false, error: "invalid" });

      // email_verified_at is now stamped in public.profiles.
      const [verifiedProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, registered.profileId));
      assert.ok(verifiedProfile.emailVerifiedAt instanceof Date);

      // Grant an administrative capability to verify resolveCurrentUser loads it.
      await db.insert(accountCapabilities).values({
        profileId: registered.profileId,
        capabilityCode: "attendance_validation",
      });

      // Sign in succeeds and opens session.
      const signedIn = await authenticateAccount(
        db,
        authProvider,
        "CARLOS.RUIZ@alumnos.uc3m.es",
        "PasswordSegura2026!",
      );
      assert.equal(signedIn.ok, true);
      if (!signedIn.ok) return;
      assert.equal(signedIn.user.id, registered.profileId);
      assert.equal(signedIn.user.personId, registered.profileId);
      assert.equal(signedIn.user.authUserId, registered.authUserId);
      assert.equal(signedIn.user.name, "Carlos Ruiz");
      assert.deepEqual(signedIn.user.capabilities, ["attendance_validation"]);

      const current = await resolveCurrentUser(db, authProvider);
      assert.deepEqual(current, signedIn.user);

      // Duplicate registration rejected once linked.
      const duplicate = await registerAccount(db, authProvider, {
        firstName: "Carlos",
        lastName: "Ruiz",
        email: "carlos.ruiz@alumnos.uc3m.es",
        degree: "Ingeniería Informática",
        course: "3.º",
        password: "PasswordSegura2026!",
        privacyAccepted: true,
      });
      assert.deepEqual(duplicate, { ok: false, error: "duplicate" });

      // Sign out destroys session.
      await authProvider.signOut();
      assert.equal(await resolveCurrentUser(db, authProvider), null);
    } finally {
      await db.close();
    }
  });

  it("recovers local profile linking on authorized retry after partial sign-up failure without duplicating (spec §1.3.2)", async () => {
    const db = await createTestDb();
    try {
      const authProvider = createTestAuthProvider(db);

      // Simulate attempt 1: Neon Auth user was created, but local public.profiles write failed.
      const orphanSignUp = await authProvider.signUp({
        email: "recovery@uc3m.es",
        password: "RecoveryPassword2026!",
        name: "Marta Soler",
      });
      assert.equal(orphanSignUp.ok, true);
      if (!orphanSignUp.ok) return;

      // Unauthorized retry with WRONG password must NOT link or create profile.
      const unauthorizedRetry = await registerAccount(db, authProvider, {
        firstName: "Intruso",
        lastName: "Malicioso",
        email: "recovery@uc3m.es",
        degree: "Derecho",
        course: "1.º",
        password: "WrongPassword2026!",
        privacyAccepted: true,
      });
      assert.deepEqual(unauthorizedRetry, { ok: false, error: "duplicate" });
      const rowsAfterUnauthorized = await db
        .select()
        .from(profiles)
        .where(eq(profiles.email, "recovery@uc3m.es"));
      assert.equal(rowsAfterUnauthorized.length, 0);

      // Authorized retry with matching password recovers link and completes single profile.
      const authorizedRetry = await registerAccount(db, authProvider, {
        firstName: "Marta",
        lastName: "Soler",
        email: "recovery@uc3m.es",
        degree: "Ingeniería Aeroespacial",
        course: "4.º",
        password: "RecoveryPassword2026!",
        privacyAccepted: true,
      });
      assert.equal(authorizedRetry.ok, true);
      if (!authorizedRetry.ok) return;
      assert.equal(authorizedRetry.recovered, true);
      assert.equal(authorizedRetry.authUserId, orphanSignUp.user.id);

      const rowsAfterRecovery = await db
        .select()
        .from(profiles)
        .where(eq(profiles.email, "recovery@uc3m.es"));
      assert.equal(rowsAfterRecovery.length, 1);
      assert.equal(rowsAfterRecovery[0].authUserId, orphanSignUp.user.id);
      assert.equal(rowsAfterRecovery[0].privacyAccepted, true);
      assert.equal(rowsAfterRecovery[0].privacyVersion, PRIVACY_VERSION);
    } finally {
      await db.close();
    }
  });

  it("handles uniform password reset and revokes all existing sessions across devices (RF-03, CA-03)", async () => {
    const db = await createTestDb();
    try {
      const deviceA = createTestAuthProvider(db);
      const deviceB = createTestAuthProvider(db);

      // Request reset for non-existent and non-UC3M accounts -> uniform { ok: true }.
      assert.deepEqual(
        await requestPasswordReset(db, deviceA, "noexiste@alumnos.uc3m.es"),
        { ok: true },
      );
      assert.deepEqual(
        await requestPasswordReset(db, deviceA, "user@gmail.com"),
        { ok: true },
      );

      // Create & verify user.
      const reg = await registerAccount(db, deviceA, {
        firstName: "David",
        lastName: "López",
        email: "david.lopez@uc3m.es",
        degree: "Física",
        course: "2.º",
        password: "OldPassword2026!",
        privacyAccepted: true,
      });
      assert.equal(reg.ok, true);
      const verificationOtp = await getLatestTestOtp(db, "david.lopez@uc3m.es", "email-verification");
      assert.ok(verificationOtp);
      assert.equal((await verifyAccountEmail(db, deviceA, { email: "david.lopez@uc3m.es", otp: verificationOtp })).ok, true);

      // Open two independent sessions (deviceA and deviceB).
      assert.equal(
        (await authenticateAccount(db, deviceA, "david.lopez@uc3m.es", "OldPassword2026!")).ok,
        true,
      );
      assert.equal(
        (await authenticateAccount(db, deviceB, "david.lopez@uc3m.es", "OldPassword2026!")).ok,
        true,
      );
      assert.ok(await resolveCurrentUser(db, deviceA));
      assert.ok(await resolveCurrentUser(db, deviceB));

      // Request password reset.
      assert.deepEqual(await requestPasswordReset(db, deviceA, "david.lopez@uc3m.es"), {
        ok: true,
      });
      const recoveryOtp = await getLatestTestOtp(db, "david.lopez@uc3m.es", "password-reset");
      assert.ok(recoveryOtp);

      // Mismatch rejected without consuming token.
      assert.deepEqual(
        await completePasswordReset(db, deviceA, {
          email: "david.lopez@uc3m.es",
          otp: recoveryOtp,
          password: "NewPassword2026!",
          confirmPassword: "DifferentPassword!",
        }),
        { ok: false, error: "mismatch" },
      );

      // Complete password reset -> revokes ALL sessions in neon_auth.session.
      assert.deepEqual(
        await completePasswordReset(db, deviceA, {
          email: "david.lopez@uc3m.es",
          otp: recoveryOtp,
          password: "NewPassword2026!",
          confirmPassword: "NewPassword2026!",
        }),
        { ok: true },
      );

      // Both devices immediately lose their session.
      assert.equal(await resolveCurrentUser(db, deviceA), null);
      assert.equal(await resolveCurrentUser(db, deviceB), null);

      const remainingSessions = await db.execute<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM neon_auth.session`,
      );
      assert.equal(remainingSessions.rows[0]?.count, "0");

      // The code is single-use.
      assert.deepEqual(
        await completePasswordReset(db, deviceA, {
          email: "david.lopez@uc3m.es",
          otp: recoveryOtp,
          password: "AnotherPassword2026!",
        }),
        { ok: false, error: "invalid" },
      );

      // Old password fails, new password works.
      assert.deepEqual(
        await authenticateAccount(db, deviceB, "david.lopez@uc3m.es", "OldPassword2026!"),
        { ok: false, error: "credentials" },
      );
      assert.equal(
        (await authenticateAccount(db, deviceB, "david.lopez@uc3m.es", "NewPassword2026!")).ok,
        true,
      );
    } finally {
      await db.close();
    }
  });

  it("enforces defense in depth in resolveCurrentUser and revokes sessions on deactivation (CA-01, CA-09)", async () => {
    const db = await createTestDb();
    try {
      const authProvider = createTestAuthProvider(db);
      const reg = await registerAccount(db, authProvider, {
        firstName: "Sofía",
        lastName: "Vega",
        email: "sofia.vega@alumnos.uc3m.es",
        degree: "Ingeniería de Telecomunicación",
        course: "4.º",
        password: "SofiaPassword2026!",
        privacyAccepted: true,
      });
      assert.equal(reg.ok, true);
      if (!reg.ok) return;

      // Resend verification issues a fresh valid token.
      assert.deepEqual(
        await resendAccountVerification(db, authProvider, "sofia.vega@alumnos.uc3m.es"),
        { ok: true },
      );
      const otp = await getLatestTestOtp(db, "sofia.vega@alumnos.uc3m.es", "email-verification");
      assert.ok(otp);
      assert.equal((await verifyAccountEmail(db, authProvider, { email: "sofia.vega@alumnos.uc3m.es", otp })).ok, true);
      assert.equal(
        (await authenticateAccount(db, authProvider, "sofia.vega@alumnos.uc3m.es", "SofiaPassword2026!")).ok,
        true,
      );
      assert.ok(await resolveCurrentUser(db, authProvider));

      // Defense in depth: tampered session with unverified email is rejected.
      const unverifiedSessionProvider: AuthProvider = {
        ...authProvider,
        async getSession() {
          const real = await authProvider.getSession();
          return real
            ? { ...real, user: { ...real.user, emailVerified: false } }
            : null;
        },
      };
      assert.equal(await resolveCurrentUser(db, unverifiedSessionProvider), null);

      // Defense in depth: tampered session with mismatched or non-UC3M email is rejected.
      const mismatchedEmailProvider: AuthProvider = {
        ...authProvider,
        async getSession() {
          const real = await authProvider.getSession();
          return real
            ? { ...real, user: { ...real.user, email: "other@alumnos.uc3m.es" } }
            : null;
        },
      };
      assert.equal(await resolveCurrentUser(db, mismatchedEmailProvider), null);

      // Deactivating profile immediately blocks resolveCurrentUser and revokeUserSessions deletes neon_auth.session.
      await db
        .update(profiles)
        .set({ status: "deactivated", deactivatedAt: new Date() })
        .where(eq(profiles.id, reg.profileId));
      assert.equal(await resolveCurrentUser(db, authProvider), null);

      await authProvider.revokeUserSessions(reg.authUserId);
      assert.equal(await authProvider.getSession(), null);

      // Deactivated account cannot sign in again.
      assert.deepEqual(
        await authenticateAccount(db, authProvider, "sofia.vega@alumnos.uc3m.es", "SofiaPassword2026!"),
        { ok: false, error: "credentials" },
      );
    } finally {
      await db.close();
    }
  });

  it("rejects expired verification and password reset codes deterministically", async () => {
    const db = await createTestDb();
    try {
      let currentTime = new Date("2026-11-19T12:00:00Z");
      const authProvider = createTestAuthProvider(db, {
        now: () => currentTime,
      });

      const reg = await registerAccount(
        db,
        authProvider,
        {
          firstName: "Paula",
          lastName: "Navarro",
          email: "paula.navarro@alumnos.uc3m.es",
          degree: "Ingeniería Biomédica",
          course: "1.º",
          password: "PaulaPassword2026!",
          privacyAccepted: true,
        },
        { now: currentTime },
      );
      assert.equal(reg.ok, true);

      const expiredVerificationOtp = await getLatestTestOtp(
        db,
        "paula.navarro@alumnos.uc3m.es",
        "email-verification",
        currentTime,
      );
      assert.ok(expiredVerificationOtp);

      // Advance 31 minutes -> verification token expired.
      currentTime = new Date("2026-11-19T12:31:00Z");
      assert.deepEqual(
        await verifyAccountEmail(db, authProvider, { email: "paula.navarro@alumnos.uc3m.es", otp: expiredVerificationOtp }, {
          now: currentTime,
        }),
        { ok: false, error: "expired" },
      );

      // Resend verification at new clock -> succeeds.
      await resendAccountVerification(
        db,
        authProvider,
        "paula.navarro@alumnos.uc3m.es",
      );
      const freshVerificationOtp = await getLatestTestOtp(
        db,
        "paula.navarro@alumnos.uc3m.es",
        "email-verification",
        currentTime,
      );
      assert.ok(freshVerificationOtp);
      assert.equal(
        (
          await verifyAccountEmail(db, authProvider, { email: "paula.navarro@alumnos.uc3m.es", otp: freshVerificationOtp }, {
            now: currentTime,
          })
        ).ok,
        true,
      );

      // Request reset, then advance 31 minutes -> reset token expired.
      await requestPasswordReset(
        db,
        authProvider,
        "paula.navarro@alumnos.uc3m.es",
      );
      const expiredRecoveryOtp = await getLatestTestOtp(
        db,
        "paula.navarro@alumnos.uc3m.es",
        "password-reset",
        currentTime,
      );
      assert.ok(expiredRecoveryOtp);

      currentTime = new Date("2026-11-19T13:02:00Z");
      assert.deepEqual(
        await completePasswordReset(db, authProvider, {
          email: "paula.navarro@alumnos.uc3m.es",
          otp: expiredRecoveryOtp,
          password: "NewPaulaPassword2026!",
        }),
        { ok: false, error: "invalid" },
      );
    } finally {
      await db.close();
    }
  });

  it("blocks forbidden endpoints in /api/auth/[...path] with HTTP 403 and returns 404 when unconfigured (RF-02, RF-05, CA-02)", async () => {
    const prevBaseUrl = process.env.NEON_AUTH_BASE_URL;
    const prevSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_COOKIE_SECRET;
    try {
      const blockedCases: Array<{
        handler: typeof authRoutePost;
        method: string;
        path: string[];
      }> = [
        { handler: authRoutePost, method: "POST", path: ["change-email"] },
        { handler: authRouteGet, method: "GET", path: ["change-email"] },
        { handler: authRoutePost, method: "POST", path: ["sign-up", "email"] },
        { handler: authRoutePost, method: "POST", path: ["email-otp", "change-email"] },
        { handler: authRoutePost, method: "POST", path: ["sign-in", "email-otp"] },
        { handler: authRoutePost, method: "POST", path: ["delete-user"] },
        { handler: authRouteDelete, method: "DELETE", path: ["delete-user"] },
        { handler: authRouteGet, method: "GET", path: ["admin", "list-users"] },
        { handler: authRoutePost, method: "POST", path: ["admin", "set-role"] },
        { handler: authRoutePut, method: "PUT", path: ["admin", "update-user"] },
        { handler: authRoutePatch, method: "PATCH", path: ["change-email"] },
        { handler: authRoutePost, method: "POST", path: ["..", "admin", "ban-user"] },
      ];

      for (const testCase of blockedCases) {
        const req = new Request(
          `http://127.0.0.1:3000/api/auth/${testCase.path.join("/")}`,
          { method: testCase.method },
        );
        const res = await testCase.handler(req, {
          params: Promise.resolve({ path: testCase.path }),
        });
        assert.equal(
          res.status,
          403,
          `Expected 403 for ${testCase.method} /api/auth/${testCase.path.join("/")}`,
        );
      }

      // Allowed route returns 404 when Neon Auth remote instance is not configured.
      const allowedRes = await authRouteGet(
        new Request("http://127.0.0.1:3000/api/auth/get-session", { method: "GET" }),
        { params: Promise.resolve({ path: ["get-session"] }) },
      );
      assert.equal(allowedRes.status, 404);
    } finally {
      if (prevBaseUrl === undefined) delete process.env.NEON_AUTH_BASE_URL;
      else process.env.NEON_AUTH_BASE_URL = prevBaseUrl;
      if (prevSecret === undefined) delete process.env.NEON_AUTH_COOKIE_SECRET;
      else process.env.NEON_AUTH_COOKIE_SECRET = prevSecret;
    }
  });

  it("writes verification and password-reset codes to AD_ASTRA_TEST_MAILBOX_FILE when configured", async () => {
    const db = await createTestDb();
    const tempDir = mkdtempSync(join(tmpdir(), "ad-astra-mailbox-"));
    const mailboxFile = join(tempDir, "mailbox.jsonl");
    const prevMailbox = process.env.AD_ASTRA_TEST_MAILBOX_FILE;
    process.env.AD_ASTRA_TEST_MAILBOX_FILE = mailboxFile;

    try {
      const authProvider = createTestAuthProvider(db);
      const reg = await registerAccount(db, authProvider, {
        firstName: "Buzon",
        lastName: "Pruebas",
        email: "buzon.pruebas@alumnos.uc3m.es",
        degree: "Ingeniería Aeroespacial",
        course: "2.º",
        password: "BuzonPassword2026!",
        privacyAccepted: true,
      });
      assert.equal(reg.ok, true);

      const linesAfterSignUp = readFileSync(mailboxFile, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { kind: string; email: string; otp: string });
      assert.equal(linesAfterSignUp.length, 1);
      assert.equal(linesAfterSignUp[0].kind, "email-verification");
      assert.equal(linesAfterSignUp[0].email, "buzon.pruebas@alumnos.uc3m.es");

      assert.equal(
        (await verifyAccountEmail(db, authProvider, linesAfterSignUp[0])).ok,
        true,
      );

      await requestPasswordReset(db, authProvider, "buzon.pruebas@alumnos.uc3m.es");
      const linesAfterReset = readFileSync(mailboxFile, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { kind: string; email: string; otp: string });
      assert.equal(linesAfterReset.length, 2);
      assert.equal(linesAfterReset[1].kind, "password-reset");
      assert.equal(linesAfterReset[1].email, "buzon.pruebas@alumnos.uc3m.es");
      assert.match(linesAfterReset[1].otp, /^\d{6}$/);
    } finally {
      if (prevMailbox === undefined) delete process.env.AD_ASTRA_TEST_MAILBOX_FILE;
      else process.env.AD_ASTRA_TEST_MAILBOX_FILE = prevMailbox;
      rmSync(tempDir, { recursive: true, force: true });
      await db.close();
    }
  });
});
