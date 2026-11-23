/**
 * @file Cliente S3 minimalista compatible con Neon Object Storage mediante firma AWS Signature Version 4
 * sobre HTTPS y `fetch` nativo de Node 24. Utiliza direccionamiento path-style obligatorio en Neon y no
 * añade dependencias externas de SDK.
 */

import { createHash, createHmac } from "node:crypto";

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
}

export interface AvatarStorage {
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
}

export interface NeonObjectStorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface SignS3RequestParams {
  method: "GET" | "PUT" | "DELETE";
  endpoint: string;
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  body?: Uint8Array;
  contentType?: string;
  date?: Date;
}

export interface SignedS3Request {
  url: string;
  headers: Record<string, string>;
}

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Codifica un segmento de ruta S3 según RFC 3986 (incluyendo `!`, `'`, `(`, `)` y `*`) para que la
 * URI canónica coincida exactamente con la petición HTTP verificada por Neon Object Storage.
 *
 * @param segment - Segmento individual de bucket o clave sin barras.
 * @returns Segmento porcentualmente codificado según reglas SigV4.
 */
export function encodeS3PathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Deduce la región AWS/Neon a partir del host estándar de Neon Object Storage cuando no se especifica
 * `AWS_REGION` explícitamente.
 *
 * @param endpoint - URL base del endpoint S3 (por ejemplo `https://<branch>.storage.eu-central-1.aws.neon.tech`).
 * @returns Identificador de región en minúsculas o `"eu-central-1"` por defecto.
 */
export function inferRegionFromEndpoint(endpoint: string): string {
  const match = /\.storage\.([a-z0-9-]+)\.aws\.neon\.tech/i.exec(endpoint);
  return match ? match[1].toLowerCase() : "eu-central-1";
}

/**
 * Calcula un digest SHA-256 en hexadecimal minúsculas para payloads y solicitudes canónicas.
 *
 * @param input - Bytes binarios o texto UTF-8 a digerir.
 * @returns Suma SHA-256 hexadecimal de 64 caracteres.
 */
function sha256Hex(input: Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Calcula un HMAC-SHA256 binario utilizado en la cadena de derivación de clave AWS SigV4.
 *
 * @param key - Clave secreta inicial (`AWS4...`) o paso intermedio derivado.
 * @param message - Dato firmado en UTF-8.
 * @returns Digest HMAC de 32 bytes.
 */
function hmacSha256(key: string | Buffer, message: string): Buffer {
  return createHmac("sha256", key).update(message, "utf8").digest();
}

/**
 * Construye la URL path-style validada y las cabeceras firmadas mediante AWS SigV4 para una
 * operación S3 individual contra Neon Object Storage.
 *
 * @param params - Método HTTP, credenciales, bucket, clave y carga opcional.
 * @returns URL destino y cabeceras HTTP listas para pasar a `fetch` (sin cabecera manual `Host`).
 */
export function signS3Request(params: SignS3RequestParams): SignedS3Request {
  const endpointUrl = new URL(params.endpoint.trim());
  const isLoopback =
    endpointUrl.hostname === "127.0.0.1" || endpointUrl.hostname === "localhost";
  if (
    endpointUrl.protocol !== "https:" &&
    !(endpointUrl.protocol === "http:" && isLoopback)
  ) {
    throw new Error("Neon Object Storage endpoint must use HTTPS.");
  }

  const bucket = params.bucket.trim();
  if (!bucket || bucket.includes("/")) {
    throw new Error("Invalid Neon Object Storage bucket name.");
  }

  const baseSegments = endpointUrl.pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeS3PathSegment);
  const rawSegments = params.key.split("/").filter((segment) => segment.length > 0);
  if (rawSegments.length === 0 || rawSegments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid S3 object key.");
  }
  const keySegments = rawSegments.map(encodeS3PathSegment);

  const canonicalUri = `/${[...baseSegments, encodeS3PathSegment(bucket), ...keySegments].join("/")}`;
  const targetUrl = new URL(endpointUrl.origin + canonicalUri);
  if (targetUrl.pathname !== canonicalUri) {
    throw new Error("Canonical URI does not match normalized target path.");
  }

  const instant = params.date ?? new Date();
  const amzDate = instant.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = params.body ? sha256Hex(params.body) : EMPTY_SHA256;
  const contentType = params.contentType?.trim() ?? "";

  const headersToSign: Record<string, string> = {
    host: targetUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) {
    headersToSign["content-type"] = contentType;
  }

  const sortedNames = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${headersToSign[name]}\n`)
    .join("");
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [
    params.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const region = params.region.trim() || inferRegionFromEndpoint(params.endpoint);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${params.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const headers: Record<string, string> = {
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return { url: targetUrl.toString(), headers };
}

/**
 * Crea el adaptador `AvatarStorage` respaldado por un bucket privado de Neon Object Storage mediante
 * la API S3 path-style.
 *
 * @param config - Endpoint S3, bucket, región, credenciales y opciones de red/prueba.
 * @returns Implementación `AvatarStorage` con operaciones `putObject`, `getObject` y `deleteObject`.
 */
export function createNeonObjectStorage(
  config: NeonObjectStorageConfig,
): AvatarStorage {
  const fetchFn = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    /** Sube o reemplaza un objeto binario con su Content-Type en el bucket privado. */
    async putObject(
      key: string,
      body: Uint8Array,
      contentType: string,
    ): Promise<void> {
      const signed = signS3Request({
        method: "PUT",
        endpoint: config.endpoint,
        bucket: config.bucket,
        key,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        body,
        contentType,
      });

      const response = await fetchFn(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: new Uint8Array(body),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(
          `Neon Object Storage PUT failed with status ${response.status}.`,
        );
      }
      await response.body?.cancel().catch(() => undefined);
    },

    /** Descarga el objeto indicado del bucket o devuelve null cuando responde 404. */
    async getObject(key: string): Promise<StoredObject | null> {
      const signed = signS3Request({
        method: "GET",
        endpoint: config.endpoint,
        bucket: config.bucket,
        key,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });

      const response = await fetchFn(signed.url, {
        method: "GET",
        headers: signed.headers,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404) {
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(
          `Neon Object Storage GET failed with status ${response.status}.`,
        );
      }

      const body = new Uint8Array(await response.arrayBuffer());
      const contentType =
        response.headers.get("content-type")?.trim() || "application/octet-stream";
      return { body, contentType };
    },

    /** Elimina un objeto del bucket de forma idempotente (200/204/404). */
    async deleteObject(key: string): Promise<void> {
      const signed = signS3Request({
        method: "DELETE",
        endpoint: config.endpoint,
        bucket: config.bucket,
        key,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });

      const response = await fetchFn(signed.url, {
        method: "DELETE",
        headers: signed.headers,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });

      await response.body?.cancel().catch(() => undefined);
      if (
        response.status !== 200 &&
        response.status !== 204 &&
        response.status !== 404
      ) {
        throw new Error(
          `Neon Object Storage DELETE failed with status ${response.status}.`,
        );
      }
    },
  };
}
