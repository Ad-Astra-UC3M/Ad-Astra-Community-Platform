import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppDb } from "../../db/client";
import {
  CAPABILITY_CODES,
  accountCapabilities,
  profiles,
  type AccountStatus,
  type CapabilityCode,
  type ProfileRow,
} from "../../db/schema";
import type { AuthProvider, AuthProviderUser } from "./neon-auth";
import { normalizeUc3mEmail } from "./uc3m";

export const PRIVACY_VERSION = "v1";

export type AuthUser = {
  id: string;
  personId: string;
  authUserId: string;
  name: string;
  email: string;
  status: AccountStatus;
  capabilities: CapabilityCode[];
};

export type RegisterAccountInput = {
  firstName: string;
  lastName: string;
  email: string;
  degree: string;
  course: string;
  academicLevel?: string | null;
  languageModality?: string | null;
  password: string;
  privacyAccepted: boolean;
};

export type RegisterAccountError =
  | "privacy"
  | "email"
  | "password"
  | "fields"
  | "duplicate"
  | "provider";

export type RegisterAccountResult =
  | {
      ok: true;
      profileId: string;
      authUserId: string;
      email: string;
      verificationRequired: boolean;
      recovered: boolean;
    }
  | { ok: false; error: RegisterAccountError };

export type VerifyAccountEmailResult =
  | { ok: true; sessionUser: AuthUser | null }
  | { ok: false; error: "invalid" | "expired" };

export type AuthenticateAccountResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: "credentials" | "unverified" };

export type CompletePasswordResetInput = {
  email: string;
  otp: string;
  password: string;
  confirmPassword?: string;
};

export type CompletePasswordResetResult =
  | { ok: true }
  | { ok: false; error: "password" | "mismatch" | "invalid" };

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((val) => val.trim().length > 0);

const trimmedField = (max: number) =>
  z
    .string()
    .transform((val) => val.trim())
    .pipe(z.string().min(1).max(max));

const optionalTrimmedField = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((val) => val === null || val.length <= max);

const uc3mEmailSchema = z
  .string()
  .transform((val) => normalizeUc3mEmail(val))
  .refine((val): val is string => val !== null);

const registerFieldsSchema = z.object({
  firstName: trimmedField(80),
  lastName: trimmedField(120),
  degree: trimmedField(120),
  course: trimmedField(40),
  academicLevel: optionalTrimmedField(40),
  languageModality: optionalTrimmedField(40),
});

const signInSchema = z.object({
  email: uc3mEmailSchema,
  password: passwordSchema,
});

const emailOtpSchema = z.object({
  email: uc3mEmailSchema,
  otp: z.string().trim().regex(/^\d{6}$/),
});

export function isCapabilityCode(value: unknown): value is CapabilityCode {
  return (
    typeof value === "string" &&
    (CAPABILITY_CODES as readonly string[]).includes(value)
  );
}

function isPgUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (String(candidate.code) === "23505") return true;
  if (candidate.cause && typeof candidate.cause === "object") {
    return String((candidate.cause as { code?: unknown }).code) === "23505";
  }
  return false;
}

async function loadCapabilities(
  db: AppDb,
  profileId: string,
): Promise<CapabilityCode[]> {
  const rows = await db
    .select({ capabilityCode: accountCapabilities.capabilityCode })
    .from(accountCapabilities)
    .where(eq(accountCapabilities.profileId, profileId));

  const granted = new Set<string>(rows.map((row) => row.capabilityCode));
  return CAPABILITY_CODES.filter((code) => granted.has(code));
}

function buildAuthUser(
  profile: ProfileRow,
  authUserId: string,
  capabilities: CapabilityCode[],
): AuthUser {
  return {
    id: profile.id,
    personId: profile.id,
    authUserId,
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    email: profile.email,
    status: profile.status,
    capabilities,
  };
}

