import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { sql } from "drizzle-orm";

import type { AppDb, AppTransaction } from "../../db/client";
import type {
  AuthActionResult,
  AuthProvider,
  AuthProviderSession,
  AuthProviderUser,
  AuthSignInResult,
  AuthSignUpResult,
  AuthVerifyEmailResult,
} from "./neon-auth";
import { normalizeEmail } from "./uc3m";

export const TEST_SESSION_COOKIE_NAME = "ad_astra_test_session";

export type TestOtpKind = "email-verification" | "password-reset";

export interface TestSessionCookieStore {
  getToken(): Promise<string | null> | string | null;
  setToken(token: string, maxAgeSeconds: number): Promise<void> | void;
  clearToken(): Promise<void> | void;
}

export type TestAuthProviderOptions = {
  cookieStore?: TestSessionCookieStore;
  now?: () => Date;
};

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 3;
const OTP_PATTERN = /^\d{6}$/;

const initializedDbs = new WeakMap<object, Promise<void>>();

export function isTestAuthEnabled(): boolean {
  if (process.env.NEON_AUTH_BASE_URL?.trim()) {
    return false;
  }
  return Boolean(
    process.env.AD_ASTRA_TEST_AUTH === "1" || process.env.NODE_TEST_CONTEXT,
  );
}

function assertTestAuthAllowed(): void {
  if (!isTestAuthEnabled()) {
    throw new Error(
      "TestAuthProvider solo puede utilizarse en pruebas automatizadas (AD_ASTRA_TEST_AUTH=1 o NODE_TEST_CONTEXT sin NEON_AUTH_BASE_URL).",
    );
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, digestHex] = parts;
  if (!salt || !digestHex) return false;
  const expected = Buffer.from(digestHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function buildOtpIdentifier(kind: TestOtpKind, email: string): string {
  return `otp:${kind}:${email}`;
}

function createMemoryCookieStore(): TestSessionCookieStore {
  let currentToken: string | null = null;
  return {
    getToken: () => currentToken,
    setToken: (token) => {
      currentToken = token;
    },
    clearToken: () => {
      currentToken = null;
    },
  };
}

export async function ensureTestNeonAuthSchema(db: AppDb): Promise<void> {
  assertTestAuthAllowed();
  const existing = initializedDbs.get(db);
  if (existing) {
    return existing;
  }

  const initPromise = (async () => {
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS neon_auth`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS neon_auth."user" (
        id text PRIMARY KEY,
        email text NOT NULL UNIQUE,
        email_verified boolean NOT NULL DEFAULT false,
        name text NOT NULL,
        image text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS neon_auth.session (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
        token text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        ip_address text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS neon_auth.account (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
        account_id text NOT NULL,
        provider_id text NOT NULL,
        password text,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider_id, account_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS neon_auth.verification (
        id text PRIMARY KEY,
        identifier text NOT NULL,
        value text NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      ALTER TABLE neon_auth.verification ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0
    `);
  })();

  initializedDbs.set(db, initPromise);
  try {
    await initPromise;
  } catch (error) {
    initializedDbs.delete(db);
    throw error;
  }
}

export async function getLatestTestOtp(
  db: AppDb,
  email: string,
  kind: TestOtpKind,
  now: Date = new Date(),
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  await ensureTestNeonAuthSchema(db);
  const result = await db.execute<{ value: string }>(sql`
    SELECT value
    FROM neon_auth.verification
    WHERE id = ${buildOtpIdentifier(kind, normalized)}
      AND expires_at > ${now.toISOString()}::timestamptz
  `);
  return result.rows[0]?.value ?? null;
}

type DbUserRow = {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
};

type DbCredentialRow = DbUserRow & {
  password: string | null;
};

function toAuthUser(row: DbUserRow): AuthProviderUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: Boolean(row.email_verified),
  };
}

type TestOtp = { kind: TestOtpKind; email: string; otp: string; createdAt: string };

async function lockOtpUser(tx: AppTransaction, email: string): Promise<DbUserRow | undefined> {
  const result = await tx.execute<DbUserRow>(sql`
    SELECT id, email, name, email_verified
    FROM neon_auth."user"
    WHERE email = ${email}
    FOR UPDATE
  `);
  return result.rows[0];
}

