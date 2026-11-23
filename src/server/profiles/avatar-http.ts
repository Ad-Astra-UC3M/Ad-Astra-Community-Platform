/**
 * @file Utilidades de respuesta HTTP privada compartidas por los endpoints de avatar para evitar
 * duplicación de cabeceras de seguridad y caché.
 */

import { NextResponse } from "next/server";
import type { LoadedProfileAvatar } from "./avatar";

/**
 * Construye una respuesta HTTP vacía con bloqueo de caché (`no-store`) para denegaciones o ausencias.
 *
 * @param status - Código HTTP devuelto (`401` sin sesión o `404` sin recurso ni permiso).
 * @returns `NextResponse` sin cuerpo.
 */
export function buildEmptyNoStoreResponse(status: 401 | 404): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Envuelve los bytes binarios del avatar con cabeceras privadas (`private, max-age=3600`,
 * `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Vary: Cookie`).
 *
 * @param avatar - Carga binaria y tipo MIME seguro recuperados de almacenamiento.
 * @returns `NextResponse` binaria lista para renderizar en `<img>`.
 */
export function buildPrivateAvatarResponse(
  avatar: LoadedProfileAvatar,
): NextResponse {
  return new NextResponse(Buffer.from(avatar.body), {
    status: 200,
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      Vary: "Cookie",
    },
  });
}
