import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import { cookies } from "next/headers";

import { getDb, type AppDb } from "../../db/client";
import {
  TEST_SESSION_COOKIE_NAME,
  createTestAuthProvider,
  isTestAuthEnabled,
  type TestSessionCookieStore,
} from "./test-auth-provider";
import { normalizeEmail } from "./uc3m";

export type AuthProviderUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type AuthProviderSession = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: AuthProviderUser;
};

export type AuthProviderErrorCode =
  | "USER_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "WEAK_PASSWORD"
  | "PROVIDER_ERROR";

export type AuthSignUpResult =
  | { ok: true; user: AuthProviderUser; verificationRequired: boolean }
  | { ok: false; errorCode: AuthProviderErrorCode; message?: string };

export type AuthSignInResult =
  | { ok: true; user: AuthProviderUser }
  | { ok: false; errorCode: AuthProviderErrorCode; message?: string };

export type AuthVerifyEmailResult =
  | { ok: true; user: AuthProviderUser | null }
  | { ok: false; errorCode: AuthProviderErrorCode; message?: string };

export type AuthActionResult =
  | { ok: true }
  | { ok: false; errorCode: AuthProviderErrorCode; message?: string };

export interface AuthProvider {
  signUp(input: {
    email: string;
    password: string;
    name: string;
    callbackURL?: string;
  }): Promise<AuthSignUpResult>;
  signIn(input: {
    email: string;
    password: string;
  }): Promise<AuthSignInResult>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthProviderSession | null>;
  sendVerificationEmail(input: {
    email: string;
    callbackURL?: string;
  }): Promise<AuthActionResult>;
  verifyEmail(input: { token: string }): Promise<AuthVerifyEmailResult>;
  requestPasswordReset(input: {
    email: string;
    redirectTo?: string;
  }): Promise<AuthActionResult>;
  resetPassword(input: {
    token: string;
    newPassword: string;
  }): Promise<AuthActionResult>;
  revokeUserSessions(authUserId: string): Promise<void>;
  recoverUnlinkedUser?(input: {
    email: string;
    password: string;
  }): Promise<AuthProviderUser | null>;
}

type CachedNeonAuth = {
  key: string;
  instance: NeonAuth;
};

const NEON_AUTH_CACHE_SYMBOL = Symbol.for("ad-astra.community.neon-auth.cache");

type GlobalWithNeonAuth = typeof globalThis & {
  [NEON_AUTH_CACHE_SYMBOL]?: CachedNeonAuth;
};

export function isNeonAuthConfigured(): boolean {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  return Boolean(baseUrl && secret);
}

export function getNeonAuth(): NeonAuth | null {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  if (!baseUrl || !secret) {
    return null;
  }

  const key = `${baseUrl}::${secret.length}:${secret.slice(0, 8)}`;
  const globalCache = globalThis as GlobalWithNeonAuth;
  if (globalCache[NEON_AUTH_CACHE_SYMBOL]?.key === key) {
    return globalCache[NEON_AUTH_CACHE_SYMBOL].instance;
  }

  const instance = createNeonAuth({
    baseUrl,
    cookies: {
      secret,
      sameSite: "lax",
    },
  });

  globalCache[NEON_AUTH_CACHE_SYMBOL] = { key, instance };
  return instance;
}

function mapBetterAuthErrorCode(error: {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}): AuthProviderErrorCode {
  const code = (error.code ?? "").toUpperCase();
  const message = (error.message ?? "").toLowerCase();

  if (
    code.includes("USER_ALREADY_EXISTS") ||
    code.includes("ALREADY_EXISTS") ||
    message.includes("already exists")
  ) {
    return "USER_ALREADY_EXISTS";
  }
  if (
    code.includes("EMAIL_NOT_VERIFIED") ||
    message.includes("email not verified") ||
    message.includes("verify your email")
  ) {
    return "EMAIL_NOT_VERIFIED";
  }
  if (
    code.includes("INVALID_EMAIL_OR_PASSWORD") ||
    code.includes("INVALID_PASSWORD") ||
    code.includes("INVALID_CREDENTIALS") ||
    error.status === 401
  ) {
    return "INVALID_CREDENTIALS";
  }
  if (code.includes("TOKEN_EXPIRED") || message.includes("expired")) {
    return "TOKEN_EXPIRED";
  }
  if (code.includes("INVALID_TOKEN") || message.includes("invalid token")) {
    return "INVALID_TOKEN";
  }
  if (code.includes("PASSWORD_TOO_SHORT") || code.includes("WEAK_PASSWORD")) {
    return "WEAK_PASSWORD";
  }
  return "PROVIDER_ERROR";
}

function toProviderUser(raw: unknown): AuthProviderUser | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.email !== "string"
  ) {
    return null;
  }
  return {
    id: candidate.id,
    email: candidate.email,
    name:
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name
        : candidate.email,
    emailVerified: Boolean(candidate.emailVerified),
  };
}

