/**
 * @file Pruebas unitarias del cliente S3 para Neon Object Storage (firma AWS SigV4, direccionamiento
 * path-style y ciclo PUT/GET/DELETE) y del almacenamiento local/memoria usado en pruebas y E2E.
 */

import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  createLocalAvatarStorage,
  createMemoryAvatarStorage,
  resolveNeonStorageConfigFromEnv,
} from "./avatar-storage";
import {
  createNeonObjectStorage,
  encodeS3PathSegment,
  inferRegionFromEndpoint,
  signS3Request,
} from "./neon-object-storage";

/**
 * Calcula un HMAC-SHA256 binario para verificar de forma independiente la derivación de clave SigV4.
 *
 * @param key - Clave secreta o derivada anterior.
 * @param message - Segmento firmado.
 * @returns Digest binario de 32 bytes.
 */
function hmac(key: string | Buffer, message: string): Buffer {
  return createHmac("sha256", key).update(message, "utf8").digest();
}

describe("Neon Object Storage S3 client & avatar storage adapters", () => {
  it("infers region from Neon Storage S3 endpoint and falls back to eu-central-1", () => {
    assert.equal(
      inferRegionFromEndpoint("https://br-cool-star-1234.storage.eu-central-1.aws.neon.tech"),
      "eu-central-1",
    );
    assert.equal(
      inferRegionFromEndpoint("https://br-test.storage.us-east-2.aws.neon.tech/"),
      "us-east-2",
    );
    assert.equal(inferRegionFromEndpoint("https://custom-s3.example.org"), "eu-central-1");
  });

  it("encodes S3 path segments according to RFC 3986 and builds deterministic AWS SigV4 signatures", () => {
    assert.equal(encodeS3PathSegment("foto (1)!.png"), "foto%20%281%29%21.png");

    const now = new Date("2026-11-24T00:05:00.000Z");
    const signed = signS3Request({
      method: "PUT",
      endpoint: "https://br-test.storage.eu-central-1.aws.neon.tech",
      bucket: "ad-astra-avatars",
      key: "avatars/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
      region: "eu-central-1",
      accessKeyId: "nak_live_key",
      secretAccessKey: "nsk_live_secret",
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      contentType: "image/png",
      date: now,
    });

    assert.equal(
      signed.url,
      "https://br-test.storage.eu-central-1.aws.neon.tech/ad-astra-avatars/avatars/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
    );

    const payloadHash = createHash("sha256")
      .update(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
      .digest("hex");
    assert.equal(signed.headers["x-amz-date"], "20261124T000500Z");
    assert.equal(signed.headers["x-amz-content-sha256"], payloadHash);
    assert.equal(signed.headers["Content-Type"], "image/png");

    const canonicalRequest = [
      "PUT",
      "/ad-astra-avatars/avatars/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
      "",
      [
        "content-type:image/png",
        "host:br-test.storage.eu-central-1.aws.neon.tech",
        `x-amz-content-sha256:${payloadHash}`,
        "x-amz-date:20261124T000500Z",
        "",
      ].join("\n"),
      "content-type;host;x-amz-content-sha256;x-amz-date",
      payloadHash,
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      "20261124T000500Z",
      "20261124/eu-central-1/s3/aws4_request",
      createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
    ].join("\n");

    const signingKey = hmac(
      hmac(hmac(hmac("AWS4nsk_live_secret", "20261124"), "eu-central-1"), "s3"),
      "aws4_request",
    );
    const expectedSignature = hmac(signingKey, stringToSign).toString("hex");
    assert.equal(
      signed.headers.Authorization,
      `AWS4-HMAC-SHA256 Credential=nak_live_key/20261124/eu-central-1/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${expectedSignature}`,
    );
    assert.equal("host" in signed.headers, false);
    assert.equal("Host" in signed.headers, false);

    assert.throws(() =>
      signS3Request({
        method: "GET",
        endpoint: "https://br-test.storage.eu-central-1.aws.neon.tech",
        bucket: "ad-astra-avatars",
        key: "avatars/../etc/passwd.png",
        region: "eu-central-1",
        accessKeyId: "nak_live_key",
        secretAccessKey: "nsk_live_secret",
      }),
    );

    const blankTypeSigned = signS3Request({
      method: "PUT",
      endpoint: "https://br-test.storage.eu-central-1.aws.neon.tech",
      bucket: "ad-astra-avatars",
      key: "avatars/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
      region: "eu-central-1",
      accessKeyId: "nak_live_key",
      secretAccessKey: "nsk_live_secret",
      body: new Uint8Array([1, 2, 3]),
      contentType: "   ",
      date: now,
    });
    assert.equal("Content-Type" in blankTypeSigned.headers, false);
  });

  it("performs path-style PUT, GET (200/404/error) and DELETE (204/404/error) against Neon Object Storage", async () => {
    const calls: { url: string; method: string; headers: Record<string, string>; body?: Uint8Array }[] = [];
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const key =
      "avatars/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png";

    let getStatus = 200;
    let deleteStatus = 204;

    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url,
        method,
        headers,
        body: init?.body instanceof Uint8Array ? init.body : undefined,
      });

      if (method === "PUT") {
        return new Response(null, { status: 200 });
      }
      if (method === "GET") {
        if (getStatus === 404) return new Response("Not Found", { status: 404 });
        if (getStatus !== 200) return new Response("Error", { status: getStatus });
        return new Response(Buffer.from(pngBytes), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }
      if (method === "DELETE") {
        if (deleteStatus === 404) return new Response("Not Found", { status: 404 });
        if (deleteStatus !== 204 && deleteStatus !== 200) {
          return new Response("Delete Error", { status: deleteStatus });
        }
        return new Response(null, { status: deleteStatus });
      }
      return new Response(null, { status: 405 });
    }) as typeof fetch;

    const storage = createNeonObjectStorage({
      endpoint: "https://br-example.storage.eu-central-1.aws.neon.tech/",
      bucket: "ad-astra-avatars",
      region: "eu-central-1",
      accessKeyId: "nak_live_123",
      secretAccessKey: "nsk_live_456",
      fetchImpl: fakeFetch,
    });

    await storage.putObject(key, pngBytes, "image/png");
    assert.equal(calls[0].method, "PUT");
    assert.equal(
      calls[0].url,
      `https://br-example.storage.eu-central-1.aws.neon.tech/ad-astra-avatars/${key}`,
    );
    assert.deepEqual(calls[0].body, pngBytes);

    const fetched = await storage.getObject(key);
    assert.ok(fetched);
    assert.equal(fetched.contentType, "image/png");
    assert.deepEqual(fetched.body, pngBytes);

    getStatus = 404;
    assert.equal(await storage.getObject(key), null);

    getStatus = 500;
    await assert.rejects(() => storage.getObject(key));

    await storage.deleteObject(key);
    deleteStatus = 404;
    await storage.deleteObject(key);

    deleteStatus = 502;
    await assert.rejects(() => storage.deleteObject(key));
  });

  it("supports memory and local filesystem test adapters while blocking path traversal", async () => {
    const validKey =
      "avatars/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp";
    const sample = new Uint8Array([1, 2, 3, 4]);

    const mem = createMemoryAvatarStorage();
    await mem.putObject(validKey, sample, "image/webp");
    const memRead = await mem.getObject(validKey);
    assert.deepEqual(memRead, { body: sample, contentType: "image/webp" });
    await mem.deleteObject(validKey);
    assert.equal(await mem.getObject(validKey), null);

    const tempDir = mkdtempSync(path.join(tmpdir(), "ad-astra-avatar-unit-"));
    try {
      const local = createLocalAvatarStorage(tempDir);
      await local.putObject(validKey, sample, "image/webp");
      const localRead = await local.getObject(validKey);
      assert.deepEqual(localRead, { body: sample, contentType: "image/webp" });
      await local.deleteObject(validKey);
      assert.equal(await local.getObject(validKey), null);

      await assert.rejects(() => local.putObject("../../outside.png", sample, "image/png"));
      await assert.rejects(() => local.getObject("avatars/bad-key/file.svg"));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("resolves Neon storage config from env only when all required fields are non-empty", () => {
    assert.equal(resolveNeonStorageConfigFromEnv({}), null);
    assert.equal(
      resolveNeonStorageConfigFromEnv({
        AWS_ENDPOINT_URL_S3: "https://br-1.storage.eu-central-1.aws.neon.tech",
        AWS_ACCESS_KEY_ID: "nak",
        AWS_SECRET_ACCESS_KEY: "nsk",
      }),
      null,
    );

    const cfg = resolveNeonStorageConfigFromEnv({
      AWS_ENDPOINT_URL_S3: " https://br-1.storage.us-east-1.aws.neon.tech ",
      AWS_ACCESS_KEY_ID: " nak_live ",
      AWS_SECRET_ACCESS_KEY: " nsk_live ",
      NEON_STORAGE_BUCKET: " ad-astra-avatars ",
    });
    assert.deepEqual(cfg, {
      endpoint: "https://br-1.storage.us-east-1.aws.neon.tech",
      accessKeyId: "nak_live",
      secretAccessKey: "nsk_live",
      bucket: "ad-astra-avatars",
      region: "us-east-1",
    });
  });
});
