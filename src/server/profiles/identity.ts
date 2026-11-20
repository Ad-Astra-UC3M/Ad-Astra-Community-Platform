/**
 * Utilidades compartidas de identidad para los repositorios de cuentas, perfiles y
 * oportunidades. Validan identificadores antes de consultar PostgreSQL y preparan nombres para
 * administración. Véase docs/backend/profiles.md.
 */

import { eq } from "drizzle-orm";
import type { AppDbOrTx } from "../../db/client";
import { profiles } from "../../db/schema";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Comprueba el formato que esperan las columnas UUID antes de construir consultas en los
 * repositorios.
 *
 * @param value - Cadena de identificador que se valida.
 * @returns Si coincide con el formato hexadecimal con guiones.
 */
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Compone el nombre que muestran las consultas administrativas de cuentas, talento y supresión.
 *
 * @param firstName - Nombre que precede a los apellidos.
 * @param lastName - Apellidos que completan el nombre visible.
 * @returns Nombre y apellidos unidos, sin espacios en los extremos.
 */
export function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/**
 * Comprueba que existe la persona referenciada por una lectura o escritura de los repositorios.
 *
 * @param db - Conexión o transacción en la que se consulta profiles.
 * @param personId - UUID que localiza la fila de la persona.
 * @returns Si el identificador tiene formato UUID y existe una fila para él.
 */
export async function profileExists(
  db: AppDbOrTx,
  personId: string,
): Promise<boolean> {
  if (!isUuid(personId)) return false;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, personId))
    .limit(1);
  return Boolean(row);
}
