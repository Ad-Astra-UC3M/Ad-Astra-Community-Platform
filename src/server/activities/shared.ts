/**
 * @file Conexión y cálculo de plazas compartidos por las consultas y operaciones de actividades.
 */

import { getDb, type AppDb } from "../../db/client";

/**
 * Selecciona la conexión que usan los módulos de datos de actividades.
 * @param db Conexión opcional que permite a las pruebas inyectar su base PGlite.
 * @returns La conexión recibida o la conexión de la aplicación obtenida con `getDb`.
 */
export async function resolveDb(db?: AppDb): Promise<AppDb> {
  return db ?? getDb();
}

/**
 * Calcula el número de plazas libres que muestran las lecturas del portal y del panel.
 * @param capacity Aforo del turno. `null` representa un aforo ilimitado.
 * @param reservedCount Número de participaciones que ocupan plaza, incluidas las asistencias
 * confirmadas.
 * @returns Las plazas libres, con mínimo cero, o `null` para aforo ilimitado.
 */
export function computeAvailable(capacity: number | null, reservedCount: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - reservedCount);
}