export async function registerAccount(
  db: AppDb,
  authProvider: AuthProvider,
  input: RegisterAccountInput,
  options?: { now?: Date },
): Promise<RegisterAccountResult> {
  if (input.privacyAccepted !== true) {
    return { ok: false, error: "privacy" };
  }

  const parsedEmail = uc3mEmailSchema.safeParse(input.email);
  if (!parsedEmail.success) {
    return { ok: false, error: "email" };
  }
  const email = parsedEmail.data;

  const parsedPassword = passwordSchema.safeParse(input.password);
  if (!parsedPassword.success) {
    return { ok: false, error: "password" };
  }
  const password = parsedPassword.data;

  const parsedFields = registerFieldsSchema.safeParse({
    firstName: input.firstName,
    lastName: input.lastName,
    degree: input.degree,
    course: input.course,
    academicLevel: input.academicLevel,
    languageModality: input.languageModality,
  });
  if (!parsedFields.success) {
    return { ok: false, error: "fields" };
  }
  const fields = parsedFields.data;

  const [existingProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (existingProfile?.authUserId) {
    return { ok: false, error: "duplicate" };
  }

  const fullName = `${fields.firstName} ${fields.lastName}`.trim();
  const signUpResult = await authProvider.signUp({
    email,
    password,
    name: fullName,
  });

  let authUser: AuthProviderUser;
  let verificationRequired: boolean;
  let recovered = false;

  if (signUpResult.ok) {
    authUser = signUpResult.user;
    verificationRequired = signUpResult.verificationRequired;
  } else if (signUpResult.errorCode === "USER_ALREADY_EXISTS") {
    const recoveredUser = authProvider.recoverUnlinkedUser
      ? await authProvider.recoverUnlinkedUser({ email, password })
      : null;

    if (!recoveredUser || normalizeUc3mEmail(recoveredUser.email) !== email) {
      return { ok: false, error: "duplicate" };
    }

    const [linkedByAuthId] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.authUserId, recoveredUser.id))
      .limit(1);

    if (linkedByAuthId) {
      return { ok: false, error: "duplicate" };
    }

    authUser = recoveredUser;
    verificationRequired = !recoveredUser.emailVerified;
    recovered = true;

    if (verificationRequired) {
      await authProvider
        .sendVerificationOtp({ email })
        .catch(() => undefined);
    }
  } else if (signUpResult.errorCode === "WEAK_PASSWORD") {
    return { ok: false, error: "password" };
  } else {
    return { ok: false, error: "provider" };
  }

  const now = options?.now ?? new Date();
  const verifiedAt = authUser.emailVerified ? now : null;

  try {
    const linked = await db.transaction(async (tx) => {
      const [currentByEmail] = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.email, email))
        .limit(1);

      if (currentByEmail) {
        if (currentByEmail.authUserId) {
          return null;
        }
        const [updated] = await tx
          .update(profiles)
          .set({
            authUserId: authUser.id,
            firstName: fields.firstName,
            lastName: fields.lastName,
            degree: fields.degree,
            course: fields.course,
            academicLevel: fields.academicLevel,
            languageModality: fields.languageModality,
            privacyAccepted: true,
            privacyVersion: PRIVACY_VERSION,
            privacyAcceptedAt: now,
            registeredAt: now,
            emailVerifiedAt: currentByEmail.emailVerifiedAt ?? verifiedAt,
            updatedAt: now,
          })
          .where(eq(profiles.id, currentByEmail.id))
          .returning({ id: profiles.id });
        return updated ?? null;
      }

      const [inserted] = await tx
        .insert(profiles)
        .values({
          authUserId: authUser.id,
          email,
          firstName: fields.firstName,
          lastName: fields.lastName,
          degree: fields.degree,
          course: fields.course,
          academicLevel: fields.academicLevel,
          languageModality: fields.languageModality,
          privacyAccepted: true,
          privacyVersion: PRIVACY_VERSION,
          privacyAcceptedAt: now,
          status: "active",
          qrVersion: 1,
          registeredAt: now,
          emailVerifiedAt: verifiedAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: profiles.id });
      return inserted ?? null;
    });

    if (!linked) {
      return { ok: false, error: "duplicate" };
    }

    return {
      ok: true,
      profileId: linked.id,
      authUserId: authUser.id,
      email,
      verificationRequired,
      recovered,
    };
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return { ok: false, error: "duplicate" };
    }
    throw error;
  }
}

export async function verifyAccountEmail(
  db: AppDb,
  authProvider: AuthProvider,
  input: { email: string; otp: string },
  options?: { now?: Date },
): Promise<VerifyAccountEmailResult> {
  const challenge = emailOtpSchema.safeParse(input);
  if (!challenge.success) {
    return { ok: false, error: "invalid" };
  }

  const verified = await authProvider.verifyEmailOtp(challenge.data);
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.errorCode === "TOKEN_EXPIRED" ? "expired" : "invalid",
    };
  }

  const email = normalizeUc3mEmail(verified.user.email);
  if (email !== challenge.data.email || !verified.user.emailVerified) {
    return { ok: false, error: "invalid" };
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, verified.user.id))
    .limit(1);

  if (!profile || profile.email !== email || profile.status !== "active") {
    return { ok: false, error: "invalid" };
  }

  const now = options?.now ?? new Date();
  await db
    .update(profiles)
    .set({
      emailVerifiedAt: profile.emailVerifiedAt ?? now,
      updatedAt: now,
    })
    .where(eq(profiles.id, profile.id));

  return {
    ok: true,
    sessionUser: verified.sessionCreated
      ? buildAuthUser(profile, verified.user.id, await loadCapabilities(db, profile.id))
      : null,
  };
}

