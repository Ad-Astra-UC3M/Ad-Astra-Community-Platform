/**
 * @file Entrada común de sesión y capacidades para las páginas y los módulos. Next.js aplica la restricción
 * server-only a las importaciones de cliente. El servicio contrasta identidad y perfil activo antes de
 * delegar cualquier operación protegida.
 */

import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getDb } from "../../db/client";
import type { CapabilityCode } from "../../db/schema";
import { getAuthProvider } from "./neon-auth";
import { resolveCurrentUser, type AuthUser } from "./service";
import { sanitizeNextPath } from "./uc3m";

/**
 * Lee cookies de la petición y llama a resolveCurrentUser con el proveedor y la base. Se usa en la
 * navegación y en las comprobaciones de acceso.
 *
 * @returns El usuario activo y verificado, o null cuando no hay una sesión válida de Comunidad.
 */
export async function currentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  if (jar.getAll().length === 0) {
    return null;
  }
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  return resolveCurrentUser(db, authProvider);
}

/**
 * Obtiene la identidad con currentUser. Las operaciones del portal la usan para consultas y escrituras
 * propias.
 *
 * @param nextPath - Ruta interna opcional a la que se vuelve tras iniciar sesión.
 * @returns El usuario actual. Si falta, redirect de Next.js termina el recorrido y abre el acceso.
 */
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

/**
 * Entrega al adaptador la revocación que solicita el módulo de cuentas después de desactivar un perfil.
 *
 * @param authUserId - Identificador de la identidad de Neon, distinto del ID de perfil de Comunidad.
 */
export async function revokeUserSessions(authUserId: string): Promise<void> {
  const db = await getDb();
  const authProvider = await getAuthProvider(db);
  await authProvider.revokeUserSessions(authUserId);
}

/**
 * Entrega a loadAdminDashboard al usuario activo con al menos una capacidad. Si no hay acceso, notFound de
 * Next.js muestra la vista 404.
 *
 * @returns El usuario de la sesión con sus capacidades.
 */
export async function requireAdminAny(): Promise<AuthUser> {
  const user = await currentUser();
  if (!user || user.status !== "active" || user.capabilities.length === 0) {
    notFound();
  }
  return user;
}

/**
 * Comprueba currentUser y la capacidad concreta en la entrada de una operación administrativa. Ante falta
 * de acceso activa la vista 404.
 *
 * @param capability - Código que exige la operación, por ejemplo attendance_validation para validar una
 * tarjeta.
 * @returns El actor autorizado, cuyo personId puede usarse para auditar la operación.
 */
export async function requireCapability(
  capability: CapabilityCode,
): Promise<AuthUser> {
  const user = await currentUser();
  if (
    !user ||
    user.status !== "active" ||
    !user.capabilities.includes(capability)
  ) {
    notFound();
  }
  return user;
}
