/**
 * @file Endpoint HTTP administrativo (`/api/admin/talent/[id]/avatar`) restringido a cuentas activas
 * con capacidad `talent_consultation` para consultar la foto de una candidatura con perfil de talento.
 */

import {
  buildEmptyNoStoreResponse,
  buildPrivateAvatarResponse,
} from "../../../../../../server/profiles/avatar-http";
import { readTalentAvatarForConsultation } from "../../../../../../server/profiles/operations";

export const dynamic = "force-dynamic";

/**
 * Sirve la foto de una candidatura autorizada por `talent_consultation`. Responde `404` ante falta
 * de sesión, falta de capacidad, ausencia de perfil de talento o falta de imagen.
 *
 * @param _request - Petición HTTP recibida por App Router.
 * @param context - Contexto de ruta dinámica con la promesa `params` que contiene `id`.
 * @returns Respuesta binaria de imagen privada o `404` sin caché.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const avatar = await readTalentAvatarForConsultation(id);
  if (!avatar) {
    return buildEmptyNoStoreResponse(404);
  }
  return buildPrivateAvatarResponse(avatar);
}