export async function resendAccountVerification(
  db: AppDb,
  authProvider: AuthProvider,
  rawEmail: string,
): Promise<{ ok: true }> {
  const email = normalizeUc3mEmail(rawEmail);
  if (!email) {
    return { ok: true };
  }

  const [profile] = await db
    .select({
      authUserId: profiles.authUserId,
      status: profiles.status,
      emailVerifiedAt: profiles.emailVerifiedAt,
    })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (
    profile &&
    profile.authUserId &&
    profile.status === "active" &&
    profile.emailVerifiedAt === null
  ) {
    await authProvider
      .sendVerificationOtp({ email })
      .catch(() => undefined);
  }

  return { ok: true };
}

export async function authenticateAccount(
  db: AppDb,
  authProvider: AuthProvider,
  rawEmail: string,
  rawPassword: string,
): Promise<AuthenticateAccountResult> {
  const parsed = signInSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });
  if (!parsed.success) {
    return { ok: false, error: "credentials" };
  }

  const { email, password } = parsed.data;
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (!profile || !profile.authUserId || profile.status !== "active") {
    return { ok: false, error: "credentials" };
  }

  const signInResult = await authProvider.signIn({ email, password });
  if (!signInResult.ok) {
    if (signInResult.errorCode === "EMAIL_NOT_VERIFIED") {
      return { ok: false, error: "unverified" };
    }
    return { ok: false, error: "credentials" };
  }

  if (!signInResult.user.emailVerified) {
    await authProvider.signOut().catch(() => undefined);
    return { ok: false, error: "unverified" };
  }

  const providerEmail = normalizeUc3mEmail(signInResult.user.email);
  if (
    !providerEmail ||
    providerEmail !== profile.email ||
    signInResult.user.id !== profile.authUserId
  ) {
    await authProvider.signOut().catch(() => undefined);
    return { ok: false, error: "credentials" };
  }

  if (profile.emailVerifiedAt === null) {
    const now = new Date();
    await db
      .update(profiles)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(eq(profiles.id, profile.id));
  }

  const [freshProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profile.id))
    .limit(1);

  if (
    !freshProfile ||
    !freshProfile.authUserId ||
    freshProfile.status !== "active"
  ) {
    await authProvider.signOut().catch(() => undefined);
    return { ok: false, error: "credentials" };
  }

  const capabilities = await loadCapabilities(db, freshProfile.id);
  return {
    ok: true,
    user: buildAuthUser(freshProfile, freshProfile.authUserId, capabilities),
  };
}

async function canResetPassword(db: AppDb, email: string): Promise<boolean> {
  const [profile] = await db
    .select({
      authUserId: profiles.authUserId,
      status: profiles.status,
      emailVerifiedAt: profiles.emailVerifiedAt,
    })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  return Boolean(
    profile &&
    profile.authUserId &&
    profile.status === "active" &&
    profile.emailVerifiedAt !== null
  );
}

export async function requestPasswordReset(
  db: AppDb,
  authProvider: AuthProvider,
  rawEmail: string,
): Promise<{ ok: true }> {
  const email = normalizeUc3mEmail(rawEmail);
  if (!email) {
    return { ok: true };
  }

  if (await canResetPassword(db, email)) {
    await authProvider
      .requestPasswordResetOtp({ email })
      .catch(() => undefined);
  }

  return { ok: true };
}

export async function completePasswordReset(
  db: AppDb,
  authProvider: AuthProvider,
  input: CompletePasswordResetInput,
): Promise<CompletePasswordResetResult> {
  const parsedPassword = passwordSchema.safeParse(input.password);
  if (!parsedPassword.success) {
    return { ok: false, error: "password" };
  }

  if (
    input.confirmPassword !== undefined &&
    input.confirmPassword !== parsedPassword.data
  ) {
    return { ok: false, error: "mismatch" };
  }

  const challenge = emailOtpSchema.safeParse(input);
  if (!challenge.success || !(await canResetPassword(db, challenge.data.email))) {
    return { ok: false, error: "invalid" };
  }

  const resetResult = await authProvider.resetPasswordWithOtp({
    ...challenge.data,
    newPassword: parsedPassword.data,
  });

  if (!resetResult.ok) {
    if (resetResult.errorCode === "WEAK_PASSWORD") {
      return { ok: false, error: "password" };
    }
    return { ok: false, error: "invalid" };
  }

  return { ok: true };
}

export async function resolveCurrentUser(
  db: AppDb,
  authProvider: AuthProvider,
): Promise<AuthUser | null> {
  const session = await authProvider.getSession();
  if (!session?.user) {
    return null;
  }

  if (session.user.emailVerified !== true) {
    return null;
  }

  const sessionEmail = normalizeUc3mEmail(session.user.email);
  if (!sessionEmail) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, session.user.id))
    .limit(1);

  if (
    !profile ||
    !profile.authUserId ||
    profile.email !== sessionEmail ||
    profile.status !== "active"
  ) {
    return null;
  }

  const capabilities = await loadCapabilities(db, profile.id);
  return buildAuthUser(profile, profile.authUserId, capabilities);
}
