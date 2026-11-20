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
} from "../../server/auth/service";
import { getAuthProvider } from "./neon-auth";
import {
  isUc3mEmail,
  normalizeEmail,
  normalizeUc3mEmail,
  sanitizeNextPath,
} from "./uc3m";

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

const accountCodeCookies = {
  verification: { name: "ada-verification-email", path: "/verify-email" },
  recovery: { name: "ada-recovery-email", path: "/reset-password" },
};

type AccountCodeFlow = keyof typeof accountCodeCookies;

export async function readAccountCodeEmail(flow: AccountCodeFlow): Promise<string> {
  const jar = await cookies();
  return normalizeUc3mEmail(jar.get(accountCodeCookies[flow].name)?.value) ?? "";
}

async function setAccountCodeEmail(flow: AccountCodeFlow, rawEmail: string): Promise<void> {
  const email = normalizeUc3mEmail(rawEmail);
  const jar = await cookies();
  jar.set({
    ...accountCodeCookies[flow],
    value: email ?? "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: email ? 10 * 60 : 0,
  });
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readOptionalNextPath(value: unknown): string {
  if (typeof value !== "string") return "";
  const path = value.trim();
  return sanitizeNextPath(path) === path ? path : "";
}

function redirectWithNext(
  path: string,
  params: Record<string, string>,
  next?: string,
): never {
  const query = new URLSearchParams(params);
  const safeNext = readOptionalNextPath(next);
  if (safeNext) query.set("next", safeNext);
  redirect(path + "?" + query.toString());
}

function accountDestination(user: AuthUser, next: string): string {
  return next || (user.capabilities.length > 0 ? "/admin" : "/home");
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
  const result = await registerAccount(db, authProvider, {
    firstName: readFormString(formData, "firstName"),
    lastName: readFormString(formData, "lastName"),
    email: readFormString(formData, "email"),
    degree: readFormString(formData, "degree"),
    course: readFormString(formData, "course"),
    academicLevel: readFormString(formData, "academicLevel") || null,
    languageModality: readFormString(formData, "languageModality") || null,
    password: readFormString(formData, "password"),
    privacyAccepted: formData.get("privacy") === "accepted",
  });

  if (!result.ok) {
    redirect("/sign-up?error=" + encodeURIComponent(result.error));
  }
  if (!result.verificationRequired) {
    redirect("/sign-in");
  }

  await setAccountCodeEmail("verification", result.email);
  redirectWithNext("/verify-email", { sent: "1" });
}

export async function signIn(formData: FormData): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  const result = await authenticateAccount(
    db,
    authProvider,
    email,
    readFormString(formData, "password"),
  );
  const next = readOptionalNextPath(readFormString(formData, "next"));

  if (!result.ok) {
    if (result.error === "unverified") {
      await setAccountCodeEmail("verification", email);
      redirectWithNext("/verify-email", { pending: "1" }, next);
    }

    redirectWithNext("/sign-in", { error: result.error }, next);
  }

  redirect(accountDestination(result.user, next));
}

export async function signOut(): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await authProvider.signOut();
  redirect("/");
}

export async function verifyEmailAction(formData: FormData): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  const next = readFormString(formData, "next");
  const result = await verifyAccountEmail(db, authProvider, {
    email,
    otp: readFormString(formData, "otp"),
  });

  if (!result.ok) {
    await setAccountCodeEmail("verification", email);
    redirectWithNext("/verify-email", { error: result.error }, next);
  }

  await setAccountCodeEmail("verification", "");
  const user = await resolveCurrentUser(db, authProvider).catch(() => null);
  if (user && user.authUserId === result.authUserId && user.email === result.email) {
    redirect(accountDestination(user, readOptionalNextPath(next)));
  }
  redirectWithNext("/sign-in", { verified: "1" }, next);
}

export async function resendVerificationAction(
  formData: FormData,
): Promise<never> {
  "use server";

  const next = readFormString(formData, "next");
  const email = normalizeUc3mEmail(readFormString(formData, "email"));
  if (!email) {
    redirectWithNext("/verify-email", { error: "email" }, next);
  }

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await resendAccountVerification(db, authProvider, email);

  await setAccountCodeEmail("verification", email);
  redirectWithNext("/verify-email", { resent: "1" }, next);
}

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  await requestPasswordReset(db, authProvider, email);

  await setAccountCodeEmail("recovery", email);
  redirect("/reset-password?sent=1");
}

export async function resetPasswordAction(formData: FormData): Promise<never> {
  "use server";

  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  const result = await completePasswordReset(db, authProvider, {
    email,
    otp: readFormString(formData, "otp"),
    password: readFormString(formData, "password"),
    confirmPassword: readFormString(formData, "confirmPassword"),
  });

  if (!result.ok) {
    await setAccountCodeEmail("recovery", email);
    redirect("/reset-password?error=" + encodeURIComponent(result.error));
  }

  await setAccountCodeEmail("recovery", "");
  await authProvider.signOut().catch(() => undefined);
  redirect("/sign-in?reset=ok");
}
