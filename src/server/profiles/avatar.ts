/**
 * @file Persistencia y lectura privada de fotos de perfil en PostgreSQL (`public.profiles`) y
 * `AvatarStorage` (Neon Object Storage en despliegue y adaptadores locales en pruebas).
 */

import { eq } from "drizzle-orm";
import { getDb, type AppDb, type AppDbOrTx } from "../../db/client";
import { avatarDeletions, profiles, talentProfiles } from "../../db/schema";
import type { AvatarStorage } from "../storage/neon-object-storage";
import {
  buildAvatarObjectKey,
  contentTypeFromAvatarKey,
  isValidAvatarKey,
  type AvatarMimeType,
  type AvatarValidationError,
} from "./avatar-validation";
import { prepareAvatarImage } from "./avatar-image";
import { flushAvatarDeletions } from "./avatar-cleanup";
import { isUuid, profileExists } from "./identity";

export type UploadProfileAvatarError =
  | AvatarValidationError
  | "missing"
  | "storage_unavailable"
  | "storage_error";

export type UploadProfileAvatarResult =
  | { ok: true; avatarKey: string; avatarUpdatedAt: Date }
  | { ok: false; error: UploadProfileAvatarError };

export type RemoveProfileAvatarResult =
  | { ok: true; removed: boolean }
  | { ok: false; error: "missing" | "cleanup_pending" };

export interface LoadedProfileAvatar {
  body: Uint8Array;
  contentType: AvatarMimeType;
  avatarUpdatedAt: Date;
}

/**
 * Selecciona la conexión Drizzle inyectada en pruebas o la configurada por la aplicación.
 *
 * @param db - Conexión opcional de lectura o transacción.
 * @returns Instancia `AppDb` lista para consultar `public.profiles`.
 */
async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

/**
 * Normaliza la marca temporal recibida para garantizar fechas finitas al persistir `avatarUpdatedAt`.
 *
 * @param now - Fecha opcional recibida del llamador o reloj de prueba.
 * @returns Fecha finita válida.
 */
function resolveTimestamp(now?: Date): Date {
  return now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
}

/**
 * Valida clave, marca temporal y tipo MIME antes de recuperar el binario privado desde `storage`.
 *
 * @param avatarKey - Clave persistida en `profiles.avatar_key`.
 * @param avatarUpdatedAt - Marca temporal de `profiles.avatar_updated_at`.
 * @param storage - Adaptador de objetos o `null` si no está configurado.
 * @returns Bytes y `Content-Type` seguro, o `null` si falta el avatar o la clave es inválida.
 */
async function loadAvatarFromStorage(
  avatarKey: string | null | undefined,
  avatarUpdatedAt: Date | null | undefined,
  storage: AvatarStorage | null,
): Promise<LoadedProfileAvatar | null> {
  if (!storage || !avatarKey || !avatarUpdatedAt) return null;
  if (!isValidAvatarKey(avatarKey)) return null;
  const contentType = contentTypeFromAvatarKey(avatarKey);
  if (!contentType) return null;

  const object = await storage.getObject(avatarKey);
  if (!object) return null;

  return {
    body: object.body,
    contentType,
    avatarUpdatedAt,
  };
}

/**
 * Decodifica, redimensiona y comprime la imagen subida, la guarda bajo una nueva clave en el bucket
 * privado, actualiza `public.profiles` en transacción y encola la foto previa para borrado reintentable. Si falla la
 * escritura en PostgreSQL, intenta limpiar el nuevo objeto para no dejar huérfanos en Neon Storage.
 *
 * @param personId - UUID del titular de la sesión.
 * @param bytes - Carga binaria enviada desde `/profile`.
 * @param storage - Adaptador `AvatarStorage` o `null` si falta configuración en este entorno.
 * @param db - Conexión opcional de base de datos para pruebas.
 * @param now - Marca temporal opcional para pruebas deterministas.
 * @returns Clave nueva y marca de actualización, o código de error controlado.
 */
export async function uploadProfileAvatar(
  personId: string,
  bytes: Uint8Array,
  storage: AvatarStorage | null,
  db?: AppDb,
  now?: Date,
): Promise<UploadProfileAvatarResult> {
  if (!isUuid(personId)) {
    return { ok: false, error: "missing" };
  }

  const validated = await prepareAvatarImage(bytes);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  if (!storage) {
    return { ok: false, error: "storage_unavailable" };
  }

  const database = await resolveDb(db);
  if (!(await profileExists(database, personId))) {
    return { ok: false, error: "missing" };
  }

  const timestamp = resolveTimestamp(now);
  const newKey = buildAvatarObjectKey(personId, validated.extension);

  // La tarea se confirma antes de subir bytes. Si PostgreSQL cae tras PUT, queda una
  // referencia durable para el siguiente reintento de limpieza.
  await database.insert(avatarDeletions).values({ key: newKey, personId });
  let outcome: { kind: "missing" | "storage_error" } | { kind: "updated" };
  try {
    outcome = await database.transaction(async (tx: AppDbOrTx) => {
      // La limpieza bloquea la misma tarea: no puede borrar una subida en curso.
      // Si la consumió antes de llegar aquí, abortamos sin subir ningún archivo.
      const [reservation] = await tx.select({ key: avatarDeletions.key }).from(avatarDeletions)
        .where(eq(avatarDeletions.key, newKey)).for("update");
      if (!reservation) return { kind: "storage_error" as const };
      const [existing] = await tx.select({ id: profiles.id, avatarKey: profiles.avatarKey })
        .from(profiles).where(eq(profiles.id, personId)).for("update");
      if (!existing) return { kind: "missing" as const };
      try {
        await storage.putObject(newKey, validated.body, validated.mimeType);
      } catch {
        return { kind: "storage_error" as const };
      }
      if (existing.avatarKey) {
        await tx.insert(avatarDeletions).values({ key: existing.avatarKey, personId }).onConflictDoNothing();
      }
      await tx.update(profiles).set({ avatarKey: newKey, avatarUpdatedAt: timestamp, updatedAt: timestamp })
        .where(eq(profiles.id, personId));
      await tx.delete(avatarDeletions).where(eq(avatarDeletions.key, newKey));
      return { kind: "updated" as const };
    });
  } catch (error) {
    // Si COMMIT se confirmó, la tarea ya no existe; si hizo rollback, permanece.
    // Un fallo de base de datos aquí conserva la reserva para mantenimiento posterior.
    await flushAvatarDeletions(database, storage, personId).catch(() => false);
    throw error;
  }
  await flushAvatarDeletions(database, storage, personId);
  if (outcome.kind !== "updated") return { ok: false, error: outcome.kind };

  return {
    ok: true,
    avatarKey: newKey,
    avatarUpdatedAt: timestamp,
  };
}