async function issueOtp(
  tx: AppTransaction,
  kind: TestOtpKind,
  email: string,
  now: Date,
): Promise<TestOtp> {
  const identifier = buildOtpIdentifier(kind, email);
  const previous = await tx.execute<{ value: string }>(sql`
    SELECT value FROM neon_auth.verification WHERE id = ${identifier}
  `);
  let otp: string;
  do {
    otp = String(randomInt(1_000_000)).padStart(6, "0");
  } while (otp === previous.rows[0]?.value);

  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);
  await tx.execute(sql`
    INSERT INTO neon_auth.verification (id, identifier, value, expires_at, created_at)
    VALUES (${identifier}, ${identifier}, ${otp}, ${expiresAt.toISOString()}::timestamptz, ${createdAt}::timestamptz)
    ON CONFLICT (id) DO UPDATE
    SET value = excluded.value, attempts = 0, expires_at = excluded.expires_at, created_at = excluded.created_at
  `);
  return { kind, email, otp, createdAt };
}

async function consumeOtp(
  tx: AppTransaction,
  kind: TestOtpKind,
  email: string,
  otp: string,
  now: Date,
): Promise<AuthActionResult> {
  const identifier = buildOtpIdentifier(kind, email);
  const result = await tx.execute<{
    value: string;
    attempts: number;
    expires_at: string | Date;
  }>(sql`
    SELECT value, attempts, expires_at
    FROM neon_auth.verification WHERE id = ${identifier}
  `);
  const entry = result.rows[0];
  if (!entry) return { ok: false, errorCode: "INVALID_TOKEN" };

  if (new Date(entry.expires_at).getTime() <= now.getTime()) {
    await tx.execute(sql`DELETE FROM neon_auth.verification WHERE id = ${identifier}`);
    return { ok: false, errorCode: "TOKEN_EXPIRED" };
  }
  if (entry.value !== otp) {
    if (entry.attempts + 1 >= OTP_MAX_ATTEMPTS) {
      await tx.execute(sql`DELETE FROM neon_auth.verification WHERE id = ${identifier}`);
    } else {
      await tx.execute(sql`
        UPDATE neon_auth.verification SET attempts = attempts + 1 WHERE id = ${identifier}
      `);
    }
    return { ok: false, errorCode: "INVALID_TOKEN" };
  }

  await tx.execute(sql`DELETE FROM neon_auth.verification WHERE id = ${identifier}`);
  return { ok: true };
}

function writeTestMailbox(message: TestOtp): void {
  const mailboxFile = process.env.AD_ASTRA_TEST_MAILBOX_FILE?.trim();
  if (isTestAuthEnabled() && mailboxFile) {
    mkdirSync(dirname(mailboxFile), { recursive: true });
    appendFileSync(mailboxFile, JSON.stringify(message) + "\n", "utf8");
  }
}

async function createSession(
  tx: AppTransaction,
  userId: string,
  now: Date,
): Promise<string> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await tx.execute(sql`
    INSERT INTO neon_auth.session (id, user_id, token, expires_at, created_at)
    VALUES (${randomUUID()}, ${userId}, ${hashSessionToken(token)}, ${expiresAt.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
  `);
  return token;
}

