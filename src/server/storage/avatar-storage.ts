/**
 * @file Resolución del adaptador `AvatarStorage` según entorno: disco temporal para Playwright E2E,
 * memoria para pruebas unitarias y Neon Object Storage en ejecución normal. Evita acoplar páginas ni
 * operaciones al proveedor concreto.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isValidAvatarKey } from "../profiles/avatar-validation";
import {
  createNeonObjectStorage,
  inferRegionFromEndpoint,
  type AvatarStorage,
  type NeonObjectStorageConfig,
  type StoredObject,
} from "./neon-object-storage";

type CachedStorageEntry = {
  key: string;
  storage: AvatarStorage;
};

const STORAGE_CACHE_SYMBOL = Symbol.for("ad-astra.community.avatar.storage");

type GlobalWithAvatarStorage = typeof globalThis & {
  [STORAGE_CACHE_SYMBOL]?: CachedStorageEntry;
};

/**
 * Resuelve y valida la ruta segura dentro de `baseDir` para operaciones de disco en E2E, bloqueando
 * claves inválidas o intentos de traversal.
 *
 * @param baseDir - Directorio raíz configurado en `AD_ASTRA_AVATAR_TEST_DIR`.
 * @param key - Clave canónica del objeto (`avatars/<uuid>/<uuid>.<ext>`).
 * @returns Rutas absolutas del archivo binario y su fichero JSON de metadatos.
 */
function resolveSafeLocalPaths(
  baseDir: string,
  key: string,
): { filePath: string; metaPath: string } {
  if (!isValidAvatarKey(key)) {
    throw new Error("Invalid avatar object key.");
  }
  const resolvedBase = path.resolve(/*turbopackIgnore: true*/ baseDir);
  const filePath = path.resolve(/*turbopackIgnore: true*/ resolvedBase, ...key.split("/"));
  const relative = path.relative(resolvedBase, filePath);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Avatar object path escapes storage directory.");
  }
  return { filePath, metaPath: `${filePath}.meta.json` };
}

/**
 * Construye un adaptador en memoria para pruebas unitarias aisladas sin sistema de archivos ni red.
 *
 * @returns Implementación `AvatarStorage` respaldada por un `Map`.
 */
export function createMemoryAvatarStorage(): AvatarStorage {
  const objects = new Map<string, StoredObject>();

  return {
    /** Guarda una copia inmutable de los bytes en memoria. */
    async putObject(
      key: string,
      body: Uint8Array,
      contentType: string,
    ): Promise<void> {
      if (!isValidAvatarKey(key)) {
        throw new Error("Invalid avatar object key.");
      }
      objects.set(key, {
        body: new Uint8Array(body),
        contentType,
      });
    },

    /** Recupera los bytes en memoria o devuelve null si falta. */
    async getObject(key: string): Promise<StoredObject | null> {
      if (!isValidAvatarKey(key)) {
        throw new Error("Invalid avatar object key.");
      }
      const entry = objects.get(key);
      if (!entry) return null;
      return {
        body: new Uint8Array(entry.body),
        contentType: entry.contentType,
      };
    },

    /** Elimina la entrada en memoria de forma idempotente. */
    async deleteObject(key: string): Promise<void> {
      if (!isValidAvatarKey(key)) {
        throw new Error("Invalid avatar object key.");
      }
      objects.delete(key);
    },
  };
}

/**
 * Construye un adaptador en sistema de archivos local para recorridos Playwright E2E compartidos entre
 * workers y el servidor Next.js mediante `AD_ASTRA_AVATAR_TEST_DIR`.
 *
 * @param baseDir - Ruta del directorio temporal asignado al conjunto de pruebas.
 * @returns Implementación `AvatarStorage` sobre archivos locales validados.
 */
