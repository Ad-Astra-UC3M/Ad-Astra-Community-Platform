/**
 * @file Validación binaria de fotos de perfil, construcción de claves de objeto y URLs privadas de
 * lectura. Este módulo carece de dependencias exclusivas de Node o `server-only` para reutilizarse
 * desde componentes cliente, Server Components y pruebas unitarias.
 */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarMimeType = (typeof AVATAR_ALLOWED_MIME_TYPES)[number];
export type AvatarExtension = "jpg" | "png" | "webp";

export type AvatarValidationError =
  | "empty_file"
  | "file_too_large"
  | "invalid_image";

export type AvatarValidationResult =
  | { ok: true; mimeType: AvatarMimeType; extension: AvatarExtension }
  | { ok: false; error: AvatarValidationError };

export const AVATAR_KEY_PATTERN =
  /^avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const CONTENT_TYPE_BY_EXT: Record<AvatarExtension, AvatarMimeType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Comprueba si la clave almacenada en `profiles.avatar_key` respeta el formato canónico con UUIDs y
 * extensión de imagen permitida.
 *
 * @param key - Clave candidata en el bucket privado.
 * @returns `true` si la clave cumple `AVATAR_KEY_PATTERN` sin segmentos de recorrido.
 */
export function isValidAvatarKey(key: string): boolean {
  return AVATAR_KEY_PATTERN.test(key);
}

/**
 * Genera una clave de objeto única por subida dentro del prefijo del perfil en Neon Object Storage.
 *
 * @param personId - UUID del perfil propietario de la foto.
 * @param extension - Extensión canónica derivada de la cabecera mágica del archivo.
 * @returns Clave relativa en el bucket con formato `avatars/<personId>/<uuid>.<ext>`.
 */
export function buildAvatarObjectKey(
  personId: string,
  extension: AvatarExtension,
): string {
  const normalizedPersonId = personId.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedPersonId)) {
    throw new Error("Invalid personId for avatar object key.");
  }
  return `avatars/${normalizedPersonId}/${globalThis.crypto.randomUUID().toLowerCase()}.${extension}`;
}

/**
 * Deduce el tipo MIME seguro a partir de la extensión canónica de una clave de avatar validada.
 *
 * @param key - Clave persistida en `profiles.avatar_key`.
 * @returns Tipo MIME permitido para servir el archivo, o `null` si la clave no es válida.
 */
export function contentTypeFromAvatarKey(key: string): AvatarMimeType | null {
  if (!isValidAvatarKey(key)) return null;
  const ext = key.slice(key.lastIndexOf(".") + 1) as AvatarExtension;
  return CONTENT_TYPE_BY_EXT[ext] ?? null;
}

/**
 * Inspecciona los primeros bytes reales de un archivo para identificar JPEG, PNG o WebP y descartar
 * cualquier otro formato (incluidos SVG o HTML) independientemente del `Content-Type` declarado.
 *
 * @param bytes - Contenido binario de la imagen subida.
 * @returns Formato y extensión canónica detectados, o `null` si no coincide con ninguno permitido.
 */
export function detectAvatarFormat(
  bytes: Uint8Array,
): { mimeType: AvatarMimeType; extension: AvatarExtension } | null {
  if (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.byteLength >= PNG_MAGIC.length &&
    PNG_MAGIC.every((byte, idx) => bytes[idx] === byte)
  ) {
    return { mimeType: "image/png", extension: "png" };
  }

  // WebP utiliza contenedor RIFF ("RIFF" + 4 bytes de tamaño + "WEBP")
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  return null;
}

/**
 * Valida tamaño y cabecera mágica de los bytes recibidos antes de persistir en Neon Object Storage.
 *
 * @param bytes - Bytes de la imagen enviada por el titular de la sesión.
 * @returns Tipo MIME y extensión válidos, o el código de error (`empty_file`, `file_too_large` o
 *   `invalid_image`).
 */
export function validateAvatarBytes(bytes: Uint8Array): AvatarValidationResult {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "empty_file" };
  }
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    return { ok: false, error: "file_too_large" };
  }
  const detected = detectAvatarFormat(bytes);
  if (!detected) {
    return { ok: false, error: "invalid_image" };
  }
  return { ok: true, ...detected };
}

/**
 * Convierte una fecha `Date` o texto ISO en milisegundos válidos para busting de caché HTTP.
 *
 * @param value - Marca temporal de `avatarUpdatedAt`.
 * @returns Epoch en milisegundos o `null` si falta o no es válida.
 */
function toEpochMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Construye la URL autenticada propia que sirve la foto de perfil del usuario conectado sin
 * exponer claves de bucket ni enlaces públicos de S3.
 *
 * @param avatarUpdatedAt - Última fecha de actualización de la foto del usuario.
 * @returns Ruta `/api/profile/avatar?v=<epochMs>` o `null` si el perfil no tiene foto.
 */
export function buildOwnAvatarUrl(
  avatarUpdatedAt: Date | string | null | undefined,
): string | null {
  const version = toEpochMs(avatarUpdatedAt);
  return version !== null ? `/api/profile/avatar?v=${version}` : null;
}

/**
 * Construye la URL administrativa protegida por `talent_consultation` para consultar la foto de
 * una candidatura en `/admin/talent` y `/admin/talent/[id]`.
 *
 * @param personId - UUID del titular del perfil de talento.
 * @param avatarUpdatedAt - Última fecha de actualización de su foto de perfil.
 * @returns Ruta `/api/admin/talent/<id>/avatar?v=<epochMs>` o `null` si no hay foto o UUID inválido.
 */
export function buildTalentAvatarUrl(
  personId: string,
  avatarUpdatedAt: Date | string | null | undefined,
): string | null {
  if (!UUID_PATTERN.test(personId.trim())) return null;
  const version = toEpochMs(avatarUpdatedAt);
  if (version === null) return null;
  return `/api/admin/talent/${personId.trim().toLowerCase()}/avatar?v=${version}`;
}
