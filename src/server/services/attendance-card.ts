import { and, eq, isNotNull, sql } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";

import { getDb, type AppDb } from "../../db/client";
import { profiles } from "../../db/schema";

const DEFAULT_ISSUER = "https://comunidad.adastrauc3m.es";
const CARD_AUDIENCE = "attendance";
const MAX_TOKEN_LENGTH = 2048;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEST_ONLY_QR_SECRET =
  "ad-astra-test-only-attendance-qr-secret-minimum-32-bytes";

function isTestQrFallbackAllowed(): boolean {
  if (process.env.NEON_AUTH_BASE_URL?.trim()) {
    return false;
  }
  return Boolean(
    process.env.NODE_TEST_CONTEXT || process.env.AD_ASTRA_TEST_AUTH === "1",
  );
}

function getCardSecretKey(): Uint8Array {
  const configured = process.env.ATTENDANCE_QR_SECRET?.trim();
  if (configured) {
    if (configured.length < 32) {
      throw new Error(
        "ATTENDANCE_QR_SECRET debe tener al menos 32 caracteres.",
      );
    }
    return new TextEncoder().encode(configured);
  }

  if (isTestQrFallbackAllowed()) {
    return new TextEncoder().encode(TEST_ONLY_QR_SECRET);
  }

  throw new Error(
    "ATTENDANCE_QR_SECRET es obligatorio fuera del entorno de pruebas.",
  );
}

function getCardIssuer(): string {
  return process.env.APP_ORIGIN?.trim() || DEFAULT_ISSUER;
}

async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

function signCardToken(
  key: Uint8Array,
  personId: string,
  version: number,
): Promise<string> {
  return new SignJWT({ version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(getCardIssuer())
    .setAudience(CARD_AUDIENCE)
    .setSubject(personId)
    .sign(key);
}

export async function getCardVersion(
  personId: string,
  db?: AppDb,
): Promise<number | null> {
  if (!UUID_REGEX.test(personId)) return null;
  const conn = await resolveDb(db);
  const [row] = await conn
    .select({ qrVersion: profiles.qrVersion })
    .from(profiles)
    .where(eq(profiles.id, personId))
    .limit(1);
  return row?.qrVersion ?? null;
}

export async function issueCard(
  personId: string,
  db?: AppDb,
): Promise<{ token: string; version: number }> {
  const key = getCardSecretKey();
  if (!UUID_REGEX.test(personId)) {
    throw new Error("El identificador de persona no es válido.");
  }

  const conn = await resolveDb(db);
  const [profile] = await conn
    .select({
      id: profiles.id,
      qrVersion: profiles.qrVersion,
      status: profiles.status,
      authUserId: profiles.authUserId,
      emailVerifiedAt: profiles.emailVerifiedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, personId))
    .limit(1);

  if (
    !profile ||
    profile.status !== "active" ||
    profile.authUserId === null ||
    profile.emailVerifiedAt === null
  ) {
    throw new Error("El perfil no está habilitado para emitir una tarjeta QR.");
  }

  const token = await signCardToken(key, profile.id, profile.qrVersion);
  return { token, version: profile.qrVersion };
}

export async function reissueCard(
  personId: string,
  db?: AppDb,
): Promise<{ token: string; version: number }> {
  const key = getCardSecretKey();
  if (!UUID_REGEX.test(personId)) {
    throw new Error("El identificador de persona no es válido.");
  }

  const conn = await resolveDb(db);
  const [updated] = await conn
    .update(profiles)
    .set({
      qrVersion: sql`${profiles.qrVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(profiles.id, personId),
        eq(profiles.status, "active"),
        isNotNull(profiles.authUserId),
        isNotNull(profiles.emailVerifiedAt),
      ),
    )
    .returning({ id: profiles.id, qrVersion: profiles.qrVersion });

  if (!updated) {
    throw new Error(
      "El perfil no está habilitado para reemitir una tarjeta QR.",
    );
  }

  const token = await signCardToken(key, updated.id, updated.qrVersion);
  return { token, version: updated.qrVersion };
}

export async function verifyCard(
  token: string,
  db?: AppDb,
): Promise<string | null> {
  const key = getCardSecretKey();
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_LENGTH) return null;

  try {
    const { payload } = await jwtVerify(trimmed, key, {
      algorithms: ["HS256"],
      audience: CARD_AUDIENCE,
      issuer: getCardIssuer(),
    });

    if (
      typeof payload.sub !== "string" ||
      !UUID_REGEX.test(payload.sub) ||
      typeof payload.version !== "number" ||
      !Number.isInteger(payload.version) ||
      payload.version < 1
    ) {
      return null;
    }

    const conn = await resolveDb(db);
    const [profile] = await conn
      .select({
        id: profiles.id,
        qrVersion: profiles.qrVersion,
        status: profiles.status,
        authUserId: profiles.authUserId,
        emailVerifiedAt: profiles.emailVerifiedAt,
      })
      .from(profiles)
      .where(eq(profiles.id, payload.sub))
      .limit(1);

    if (
      !profile ||
      profile.qrVersion !== payload.version ||
      profile.status !== "active" ||
      profile.authUserId === null ||
      profile.emailVerifiedAt === null
    ) {
      return null;
    }

    return profile.id;
  } catch {
    return null;
  }
}

export const readCard = verifyCard;
