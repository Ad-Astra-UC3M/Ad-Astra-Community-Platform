"use server";

import { redirect } from "next/navigation";
import { getDb } from "../db/client";
import { getAuthProvider } from "../server/auth/neon-auth";
import { readOptionalNextPath, setAccountCodeEmail } from "../server/auth/form-context";
import { normalizeUc3mEmail } from "../server/auth/uc3m";
import {
  authenticateAccount,
  completePasswordReset,
  registerAccount,
  requestPasswordReset,
  resendAccountVerification,
  verifyAccountEmail,
  type AuthUser,
} from "../server/auth/service";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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

export async function signUp(formData: FormData): Promise<never> {
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
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await authProvider.signOut();
  redirect("/");
}

export async function verifyEmailAction(formData: FormData): Promise<never> {
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
  if (result.sessionUser) {
    redirect(accountDestination(result.sessionUser, readOptionalNextPath(next)));
  }
  redirectWithNext("/sign-in", { verified: "1" }, next);
}

export async function resendVerificationAction(
  formData: FormData,
): Promise<never> {
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
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  const email = readFormString(formData, "email");
  await requestPasswordReset(db, authProvider, email);

  await setAccountCodeEmail("recovery", email);
  redirect("/reset-password?sent=1");
}

export async function resetPasswordAction(formData: FormData): Promise<never> {
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
