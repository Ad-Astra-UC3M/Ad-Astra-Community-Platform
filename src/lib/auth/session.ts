import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "../../db/client";
import {
  CAPABILITY_CODES,
  type AccountStatus,
  type CapabilityCode,
} from "../../db/schema";
import {
  PRIVACY_VERSION,
  authenticateAccount,
  completePasswordReset,
  isCapabilityCode,
  registerAccount,
  requestPasswordReset,
  resendAccountVerification,
  resolveCurrentUser,
  verifyAccountEmail,
  type AuthUser,
  type VerifyAccountEmailResult,
} from "../../server/auth/service";
import { getAuthProvider } from "./neon-auth";
import { isUc3mEmail, normalizeEmail, sanitizeNextPath } from "./uc3m";

export {
  CAPABILITY_CODES,
  PRIVACY_VERSION,
  isCapabilityCode,
  isUc3mEmail,
  normalizeEmail,
  sanitizeNextPath,
  type AccountStatus,
  type AuthUser,
  type CapabilityCode,
};

function getAppOrigin(): string {
  return (
    process.env.APP_ORIGIN?.trim().replace(/\/+$/, "") ||
    "https://comunidad.adastrauc3m.es"
  );
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function currentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  if (jar.getAll().length === 0) {
    return null;
  }
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  return resolveCurrentUser(db, authProvider);
}

export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await currentUser();
  if (!user) {
    redirect(
      nextPath
        ? "/sign-in?next=" +
            encodeURIComponent(sanitizeNextPath(nextPath, "/home"))
        : "/sign-in",
    );
  }
  return user;
}

export async function revokeUserSessions(authUserId: string): Promise<void> {
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await authProvider.revokeUserSessions(authUserId);
}

export async function signUp(formData: FormData): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const result = await registerAccount(
    db,
    authProvider,
    {
      firstName: readFormString(formData, "firstName"),
      lastName: readFormString(formData, "lastName"),
      email: readFormString(formData, "email"),
      degree: readFormString(formData, "degree"),
      course: readFormString(formData, "course"),
      academicLevel: readFormString(formData, "academicLevel") || null,
      languageModality: readFormString(formData, "languageModality") || null,
      password: readFormString(formData, "password"),
      privacyAccepted: formData.get("privacy") === "accepted",
    },
    { callbackURL: `${getAppOrigin()}/verify-email` },
  );

  if (!result.ok) {
    redirect("/sign-up?error=" + encodeURIComponent(result.error));
  }

  redirect("/verify-email?sent=1");
}

export async function signIn(formData: FormData): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const result = await authenticateAccount(
    db,
    authProvider,
    readFormString(formData, "email"),
    readFormString(formData, "password"),
  );

  const rawNext = readFormString(formData, "next").trim();
  const preservedNext =
    rawNext && sanitizeNextPath(rawNext, "/home") === rawNext ? rawNext : null;

  if (!result.ok) {
    const errorParam = encodeURIComponent(result.error);
    redirect(
      preservedNext
        ? `/sign-in?error=${errorParam}&next=${encodeURIComponent(preservedNext)}`
        : `/sign-in?error=${errorParam}`,
    );
  }

  const defaultPath = result.user.capabilities.length > 0 ? "/admin" : "/home";
  redirect(sanitizeNextPath(rawNext, defaultPath));
}

export async function signOut(): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await authProvider.signOut();
  redirect("/");
}

export async function verifyEmailByToken(
  token: string,
): Promise<VerifyAccountEmailResult> {
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  return verifyAccountEmail(db, authProvider, token);
}

export async function resendVerificationAction(
  formData: FormData,
): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await resendAccountVerification(
    db,
    authProvider,
    readFormString(formData, "email"),
    { callbackURL: `${getAppOrigin()}/verify-email` },
  );
  redirect("/verify-email?resent=1");
}

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await requestPasswordReset(
    db,
    authProvider,
    readFormString(formData, "email"),
    { redirectTo: `${getAppOrigin()}/reset-password` },
  );
  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(formData: FormData): Promise<never> {
  "use server";

  const token = readFormString(formData, "token").trim();
  const password = readFormString(formData, "password");
  const confirmPassword = formData.has("confirmPassword")
    ? readFormString(formData, "confirmPassword")
    : undefined;

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const result = await completePasswordReset(db, authProvider, {
    token,
    password,
    confirmPassword,
  });

  if (!result.ok) {
    if (
      token &&
      (result.error === "password" || result.error === "mismatch")
    ) {
      redirect(
        `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.error)}`,
      );
    }
    redirect("/reset-password?error=" + encodeURIComponent(result.error));
  }

  await authProvider.signOut().catch(() => undefined);
  redirect("/sign-in?reset=ok");
}