export function createLocalAvatarStorage(baseDir: string): AvatarStorage {
  mkdirSync(/*turbopackIgnore: true*/ baseDir, { recursive: true });

  return {
    /** Escribe el binario y su tipo MIME en el directorio local seguro. */
    async putObject(
      key: string,
      body: Uint8Array,
      contentType: string,
    ): Promise<void> {
      const { filePath, metaPath } = resolveSafeLocalPaths(baseDir, key);
      mkdirSync(/*turbopackIgnore: true*/ path.dirname(filePath), { recursive: true });
      writeFileSync(/*turbopackIgnore: true*/ filePath, body);
      writeFileSync(/*turbopackIgnore: true*/ metaPath, JSON.stringify({ contentType }), "utf8");
    },

    /** Lee el binario del disco local o devuelve null si no existe. */
    async getObject(key: string): Promise<StoredObject | null> {
      const { filePath, metaPath } = resolveSafeLocalPaths(baseDir, key);
      if (!existsSync(/*turbopackIgnore: true*/ filePath)) {
        return null;
      }
      const body = new Uint8Array(readFileSync(/*turbopackIgnore: true*/ filePath));
      let contentType = "application/octet-stream";
      if (existsSync(/*turbopackIgnore: true*/ metaPath)) {
        try {
          const parsed = JSON.parse(readFileSync(/*turbopackIgnore: true*/ metaPath, "utf8")) as {
            contentType?: unknown;
          };
          if (typeof parsed.contentType === "string" && parsed.contentType.trim()) {
            contentType = parsed.contentType.trim();
          }
        } catch {
          contentType = "application/octet-stream";
        }
      }
      return { body, contentType };
    },

    /** Borra el archivo local y sus metadatos si existen. */
    async deleteObject(key: string): Promise<void> {
      const { filePath, metaPath } = resolveSafeLocalPaths(baseDir, key);
      rmSync(/*turbopackIgnore: true*/ filePath, { force: true });
      rmSync(/*turbopackIgnore: true*/ metaPath, { force: true });
    },
  };
}

/**
 * Extrae y valida la configuración S3 de Neon Object Storage desde variables de entorno. Permite que
 * entornos aún no configurados sigan funcionando sin foto de perfil devolviendo `null`.
 *
 * @param env - Mapa de variables de entorno (por defecto `process.env`).
 * @returns Configuración lista para `createNeonObjectStorage` o `null` si falta algún valor obligatorio.
 */
export function resolveNeonStorageConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): NeonObjectStorageConfig | null {
  const endpoint = env.AWS_ENDPOINT_URL_S3?.trim() ?? "";
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = env.NEON_STORAGE_BUCKET?.trim() ?? "";
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  const region = env.AWS_REGION?.trim() || inferRegionFromEndpoint(endpoint);
  return {
    endpoint,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
  };
}

/**
 * Devuelve la instancia activa de `AvatarStorage` según el entorno actual (disco de pruebas E2E,
 * memoria de tests Node o bucket privado en Neon Object Storage) cacheada por configuración.
 *
 * @returns Adaptador `AvatarStorage` listo para usar, o `null` si no hay almacenamiento configurado.
 */
export function getAvatarStorage(): AvatarStorage | null {
  const globalCache = globalThis as GlobalWithAvatarStorage;

  const testDir = process.env.AD_ASTRA_AVATAR_TEST_DIR?.trim();
  if (testDir) {
    const cacheKey = `local:${testDir}`;
    if (globalCache[STORAGE_CACHE_SYMBOL]?.key === cacheKey) {
      return globalCache[STORAGE_CACHE_SYMBOL].storage;
    }
    const storage = createLocalAvatarStorage(testDir);
    globalCache[STORAGE_CACHE_SYMBOL] = { key: cacheKey, storage };
    return storage;
  }

  if (process.env.NODE_TEST_CONTEXT) {
    const cacheKey = "memory";
    if (globalCache[STORAGE_CACHE_SYMBOL]?.key === cacheKey) {
      return globalCache[STORAGE_CACHE_SYMBOL].storage;
    }
    const storage = createMemoryAvatarStorage();
    globalCache[STORAGE_CACHE_SYMBOL] = { key: cacheKey, storage };
    return storage;
  }

  const config = resolveNeonStorageConfigFromEnv();
  if (!config) {
    return null;
  }

  const secretDigest = createHash("sha256")
    .update(config.secretAccessKey)
    .digest("hex")
    .slice(0, 16);
  const cacheKey = `neon:${config.endpoint}|${config.bucket}|${config.region}|${config.accessKeyId}|${secretDigest}`;
  if (globalCache[STORAGE_CACHE_SYMBOL]?.key === cacheKey) {
    return globalCache[STORAGE_CACHE_SYMBOL].storage;
  }

  const storage = createNeonObjectStorage(config);
  globalCache[STORAGE_CACHE_SYMBOL] = { key: cacheKey, storage };
  return storage;
}
