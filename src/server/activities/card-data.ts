/**
 * @file Firma, reemisión y verificación de tarjetas QR. La versión vigente y la elegibilidad se leen
 * del perfil. La reemisión invalida los tokens de versiones anteriores.
 */

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";

import type { AppDb } from "../../db/client";
import { profiles } from "../../db/schema";
import { isUuid } from "../profiles/identity";
import { resolveDb } from "./shared";

const DEFAULT_ISSUER = "https://comunidad.adastrauc3m.es";
const CARD_AUDIENCE = "attendance";
const MAX_TOKEN_LENGTH = 2048;
const TEST_ONLY_QR_SECRET =
  "ad-astra-test-only-attendance-qr-secret-minimum-32-bytes";

/**
 * Decide si `getCardSecretKey` puede usar la clave de pruebas según el entorno del proceso.
 * @returns `true` en el modo de pruebas reconocido cuando Neon Auth no está configurado.
 */
function isTestQrFallbackAllowed(): boolean {
  if (process.env.NEON_AUTH_BASE_URL?.trim()) {
    return false;
  }
  return Boolean(
    process.env.NODE_TEST_CONTEXT || process.env.AD_ASTRA_TEST_AUTH === "1",
  );
}

/**
 * Lee la clave que comparten `issueCard`, `reissueCard` y `verifyCard`. Usa la clave de pruebas cuando
 * `isTestQrFallbackAllowed` lo permite y falta la configurada.
 * @returns La clave codificada en bytes UTF-8.
 * @throws Si la clave configurada tiene menos de 32 caracteres o falta fuera del modo de pruebas
 * permitido.
 */
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

/**
 * Obtiene el emisor que usan `signCardToken` y `verifyCard` para el JWT.
 * @returns El `APP_ORIGIN` configurado o el origen público predeterminado.
 */
function getCardIssuer(): string {
  return process.env.APP_ORIGIN?.trim() || DEFAULT_ISSUER;
}

/**
 * Firma el token de `issueCard` y `reissueCard` con HS256, emisor y audiencia `attendance`.
 * @param key Clave HMAC en bytes que se entrega a `jose`.
 * @param personId UUID del perfil que se escribe como sujeto del JWT.
 * @param version Versión que se incluye para poder revocar tarjetas anteriores.
 * @returns El JWT firmado que se codifica en el QR.
 */
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

/**
 * Lee la versión almacenada. Las pruebas la usan para comprobar el incremento de versión al reemitir.
 * @param personId UUID del perfil cuya versión se consulta.
 * @param db Conexión opcional para pruebas.
 * @returns La versión vigente o `null` si el ID es inválido o el perfil no existe.
 */
export async function getCardVersion(
  personId: string,
  db?: AppDb,
): Promise<number | null> {
  if (!isUuid(personId)) return null;
  const conn = await resolveDb(db);
  const [row] = await conn
    .select({ qrVersion: profiles.qrVersion })
    .from(profiles)
    .where(eq(profiles.id, personId))
    .limit(1);
  return row?.qrVersion ?? null;
}

/**
 * Emite para `issueMyCard` un token de la versión vigente del perfil activo, vinculado a una cuenta y
 * con correo verificado.
 * @param personId UUID del perfil titular de la tarjeta.
 * @param db Conexión opcional para pruebas.
 * @returns El token firmado y su versión.
 * @throws Si no se puede obtener la clave o el perfil carece de los requisitos de emisión.
 */
export async function issueCard(
  personId: string,
  db?: AppDb,
): Promise<{ token: string; version: number }> {
  const key = getCardSecretKey();
  if (!isUuid(personId)) {
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

/**
 * Reemite para `reissueMyCard`. Incrementa la versión mediante una sola actualización condicionada al
 * estado del perfil y firma con la nueva versión.
 * @param personId UUID del perfil titular cuya versión se incrementa.
 * @param db Conexión opcional para pruebas.
 * @returns El token firmado y la nueva versión.
 * @throws Si no se puede obtener la clave o el perfil carece de los requisitos de reemisión.
 */
export async function reissueCard(
  personId: string,
  db?: AppDb,
): Promise<{ token: string; version: number }> {
  const key = getCardSecretKey();
  if (!isUuid(personId)) {
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

/**
 * Verifica para `validateAttendanceCard` la firma HS256, el emisor, la audiencia, los campos del token
 * y su correspondencia con un perfil habilitado y su versión vigente.
 * @param token Texto escaneado o pegado en el formulario. Se recorta antes de verificar.
 * @param db Conexión opcional para pruebas.
 * @returns El UUID del titular si la tarjeta supera la verificación, o `null`.
 * @throws Si falla la configuración de la clave.
 */
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
      !isUuid(payload.sub) ||
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

/**
 * Alias de `verifyCard`. Las pruebas comprueban que ambas entradas aceptan la tarjeta vigente.
 * @param token Texto del JWT que se verifica.
 * @param db Conexión opcional para pruebas.
 * @returns El UUID del titular si la tarjeta supera la verificación, o `null`.
 */
export const readCard = verifyCard;
