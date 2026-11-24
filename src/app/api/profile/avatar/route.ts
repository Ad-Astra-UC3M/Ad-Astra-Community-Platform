/**
 * @file Endpoint HTTP privado (`/api/profile/avatar`) que sirve la foto de perfil de la sesión
 * activa desde Neon Object Storage con cabeceras de caché privada y `nosniff`.
 */

import {
  buildEmptyNoStoreResponse,
  buildPrivateAvatarResponse,
} from "../../../../server/profiles/avatar-http";
import { readMyProfileAvatar } from "../../../../server/profiles/operations";

export const dynamic = "force-dynamic";

/**
 * Sirve la foto de perfil propia al titular autenticado (`401` sin sesión, `404` si no hay avatar
 * guardado o falta configuración de almacenamiento).
 *
 * @returns Respuesta binaria de imagen o estado `401`/`404` sin contenido en caché.
 */
export async function GET() {
  const result = await readMyProfileAvatar();
  if (!result.authenticated) {
    return buildEmptyNoStoreResponse(401);
  }
  if (!result.avatar) {
    return buildEmptyNoStoreResponse(404);
  }
  return buildPrivateAvatarResponse(result.avatar);
}
