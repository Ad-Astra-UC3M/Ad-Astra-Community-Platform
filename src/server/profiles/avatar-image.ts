/** @file Decodifica y comprime las fotos antes de guardarlas en el almacén privado. */

import { crc32 } from "node:zlib";
import sharp, { type Sharp } from "sharp";

import { validateAvatarBytes, type AvatarMimeType, type AvatarValidationError } from "./avatar-validation";

const AVATAR_MAX_DIMENSION = 512;
const AVATAR_MAX_INPUT_PIXELS = 25_000_000;
const PNG_SIGNATURE_BYTES = 8;
const PNG_CHUNK_OVERHEAD = 12;
const PNG_ANIMATION_CONTROL = 0x6163544c; // acTL
const PNG_END = 0x49454e44; // IEND

export type PreparedAvatarImage =
  | { ok: true; body: Uint8Array; mimeType: "image/avif"; extension: "avif" }
  | { ok: true; body: Uint8Array; mimeType: "image/webp"; extension: "webp" }
  | { ok: false; error: AvatarValidationError };

/**
 * Recorre los bloques de PNG hasta `IEND`. El decodificador puede devolver los píxeles aunque
 * falte el cierre o el archivo incluya fotogramas APNG.
 *
 * @param bytes - Contenido con firma PNG ya validada.
 * @returns Si los bloques tienen CRC válidos y forman un PNG completo sin animación.
 */
function isCompleteStaticPng(bytes: Uint8Array): boolean {
  const png = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE_BYTES;
  while (offset + PNG_CHUNK_OVERHEAD <= png.byteLength) {
    const length = png.getUint32(offset);
    const type = png.getUint32(offset + 4);
    const checksumOffset = offset + 8 + length;
    const nextOffset = checksumOffset + 4;
    if (nextOffset > png.byteLength || type === PNG_ANIMATION_CONTROL) return false;
    if (crc32(bytes.subarray(offset + 4, checksumOffset)) !== png.getUint32(checksumOffset)) return false;
    if (type === PNG_END) return length === 0 && nextOffset === png.byteLength;
    offset = nextOffset;
  }
  return false;
}

/**
 * Comprueba y decodifica JPEG, PNG o WebP. Descarta PNG y WebP animados y normaliza los píxeles
 * a sRGB, con orientación EXIF aplicada y sin ampliar ni recortar la foto.
 *
 * @param bytes - Archivo candidato que cumple el límite de tamaño y la firma binaria.
 * @param mimeType - Formato de entrada detectado por la validación binaria.
 * @returns Una imagen de píxeles sin metadatos lista para codificar, o `null` si falla la lectura.
 */
async function decodeAvatar(bytes: Uint8Array, mimeType: AvatarMimeType): Promise<Sharp | null> {
  if (mimeType === "image/png" && !isCompleteStaticPng(bytes)) return null;
  try {
    const input = sharp(bytes, { failOn: "warning", limitInputPixels: AVATAR_MAX_INPUT_PIXELS });
    const metadata = await input.metadata();
    if (metadata.mediaType !== mimeType || (metadata.pages ?? 1) > 1) return null;

    const { data, info } = await input
      .autoOrient()
      .resize({
        width: AVATAR_MAX_DIMENSION,
        height: AVATAR_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  } catch {
    return null;
  }
}

/**
 * Prepara para `uploadProfileAvatar` la codificación AVIF o WebP de menor tamaño. En empate se
 * elige WebP. El archivo almacenado procede de los píxeles decodificados, sin metadatos de origen.
 *
 * @param bytes - Contenido subido por el titular del perfil.
 * @returns Bytes comprimidos y su formato de almacenamiento, o el código de validación de subida.
 */
export async function prepareAvatarImage(bytes: Uint8Array): Promise<PreparedAvatarImage> {
  const validation = validateAvatarBytes(bytes);
  if (!validation.ok) return validation;

  const image = await decodeAvatar(bytes, validation.mimeType);
  if (!image) return { ok: false, error: "invalid_image" };

  const [avif, webp] = await Promise.all([
    image.clone().avif({ quality: 55, effort: 4 }).toBuffer(),
    image.clone().webp({ quality: 80, effort: 4 }).toBuffer(),
  ]);

  if (avif.byteLength < webp.byteLength) {
    return { ok: true, body: avif, mimeType: "image/avif", extension: "avif" };
  }
  return { ok: true, body: webp, mimeType: "image/webp", extension: "webp" };
}