/**
 * Retira la foto de perfil actual y encola el borrado en una misma transacción; elimina el objeto previo
 * en Neon Object Storage tras el commit. Repetirla sobre un perfil sin foto resulta idempotente.
 *
 * @param personId - UUID del titular autenticado.
 * @param storage - Adaptador `AvatarStorage` o `null`.
 * @param db - Conexión opcional para pruebas.
 * @param now - Marca temporal opcional para actualizar `updatedAt`.
 * @returns Confirmación o error: perfil ausente o borrado físico pendiente de completar.
 */
export async function removeProfileAvatar(
  personId: string,
  storage: AvatarStorage | null,
  db?: AppDb,
  now?: Date,
): Promise<RemoveProfileAvatarResult> {
  if (!isUuid(personId)) {
    return { ok: false, error: "missing" };
  }

  const database = await resolveDb(db);
  const timestamp = resolveTimestamp(now);

  const outcome = await database.transaction(async (tx: AppDbOrTx) => {
    const [existing] = await tx.select({ id: profiles.id, avatarKey: profiles.avatarKey })
      .from(profiles).where(eq(profiles.id, personId)).for("update");
    if (!existing) return { kind: "missing" as const };
    if (!existing.avatarKey) {
      const [pending] = await tx.select({ key: avatarDeletions.key }).from(avatarDeletions)
        .where(eq(avatarDeletions.personId, personId)).limit(1);
      return { kind: pending ? "pending" as const : "empty" as const };
    }
    await tx.insert(avatarDeletions).values({ key: existing.avatarKey, personId }).onConflictDoNothing();
    await tx.update(profiles).set({ avatarKey: null, avatarUpdatedAt: null, updatedAt: timestamp })
      .where(eq(profiles.id, personId));
    return { kind: "removed" as const };
  });
  if (outcome.kind === "missing") return { ok: false, error: "missing" };
  const complete = await flushAvatarDeletions(database, storage, personId);
  if (!complete) return { ok: false, error: "cleanup_pending" };
  return { ok: true, removed: outcome.kind !== "empty" };

}

/**
 * Lee la foto de perfil propia de una cuenta para servirla por el endpoint autenticado
 * `/api/profile/avatar`.
 *
 * @param personId - UUID del perfil autenticado.
 * @param storage - Adaptador de objetos configurado.
 * @param db - Conexión opcional de base de datos.
 * @returns Bytes y `Content-Type` seguro, o `null` si no existe foto o almacenamiento.
 */
export async function readProfileAvatar(
  personId: string,
  storage: AvatarStorage | null,
  db?: AppDb,
): Promise<LoadedProfileAvatar | null> {
  if (!isUuid(personId) || !storage) return null;
  const database = await resolveDb(db);

  const [row] = await database
    .select({
      avatarKey: profiles.avatarKey,
      avatarUpdatedAt: profiles.avatarUpdatedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, personId))
    .limit(1);

  if (!row) return null;
  return loadAvatarFromStorage(row.avatarKey, row.avatarUpdatedAt, storage);
}

/**
 * Lee la foto de una candidatura únicamente si el titular tiene un perfil de talento registrado en
 * `public.talent_profiles`. Usada por `/api/admin/talent/[id]/avatar` tras verificar
 * `talent_consultation`.
 *
 * @param personId - UUID de la candidatura solicitada.
 * @param storage - Adaptador de objetos configurado.
 * @param db - Conexión opcional de base de datos.
 * @returns Bytes y `Content-Type` seguro, o `null` si falta perfil de talento, foto o storage.
 */
export async function readTalentProfileAvatar(
  personId: string,
  storage: AvatarStorage | null,
  db?: AppDb,
): Promise<LoadedProfileAvatar | null> {
  if (!isUuid(personId) || !storage) return null;
  const database = await resolveDb(db);

  const [row] = await database
    .select({
      avatarKey: profiles.avatarKey,
      avatarUpdatedAt: profiles.avatarUpdatedAt,
    })
    .from(talentProfiles)
    .innerJoin(profiles, eq(profiles.id, talentProfiles.personId))
    .where(eq(talentProfiles.personId, personId))
    .limit(1);

  if (!row) return null;
  return loadAvatarFromStorage(row.avatarKey, row.avatarUpdatedAt, storage);
}