export function createTestAuthProvider(
  db: AppDb,
  options: TestAuthProviderOptions = {},
): AuthProvider {
  assertTestAuthAllowed();
  const cookieStore = options.cookieStore ?? createMemoryCookieStore();
  const getNow = options.now ?? (() => new Date());

  async function sendOtp(emailInput: string, kind: TestOtpKind): Promise<AuthActionResult> {
    const email = normalizeEmail(emailInput);
    if (!email) return { ok: true };

    await ensureTestNeonAuthSchema(db);
    const message = await db.transaction(async (tx) => {
      const user = await lockOtpUser(tx, email);
      const expectedVerified = kind === "password-reset";
      return user?.email_verified === expectedVerified
        ? issueOtp(tx, kind, email, getNow())
        : null;
    });
    if (message) writeTestMailbox(message);
    return { ok: true };
  }

  return {
    async signUp(input): Promise<AuthSignUpResult> {
      await ensureTestNeonAuthSchema(db);
      const email = normalizeEmail(input.email);
      if (!email) {
        return {
          ok: false,
          errorCode: "PROVIDER_ERROR",
          message: "Correo electrónico no válido.",
        };
      }
      if (
        typeof input.password !== "string" ||
        input.password.length < 8 ||
        input.password.length > 128 ||
        !input.password.trim()
      ) {
        return {
          ok: false,
          errorCode: "WEAK_PASSWORD",
          message: "La contraseña debe tener entre 8 y 128 caracteres.",
        };
      }

      const existing = await db.execute<{ id: string }>(sql`
        SELECT id FROM neon_auth."user" WHERE email = ${email} LIMIT 1
      `);
      if (existing.rows.length > 0) {
        return {
          ok: false,
          errorCode: "USER_ALREADY_EXISTS",
          message: "Ya existe una cuenta con ese correo.",
        };
      }

      const userId = randomUUID();
      const accountId = randomUUID();
      const now = getNow();
      const nowIso = now.toISOString();
      const passwordHash = hashPassword(input.password);
      const name = input.name.trim() || email;

      let message: TestOtp;
      try {
        message = await db.transaction(async (tx) => {
          await tx.execute(sql`
            INSERT INTO neon_auth."user" (id, email, email_verified, name, created_at, updated_at)
            VALUES (${userId}, ${email}, false, ${name}, ${nowIso}::timestamptz, ${nowIso}::timestamptz)
          `);
          await tx.execute(sql`
            INSERT INTO neon_auth.account (id, user_id, account_id, provider_id, password, created_at)
            VALUES (${accountId}, ${userId}, ${userId}, 'credential', ${passwordHash}, ${nowIso}::timestamptz)
          `);
          return issueOtp(tx, "email-verification", email, now);
        });
      } catch (error) {
        const cause = error instanceof Error ? error.cause ?? error : error;
        if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") {
          return {
            ok: false,
            errorCode: "USER_ALREADY_EXISTS",
            message: "Ya existe una cuenta con ese correo.",
          };
        }
        throw error;
      }
      writeTestMailbox(message);

      return {
        ok: true,
        user: {
          id: userId,
          email,
          name,
          emailVerified: false,
        },
        verificationRequired: true,
      };
    },

    sendVerificationOtp({ email }) {
      return sendOtp(email, "email-verification");
    },

    async verifyEmailOtp(input): Promise<AuthVerifyEmailResult> {
      const email = normalizeEmail(input.email);
      if (!email || !OTP_PATTERN.test(input.otp)) {
        return { ok: false, errorCode: "INVALID_TOKEN" };
      }

      await ensureTestNeonAuthSchema(db);
      const now = getNow();
      const result = await db.transaction(async (tx) => {
        const user = await lockOtpUser(tx, email);
        if (!user) return { ok: false, errorCode: "INVALID_TOKEN" } as const;

        const consumed = await consumeOtp(tx, "email-verification", email, input.otp, now);
        if (!consumed.ok) return consumed;

        await tx.execute(sql`
          UPDATE neon_auth."user"
          SET email_verified = true, updated_at = ${now.toISOString()}::timestamptz
          WHERE id = ${user.id}
        `);
        const sessionToken = await createSession(tx, user.id, now);
        return {
          ok: true,
          user: toAuthUser({ ...user, email_verified: true }),
          sessionToken,
        } as const;
      });
      if (!result.ok) return result;

      await cookieStore.setToken(result.sessionToken, SESSION_TTL_SECONDS);
      return { ok: true, user: result.user };
    },

    async signIn(input): Promise<AuthSignInResult> {
      await ensureTestNeonAuthSchema(db);
      const email = normalizeEmail(input.email);
      if (!email || !input.password) {
        return { ok: false, errorCode: "INVALID_CREDENTIALS" };
      }

      const result = await db.transaction(async (tx) => {
        const row = await lockOtpUser(tx, email);
        if (!row) return { ok: false, errorCode: "INVALID_CREDENTIALS" } as const;

        const credentials = await tx.execute<{ password: string | null }>(sql`
          SELECT password
          FROM neon_auth.account
          WHERE user_id = ${row.id} AND provider_id = 'credential'
        `);
        const password = credentials.rows[0]?.password;
        if (!password || !verifyPassword(input.password, password)) {
          return { ok: false, errorCode: "INVALID_CREDENTIALS" } as const;
        }
        if (!row.email_verified) {
          return { ok: false, errorCode: "EMAIL_NOT_VERIFIED" } as const;
        }

        const sessionToken = await createSession(tx, row.id, getNow());
        return { ok: true, user: toAuthUser(row), sessionToken } as const;
      });
      if (!result.ok) return result;

      await cookieStore.setToken(result.sessionToken, SESSION_TTL_SECONDS);
      return { ok: true, user: result.user };
    },

    async signOut(): Promise<void> {
      await ensureTestNeonAuthSchema(db);
      const rawToken = await cookieStore.getToken();
      if (rawToken) {
        const hashed = hashSessionToken(rawToken);
        await db.execute(sql`
          DELETE FROM neon_auth.session WHERE token = ${hashed}
        `);
      }
      await cookieStore.clearToken();
    },

    async getSession(): Promise<AuthProviderSession | null> {
      await ensureTestNeonAuthSchema(db);
      const rawToken = await cookieStore.getToken();
      if (!rawToken) return null;

      const hashed = hashSessionToken(rawToken);
      const now = getNow();
      const nowIso = now.toISOString();
      const result = await db.execute<{
        session_id: string;
        user_id: string;
        expires_at: string | Date;
        email: string;
        name: string;
        email_verified: boolean;
      }>(sql`
        SELECT
          s.id AS session_id,
          s.user_id,
          s.expires_at,
          u.email,
          u.name,
          u.email_verified
        FROM neon_auth.session s
        JOIN neon_auth."user" u ON u.id = s.user_id
        WHERE s.token = ${hashed}
          AND s.expires_at > ${nowIso}::timestamptz
        LIMIT 1
      `);

      const row = result.rows[0];
      if (!row) return null;

      return {
        session: {
          id: row.session_id,
          userId: row.user_id,
          expiresAt: new Date(row.expires_at),
        },
        user: {
          id: row.user_id,
          email: row.email,
          name: row.name,
          emailVerified: Boolean(row.email_verified),
        },
      };
    },

    requestPasswordResetOtp({ email }) {
      return sendOtp(email, "password-reset");
    },

    async resetPasswordWithOtp(input): Promise<AuthActionResult> {
      const email = normalizeEmail(input.email);
      if (!email || !OTP_PATTERN.test(input.otp)) {
        return { ok: false, errorCode: "INVALID_TOKEN" };
      }
      if (
        typeof input.newPassword !== "string" ||
        input.newPassword.length < 8 ||
        input.newPassword.length > 128 ||
        !input.newPassword.trim()
      ) {
        return { ok: false, errorCode: "WEAK_PASSWORD" };
      }

      await ensureTestNeonAuthSchema(db);
      return db.transaction(async (tx) => {
        const user = await lockOtpUser(tx, email);
        if (!user?.email_verified) return { ok: false, errorCode: "INVALID_TOKEN" };

        const consumed = await consumeOtp(tx, "password-reset", email, input.otp, getNow());
        if (!consumed.ok) return consumed;

        const newHash = hashPassword(input.newPassword);
        await tx.execute(sql`
          UPDATE neon_auth.account
          SET password = ${newHash}
          WHERE user_id = ${user.id} AND provider_id = 'credential'
        `);
        await tx.execute(sql`
          DELETE FROM neon_auth.session WHERE user_id = ${user.id}
        `);
        return { ok: true };
      });
    },

    async revokeUserSessions(authUserId: string): Promise<void> {
      await ensureTestNeonAuthSchema(db);
      if (!authUserId) return;
      await db.execute(sql`
        DELETE FROM neon_auth.session WHERE user_id = ${authUserId}
      `);
    },

    async recoverUnlinkedUser(input): Promise<AuthProviderUser | null> {
      await ensureTestNeonAuthSchema(db);
      const email = normalizeEmail(input.email);
      if (!email || !input.password) return null;

      const result = await db.execute<DbCredentialRow>(sql`
        SELECT u.id, u.email, u.name, u.email_verified, a.password
        FROM neon_auth."user" u
        JOIN neon_auth.account a
          ON a.user_id = u.id AND a.provider_id = 'credential'
        WHERE u.email = ${email}
        LIMIT 1
      `);

      const row = result.rows[0];
      if (!row || !row.password || !verifyPassword(input.password, row.password)) {
        return null;
      }

      return toAuthUser(row);
    },
  };
}
