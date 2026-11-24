/**
 * @file Cola persistente de borrados de avatares. El cambio del perfil encola la clave anterior
 * en su misma transacción; las operaciones de foto y el script de mantenimiento reintentan
 * el borrado físico. La cola no contiene imágenes ni credenciales.
 */
import { eq } from "drizzle-orm";
import { avatarDeletions, profiles } from "../../db/schema";
import type { AppDb } from "../../db/client";
import type { AvatarStorage } from "../storage/neon-object-storage";

/**
 * Comprueba si quedan objetos retirados del titular, para mostrar el botón de reintento.
 * @param personId UUID del titular autenticado por operations.ts.
 * @param db Conexión de PostgreSQL usada por el perfil.
 * @returns Si existe al menos un borrado pendiente para ese perfil.
 */
export async function hasAvatarDeletions(personId: string, db: AppDb): Promise<boolean> {
  const rows = await db.select({ key: avatarDeletions.key }).from(avatarDeletions)
    .where(eq(avatarDeletions.personId, personId)).limit(1);
  return rows.length > 0;
}

/**
 * Borra los objetos encolados y retira cada tarea solo después de confirmarlo con Storage.
 * El bloqueo de la tarea evita que dos reintentos actúen a la vez. Si la clave sigue referenciada
 * (p. ej., se perdió la respuesta de COMMIT), se conserva la imagen y se descarta solo la tarea.
 * @param db Conexión PostgreSQL o PGlite de la aplicación.
 * @param storage Adaptador privado que confirma DELETE, o null sin configuración.
 * @param personId Limita la limpieza al titular; omitido en el script de mantenimiento.
 * @returns true si terminó toda la tanda; false conserva las tareas fallidas para reintento.
 */
export async function flushAvatarDeletions(db: AppDb, storage: AvatarStorage | null, personId?: string): Promise<boolean> {
  let rows: { key: string }[];
  try {
    rows = await db.select({ key: avatarDeletions.key }).from(avatarDeletions)
      .where(personId ? eq(avatarDeletions.personId, personId) : undefined);
  } catch {
    return false;
  }
  if (rows.length === 0) return true;
  if (!storage) return false;
  let complete = true;
  for (const row of rows) {
    try {
      await db.transaction(async (tx) => {
        const [pending] = await tx.select().from(avatarDeletions)
          .where(eq(avatarDeletions.key, row.key)).for("update");
        if (!pending) return;
        const [referenced] = await tx.select({ id: profiles.id }).from(profiles)
          .where(eq(profiles.avatarKey, pending.key)).limit(1);
        if (!referenced) await storage.deleteObject(pending.key);
        await tx.delete(avatarDeletions).where(eq(avatarDeletions.key, pending.key));
      });
    } catch {
      complete = false;
    }
  }
  return complete;
}
