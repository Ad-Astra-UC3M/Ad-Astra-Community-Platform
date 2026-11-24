/**
 * @file Adaptador de Better Auth gestionado por Neon. El servicio consume un contrato propio para aislar
 * las diferencias del SDK. Alta y OTP entran por Server Actions. Los métodos de recuperación reutilizan el
 * handler del SDK dentro del servidor.
 */

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
  | { ok: true; user: AuthProviderUser; sessionCreated: boolean }
  | { ok: false; errorCode: AuthProviderErrorCode; message?: string };

export type AuthActionResult =
  | { ok: true }
  | { ok: false; errorCode: AuthProviderErrorCode; message?: string };

/** Punto de integración que consume service.ts. Neon y PGlite implementan estas operaciones. */
export interface AuthProvider {
  signUp(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthSignUpResult>;
  signIn(input: {
    email: string;
    password: string;
  }): Promise<AuthSignInResult>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthProviderSession | null>;
  sendVerificationOtp(input: { email: string }): Promise<AuthActionResult>;
  verifyEmailOtp(input: {
    email: string;
    otp: string;
  }): Promise<AuthVerifyEmailResult>;
  requestPasswordResetOtp(input: { email: string }): Promise<AuthActionResult>;
  resetPasswordWithOtp(input: {
    email: string;
    otp: string;
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

/**
 * Obtiene o construye la instancia del SDK para getAuthProvider. Reutilizarla mantiene una configuración
 * coherente de cookies.
 *
 * @returns Instancia asociada a la URL de la rama o null si faltan las variables.
 */
function getNeonAuth(): NeonAuth | null {
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

type BetterAuthError = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
};

/**
 * Adapta los errores del SDK a los códigos que maneja el servicio.
 *
 * @param error - Código, mensaje y estado de Neon que se clasifican.
 * @returns Código estable de AuthProviderErrorCode.
 */
function mapBetterAuthErrorCode(error: BetterAuthError): AuthProviderErrorCode {
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
    code === "OTP_EXPIRED" ||
    code.includes("TOKEN_EXPIRED") ||
    message.includes("expired")
  ) {
    return "TOKEN_EXPIRED";
  }
  if (
    code === "INVALID_OTP" ||
    code === "TOO_MANY_ATTEMPTS" ||
    code.includes("INVALID_TOKEN") ||
    message.includes("invalid token")
  ) {
    return "INVALID_TOKEN";
  }
  if (
    code.includes("INVALID_EMAIL_OR_PASSWORD") ||
    code.includes("INVALID_PASSWORD") ||
    code.includes("INVALID_CREDENTIALS") ||
    error.status === 401
  ) {
    return "INVALID_CREDENTIALS";
  }
  if (
    code === "PASSWORD_TOO_LONG" ||
    code.includes("PASSWORD_TOO_SHORT") ||
    code.includes("WEAK_PASSWORD")
  ) {
    return "WEAK_PASSWORD";
  }
  return "PROVIDER_ERROR";
}

/**
 * Construye la respuesta de error que comparten los métodos OTP.
 *
 * @param error - Error opcional del proveedor. Cuando falta se usa un fallo genérico.
 * @returns Resultado de fallo con código de Comunidad.
 */
function otpFailure(
  error?: BetterAuthError | null,
): Extract<AuthActionResult, { ok: false }> {
  return { ok: false, errorCode: error ? mapBetterAuthErrorCode(error) : "PROVIDER_ERROR" };
}

/**
 * Normaliza las identidades que devuelven alta, acceso, sesión y verificación.
 *
 * @param raw - Respuesta del SDK que se comprueba antes de leer sus propiedades.
 * @returns Identidad compatible con AuthProviderUser o null.
 */
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
    emailVerified: candidate.emailVerified === true,
  };
}

/**
 * Llama en memoria al handler del SDK para las rutas de recuperación OTP que ofrece Neon. La versión del
 * SDK instalada carece del helper de solicitud y su helper de confirmación usa otra ruta.
 *
 * @param neonAuth - Instancia configurada con la rama y las opciones de sesión.
 * @param action - Operación fija, solicitar código o confirmar contraseña.
 * @param body - Correo y, cuando se confirma, código y contraseña nueva.
 * @returns Resultado normalizado de la operación remota.
 */
async function postPasswordOtp(
  neonAuth: NeonAuth,
  action: "request-password-reset" | "reset-password",
  body: { email: string; otp?: string; password?: string },
): Promise<AuthActionResult> {
  // The server SDK lacks the request helper and routes its reset helper to
  // /email-otp/passcode. The SDK proxy can forward the supported paths.
  const origin = process.env.APP_ORIGIN?.trim() || "https://comunidad.adastrauc3m.es";
  const path = ["email-otp", action];
  const request = new Request(new URL("/api/auth/" + path.join("/"), origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await neonAuth.handler().POST(request, {
    params: Promise.resolve({ path }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return otpFailure({
      status: response.status,
      code: typeof data?.code === "string" ? data.code : undefined,
      message: typeof data?.message === "string" ? data.message : undefined,
    });
  }
  return data?.success === true ? { ok: true } : otpFailure();
}

/**
 * Lee la sesión remota sin escribir cookies durante el render de un Server Component.
 * El getSession del SDK de Next intenta aplicar Set-Cookie y falla en RootLayout. Su handler
 * en memoria devuelve una Response, sin tocar cookies() de Next. Desactivamos caché y renovación
 * para comprobar revocaciones en Neon y mantener esta consulta como lectura de la sesión.
 * Las escrituras de cookie de inicio/cierre de sesión siguen en sus Server Actions.
 *
 * @param neonAuth Instancia configurada del SDK usada por createNeonAuthProvider.
 * @param cookieHeader Cookies entrantes de la petición; solo se entregan al handler de Neon.
 * @returns Sesión e identidad normalizadas, o null si no hay una sesión válida.
 */
export async function readNeonSession(neonAuth: NeonAuth, cookieHeader: string): Promise<AuthProviderSession | null> {
  if (!cookieHeader) return null;
  const origin = process.env.APP_ORIGIN?.trim() || "https://comunidad.adastrauc3m.es";
  const url = new URL("/api/auth/get-session", origin);
  url.searchParams.set("disableCookieCache", "true");
  url.searchParams.set("disableRefresh", "true");
  const response = await neonAuth.handler().GET(new Request(url, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  }), { params: Promise.resolve({ path: ["get-session"] }) });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const user = toProviderUser(data?.user);
  const session = data?.session;
  if (!user || typeof session?.id !== "string" || typeof session?.userId !== "string") return null;
  const expiresAt = new Date(session.expiresAt);
  if (!Number.isFinite(expiresAt.getTime())) return null;
  return { session: { id: session.id, userId: session.userId, expiresAt }, user };
}

/**
 * Construye el adaptador que comparten el servicio y las pruebas de transporte.
 *
 * @param neonAuth - Instancia de Neon Auth que ejecuta la operación y gestiona la sesión.
 * @returns Métodos del contrato AuthProvider.
 */
export function createNeonAuthProvider(neonAuth: NeonAuth): AuthProvider {
  const provider: AuthProvider = {
    /**
     * Crea la identidad con Neon para registerAccount. La configuración de rama envía el OTP al usuario
     * pendiente.
     *
     * @param input - Nombre, correo y contraseña que entrega el servicio de alta.
     * @returns Identidad y estado de verificación, o error normalizado.
     */
    async signUp(input): Promise<AuthSignUpResult> {
      const result = await neonAuth.signUp.email({
        email: input.email,
        password: input.password,
        name: input.name,
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

    /**
     * Inicia sesión de correo y contraseña con el SDK. authenticateAccount comprueba después el vínculo
     * local.
     *
     * @param input - Correo y contraseña que se entregan al proveedor.
     * @returns Identidad autenticada o error de acceso.
     */
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

    /**
     * Solicita al SDK terminar la sesión de la petición. Lo usan las acciones de salida y recuperación.
     */
    async signOut(): Promise<void> {
      await neonAuth.signOut();
    },

    /**
     * Recupera la sesión mediante la lectura sin efectos de readNeonSession, válida también en layouts.
     *
     * @returns Sesión e identidad normalizadas o null.
     */
    async getSession(): Promise<AuthProviderSession | null> {
      return readNeonSession(neonAuth, (await cookies()).toString());
    },

    /**
     * Envía un nuevo OTP de verificación a petición del servicio de alta.
     *
     * @param email - Dirección que Neon usa para localizar la identidad y entregar el código.
     * @returns Respuesta normalizada del envío.
     */
    async sendVerificationOtp({ email }): Promise<AuthActionResult> {
      const result = await neonAuth.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      return !result.error && result.data?.success === true
        ? { ok: true }
        : otpFailure(result.error);
    },

    /**
     * Comprueba con Neon el código de alta y la identidad verificada. El resultado indica si Neon creó
     * sesión en esta petición para que la acción pueda navegar sin releer una cookie entrante.
     *
     * @param email - Correo al que estaba vinculado el desafío.
     * @param otp - Código que se debe verificar y consumir.
     * @returns Identidad comprobada y estado de creación de sesión, o fallo.
     */
    async verifyEmailOtp({ email, otp }): Promise<AuthVerifyEmailResult> {
      const targetEmail = normalizeEmail(email);
      if (!targetEmail) return { ok: false, errorCode: "INVALID_TOKEN" };

      const result = await neonAuth.emailOtp.verifyEmail({ email: targetEmail, otp });
      if (result.error) return otpFailure(result.error);

      const user = toProviderUser(result.data?.user);
      if (
        result.data?.status !== true ||
        !user?.emailVerified ||
        normalizeEmail(user.email) !== targetEmail
      ) {
        return otpFailure();
      }
      const token = result.data.token;
      return {
        ok: true,
        user,
        sessionCreated: typeof token === "string" && token.trim().length > 0,
      };
    },

    /**
     * Delega en postPasswordOtp para emitir un código de recuperación.
     *
     * @param email - Identidad que recibirá el correo de recuperación.
     * @returns Resultado de la solicitud.
     */
    requestPasswordResetOtp({ email }): Promise<AuthActionResult> {
      return postPasswordOtp(neonAuth, "request-password-reset", { email });
    },

    /**
     * Delega en postPasswordOtp para consumir el código y actualizar la contraseña.
     *
     * @param email - Identidad que se recupera.
     * @param otp - Código de recuperación para ese correo.
     * @param newPassword - Contraseña nueva que se manda al proveedor.
     * @returns Resultado de la confirmación.
     */
    resetPasswordWithOtp({ email, otp, newPassword }): Promise<AuthActionResult> {
      return postPasswordOtp(neonAuth, "reset-password", {
        email,
        otp,
        password: newPassword,
      });
    },

    /**
     * Solicita al proveedor cerrar las sesiones de una identidad desactivada. Los módulos protegidos
     * consultan también el estado local.
     *
     * @param authUserId - Identificador de Neon cuyas sesiones se revocan.
     */
    async revokeUserSessions(authUserId: string): Promise<void> {
      if (!authUserId) return;
      try {
        await neonAuth.admin.revokeUserSessions({ userId: authUserId });
      } catch {
        // Live status check in resolveCurrentUser() and verifyCard() enforces immediate revocation even if admin API is restricted.
      }
    },

    /**
     * Recupera para registerAccount una identidad ya creada en Neon. Si su correo coincide con el de
     * la sesión actual, devuelve esa identidad. Si no coincide o falta la sesión, verifica las credenciales.
     *
     * @param input - Correo que se quiere vincular y contraseña para el acceso cuando no hay una sesión
     * del mismo correo.
     * @returns Identidad concordante o null.
     */
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

/**
 * Adapta cookies() al proveedor de pruebas del navegador. getAuthProvider lo crea solo en el entorno de
 * pruebas.
 *
 * @returns Almacén que lee, escribe y borra la cookie de la petición.
 */
function createNextTestCookieStore(): TestSessionCookieStore {
  const secureCookie =
    process.env.NODE_ENV === "production" &&
    process.env.AD_ASTRA_TEST_AUTH !== "1";

  return {
    /**
     * Lee el token de prueba de las cookies de la petición actual.
     *
     * @returns Token de prueba o null.
     */
    async getToken() {
      const jar = await cookies();
      return jar.get(TEST_SESSION_COOKIE_NAME)?.value ?? null;
    },
    /**
     * Guarda la sesión de prueba en una cookie que utiliza Playwright a través de Next.js.
     *
     * @param token - Token de sesión de prueba que el navegador devuelve al servidor.
     * @param maxAgeSeconds - Segundos durante los que debe conservarse.
     */
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
    /**
     * Elimina la cookie de sesión de prueba al salir.
     */
    async clearToken() {
      const jar = await cookies();
      jar.delete(TEST_SESSION_COOKIE_NAME);
    },
  };
}

/**
 * Selecciona el adaptador real o el de pruebas que reciben las acciones y los controles de acceso.
 *
 * @param db - Conexión opcional para el proveedor de pruebas. Si falta, se obtiene con getDb.
 * @returns AuthProvider listo para usar. Lanza un error si no se configuró Neon y no es una prueba.
 */
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
