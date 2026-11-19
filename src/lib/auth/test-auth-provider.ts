import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { sql } from "drizzle-orm";

import type { AppDb } from "../../db/client";
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

export type TestTokenKind = "email-verification" | "password-reset";

export interface TestSessionCookieStore {
  getToken(): Promise<string | null> | string | null;
  setToken(token: string, maxAgeSeconds: number): Promise<void> | void;
  clearToken(): Promise<void> | void;
}

export type TestAuthProviderOptions = {
  cookieStore?: TestSessionCookieStore;
  now?: () => Date;
};

export type TestAuthProvider = AuthProvider & {
  resendVerification(input: {
    email: string;
    callbackURL?: string;
  }): Promise<AuthActionResult>;
};

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const VERIFICATION_TTL_SECONDS = 30 * 60;
const RESET_TTL_SECONDS = 30 * 60;

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

function buildVerificationIdentifier(kind: TestTokenKind, email: string): string {
  return `${kind}:${email}`;
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
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
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

export async function getLatestTestToken(
  db: AppDb,
  identifier: string,
  kind: TestTokenKind,
  now: Date = new Date(),
): Promise<string | null> {
  assertTestAuthAllowed();
  await ensureTestNeonAuthSchema(db);

  const normalized = identifier.trim().toLowerCase();
  const lookupKey = normalized.startsWith(`${kind}:`)
    ? normalized
    : buildVerificationIdentifier(kind, normalized);

  const result = await db.execute<{ value: string }>(sql`
    SELECT value
    FROM neon_auth.verification
    WHERE identifier = ${lookupKey}
      AND expires_at > ${now.toISOString()}::timestamptz
    ORDER BY created_at DESC, id DESC
    LIMIT 1
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

export function createTestAuthProvider(
  db: AppDb,
  options: TestAuthProviderOptions = {},
): TestAuthProvider {
  assertTestAuthAllowed();
  const cookieStore = options.cookieStore ?? createMemoryCookieStore();
  const getNow = options.now ?? (() => new Date());

  async function issueVerificationToken(
    kind: TestTokenKind,
    email: string,
    ttlSeconds: number,
  ): Promise<string> {
    const identifier = buildVerificationIdentifier(kind, email);
    const token = generateOpaqueToken();
    const now = getNow();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    await db.execute(sql`
      DELETE FROM neon_auth.verification
      WHERE identifier = ${identifier}
    `);

    await db.execute(sql`
      INSERT INTO neon_auth.verification (id, identifier, value, expires_at, created_at)
      VALUES (${randomUUID()}, ${identifier}, ${token}, ${expiresAt.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
    `);

    return token;
  }

  async function sendVerificationEmail(input: {
    email: string;
    callbackURL?: string;
  }): Promise<AuthActionResult> {
    await ensureTestNeonAuthSchema(db);
    const email = normalizeEmail(input.email);
    if (!email) {
      return { ok: true };
    }

    const userResult = await db.execute<DbUserRow>(sql`
      SELECT id, email, name, email_verified
      FROM neon_auth."user"
      WHERE email = ${email}
      LIMIT 1
    `);
    const user = userResult.rows[0];
    if (!user || user.email_verified) {
      return { ok: true };
    }

    await issueVerificationToken(
      "email-verification",
      email,
      VERIFICATION_TTL_SECONDS,
    );
    return { ok: true };
  }

  const provider: TestAuthProvider = {
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
      const nowIso = getNow().toISOString();
      const passwordHash = hashPassword(input.password);
      const name = input.name.trim() || email;

      try {
        await db.execute(sql`
          INSERT INTO neon_auth."user" (id, email, email_verified, name, created_at, updated_at)
          VALUES (${userId}, ${email}, false, ${name}, ${nowIso}::timestamptz, ${nowIso}::timestamptz)
        `);
        await db.execute(sql`
          INSERT INTO neon_auth.account (id, user_id, account_id, provider_id, password, created_at)
          VALUES (${accountId}, ${userId}, ${userId}, 'credential', ${passwordHash}, ${nowIso}::timestamptz)
        `);
      } catch (error) {
        const pgCode =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if (pgCode === "23505") {
          return {
            ok: false,
            errorCode: "USER_ALREADY_EXISTS",
            message: "Ya existe una cuenta con ese correo.",
          };
        }
        throw error;
      }

      await issueVerificationToken(
        "email-verification",
        email,
        VERIFICATION_TTL_SECONDS,
      );

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

    async verifyEmail(input): Promise<AuthVerifyEmailResult> {
      await ensureTestNeonAuthSchema(db);
      const token = input.token.trim();
      if (!token) {
        return { ok: false, errorCode: "INVALID_TOKEN" };
      }

      const nowIso = getNow().toISOString();
      const consumed = await db.execute<{
        identifier: string;
        expires_at: string | Date;
      }>(sql`
        DELETE FROM neon_auth.verification
        WHERE value = ${token}
          AND identifier LIKE 'email-verification:%'
        RETURNING identifier, expires_at
      `);

      const row = consumed.rows[0];
      if (!row) {
        return { ok: false, errorCode: "INVALID_TOKEN" };
      }

      const expiresAt = new Date(row.expires_at);
      if (expiresAt.getTime() <= getNow().getTime()) {
        return { ok: false, errorCode: "TOKEN_EXPIRED" };
      }

      const email = row.identifier.slice("email-verification:".length);
      const updated = await db.execute<DbUserRow>(sql`
        UPDATE neon_auth."user"
        SET email_verified = true, updated_at = ${nowIso}::timestamptz
        WHERE email = ${email}
        RETURNING id, email, name, email_verified
      `);

      const userRow = updated.rows[0];
      if (!userRow) {
        return { ok: false, errorCode: "INVALID_TOKEN" };
      }

      return { ok: true, user: toAuthUser(userRow) };
    },

    sendVerificationEmail,
    resendVerification: sendVerificationEmail,

    async signIn(input): Promise<AuthSignInResult> {
      await ensureTestNeonAuthSchema(db);
      const email = normalizeEmail(input.email);
      if (!email || !input.password) {
        return { ok: false, errorCode: "INVALID_CREDENTIALS" };
      }

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
        return { ok: false, errorCode: "INVALID_CREDENTIALS" };
      }

      if (!row.email_verified) {
        return { ok: false, errorCode: "EMAIL_NOT_VERIFIED" };
      }

      const now = getNow();
      const rawSessionToken = generateOpaqueToken();
      const hashedToken = hashSessionToken(rawSessionToken);
      const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

      await db.execute(sql`
        INSERT INTO neon_auth.session (id, user_id, token, expires_at, created_at)
        VALUES (${randomUUID()}, ${row.id}, ${hashedToken}, ${expiresAt.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)
      `);

      await cookieStore.setToken(rawSessionToken, SESSION_TTL_SECONDS);

      return { ok: true, user: toAuthUser(row) };
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
      const nowIso = getNow().toISOString();
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

    async requestPasswordReset(input): Promise<AuthActionResult> {
      await ensureTestNeonAuthSchema(db);
      const email = normalizeEmail(input.email);
      if (!email) {
        return { ok: true };
      }

      const result = await db.execute<DbUserRow>(sql`
        SELECT id, email, name, email_verified
        FROM neon_auth."user"
        WHERE email = ${email}
        LIMIT 1
      `);
      const user = result.rows[0];
      if (!user || !user.email_verified) {
        return { ok: true };
      }

      await issueVerificationToken("password-reset", email, RESET_TTL_SECONDS);
      return { ok: true };
    },

    async resetPassword(input): Promise<AuthActionResult> {
      await ensureTestNeonAuthSchema(db);
      const token = input.token.trim();
      if (!token) {
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

      const consumed = await db.execute<{
        identifier: string;
        expires_at: string | Date;
      }>(sql`
        DELETE FROM neon_auth.verification
        WHERE value = ${token}
          AND identifier LIKE 'password-reset:%'
        RETURNING identifier, expires_at
      `);

      const row = consumed.rows[0];
      if (!row) {
        return { ok: false, errorCode: "INVALID_TOKEN" };
      }

      const expiresAt = new Date(row.expires_at);
      if (expiresAt.getTime() <= getNow().getTime()) {
        return { ok: false, errorCode: "TOKEN_EXPIRED" };
      }

      const email = row.identifier.slice("password-reset:".length);
      const userResult = await db.execute<{ id: string }>(sql`
        SELECT id FROM neon_auth."user" WHERE email = ${email} LIMIT 1
      `);
      const user = userResult.rows[0];
      if (!user) {
        return { ok: false, errorCode: "INVALID_TOKEN" };
      }

      const newHash = hashPassword(input.newPassword);
      await db.execute(sql`
        UPDATE neon_auth.account
        SET password = ${newHash}
        WHERE user_id = ${user.id} AND provider_id = 'credential'
      `);

      // Revoke every active session for this user across all devices.
      await db.execute(sql`
        DELETE FROM neon_auth.session WHERE user_id = ${user.id}
      `);
      await cookieStore.clearToken();

      return { ok: true };
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

  return provider;
}