export function createNeonAuthProvider(neonAuth: NeonAuth): AuthProvider {
  const provider: AuthProvider = {
    async signUp(input): Promise<AuthSignUpResult> {
      const result = await neonAuth.signUp.email({
        email: input.email,
        password: input.password,
        name: input.name,
        callbackURL: input.callbackURL,
      });

      if (result.error) {
        return {
          ok: false,
          errorCode: mapBetterAuthErrorCode(result.error),
          message: result.error.message,
        };
      }

      const user = toProviderUser(result.data?.user);
      if (!user) {
        return {
          ok: false,
          errorCode: "PROVIDER_ERROR",
          message: "Respuesta inesperada del proveedor de identidad.",
        };
      }

      return {
        ok: true,
        user,
        verificationRequired: !user.emailVerified,
      };
    },

    async signIn(input): Promise<AuthSignInResult> {
      const result = await neonAuth.signIn.email({
        email: input.email,
        password: input.password,
      });

      if (result.error) {
        return {
          ok: false,
          errorCode: mapBetterAuthErrorCode(result.error),
          message: result.error.message,
        };
      }

      const user = toProviderUser(result.data?.user);
      if (!user) {
        return { ok: false, errorCode: "INVALID_CREDENTIALS" };
      }

      return { ok: true, user };
    },

    async signOut(): Promise<void> {
      await neonAuth.signOut();
    },

    async getSession(): Promise<AuthProviderSession | null> {
      const result = await neonAuth.getSession({
        query: { disableCookieCache: true },
      });

      if (result.error || !result.data?.session || !result.data?.user) {
        return null;
      }

      const user = toProviderUser(result.data.user);
      if (!user) return null;

      const sessionObj = result.data.session as {
        id: string;
        userId: string;
        expiresAt: string | Date;
      };

      return {
        session: {
          id: sessionObj.id,
          userId: sessionObj.userId,
          expiresAt: new Date(sessionObj.expiresAt),
        },
        user,
      };
    },

    async sendVerificationEmail(input): Promise<AuthActionResult> {
      const result = await neonAuth.sendVerificationEmail({
        email: input.email,
        callbackURL: input.callbackURL,
      });
      if (result.error) {
        return {
          ok: false,
          errorCode: mapBetterAuthErrorCode(result.error),
          message: result.error.message,
        };
      }
      return { ok: true };
    },

    async verifyEmail(input): Promise<AuthVerifyEmailResult> {
      const result = await neonAuth.verifyEmail({
        query: { token: input.token },
      });
      if (result.error) {
        return {
          ok: false,
          errorCode: mapBetterAuthErrorCode(result.error),
          message: result.error.message,
        };
      }

      const rawData = result.data as Record<string, unknown> | null | undefined;
      const user = toProviderUser(rawData?.user);
      if (user) {
        return { ok: true, user: { ...user, emailVerified: true } };
      }

      if (rawData?.status === true) {
        const session = await provider.getSession();
        if (session?.user) {
          return {
            ok: true,
            user: { ...session.user, emailVerified: true },
          };
        }
        return { ok: true, user: null };
      }

      return { ok: false, errorCode: "INVALID_TOKEN" };
    },

    async requestPasswordReset(input): Promise<AuthActionResult> {
      const result = await neonAuth.requestPasswordReset({
        email: input.email,
        redirectTo: input.redirectTo,
      });
      if (result.error) {
        return {
          ok: false,
          errorCode: mapBetterAuthErrorCode(result.error),
          message: result.error.message,
        };
      }
      return { ok: true };
    },

    async resetPassword(input): Promise<AuthActionResult> {
      const result = await neonAuth.resetPassword({
        token: input.token,
        newPassword: input.newPassword,
      });
      if (result.error) {
        return {
          ok: false,
          errorCode: mapBetterAuthErrorCode(result.error),
          message: result.error.message,
        };
      }
      return { ok: true };
    },

    async revokeUserSessions(authUserId: string): Promise<void> {
      if (!authUserId) return;
      try {
        await neonAuth.admin.revokeUserSessions({ userId: authUserId });
      } catch {
        // Live status check in resolveCurrentUser() and verifyCard() enforces immediate revocation even if admin API is restricted.
      }
    },

    async recoverUnlinkedUser(input): Promise<AuthProviderUser | null> {
      const targetEmail = normalizeEmail(input.email);
      if (!targetEmail) return null;

      const existingSession = await provider.getSession();
      if (
        existingSession &&
        normalizeEmail(existingSession.user.email) === targetEmail
      ) {
        return existingSession.user;
      }

      const signInResult = await provider.signIn({
        email: targetEmail,
        password: input.password,
      });
      if (!signInResult.ok) {
        return null;
      }
      if (!signInResult.user.emailVerified) {
        await provider.signOut().catch(() => undefined);
      }
      return signInResult.user;
    },
  };

  return provider;
}

function createNextTestCookieStore(): TestSessionCookieStore {
  const secureCookie =
    process.env.NODE_ENV === "production" &&
    process.env.AD_ASTRA_TEST_AUTH !== "1";

  return {
    async getToken() {
      const jar = await cookies();
      return jar.get(TEST_SESSION_COOKIE_NAME)?.value ?? null;
    },
    async setToken(token, maxAgeSeconds) {
      const jar = await cookies();
      jar.set(TEST_SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        path: "/",
        maxAge: maxAgeSeconds,
      });
    },
    async clearToken() {
      const jar = await cookies();
      jar.delete(TEST_SESSION_COOKIE_NAME);
    },
  };
}

export async function getAuthProvider(db?: AppDb): Promise<AuthProvider> {
  const neonAuth = getNeonAuth();
  if (neonAuth) {
    return createNeonAuthProvider(neonAuth);
  }

  if (isTestAuthEnabled()) {
    const conn = db ?? (await getDb());
    return createTestAuthProvider(conn, {
      cookieStore: createNextTestCookieStore(),
    });
  }

  throw new Error(
    "Neon Auth no está configurado. Define NEON_AUTH_BASE_URL y NEON_AUTH_COOKIE_SECRET.",
  );
}
