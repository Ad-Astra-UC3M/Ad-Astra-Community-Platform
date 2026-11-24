/** @file Pruebas de la decodificación, normalización y compresión de fotos de perfil. */

import assert from "node:assert/strict";
import { it } from "node:test";
import sharp from "sharp";

import { prepareAvatarImage } from "./avatar-image";
import { AVATAR_MAX_BYTES } from "./avatar-validation";

it("retains the upload size and format restrictions", async () => {
  assert.deepEqual(await prepareAvatarImage(new Uint8Array()), {
    ok: false,
    error: "empty_file",
  });
  assert.deepEqual(await prepareAvatarImage(new Uint8Array(AVATAR_MAX_BYTES + 1)), {
    ok: false,
    error: "file_too_large",
  });
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.deepEqual(await prepareAvatarImage(svg), { ok: false, error: "invalid_image" });
});

it("fully decodes JPEG, PNG and WebP and rejects truncated files with valid headers", async () => {
  const source = sharp({ create: { width: 24, height: 16, channels: 3, background: "#faa321" } });
  for (const format of ["jpeg", "png", "webp"] as const) {
    const valid = await source.clone().toFormat(format).toBuffer();
    const result = await prepareAvatarImage(Uint8Array.from(valid));
    assert.ok(result.ok, `should accept ${format}`);
    const { width, height } = await sharp(result.body).metadata();
    assert.deepEqual({ width, height }, { width: 24, height: 16 });

    for (const end of [Math.floor(valid.length / 2), valid.length - 1]) {
      const truncated = valid.subarray(0, end);
      assert.deepEqual(await prepareAvatarImage(truncated), { ok: false, error: "invalid_image" });
    }
  }
});

it("applies EXIF rotation, fits within 512 pixels and strips uploaded metadata", async () => {
  const jpeg = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#123456" },
  })
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Artist: "avatar test" }, IFD3: { GPSLatitudeRef: "N" } })
    .jpeg()
    .toBuffer();

  const result = await prepareAvatarImage(jpeg);
  assert.ok(result.ok);
  const metadata = await sharp(result.body).metadata();
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
});

it("stores the smaller usable encoding with the corresponding extension and MIME type", async () => {
  const source = sharp({
    create: { width: 256, height: 256, channels: 4, background: "#c08080aa" },
  });
  const input = await source.clone().png().toBuffer();
  const [avif, webp] = await Promise.all([
    source.clone().avif({ quality: 55, effort: 4 }).toBuffer(),
    source.clone().webp({ quality: 80, effort: 4 }).toBuffer(),
  ]);

  const result = await prepareAvatarImage(input);
  assert.ok(result.ok);
  assert.equal(result.body.byteLength, Math.min(avif.byteLength, webp.byteLength));
  assert.equal(result.extension, avif.byteLength < webp.byteLength ? "avif" : "webp");
  assert.equal(result.mimeType, `image/${result.extension}`);
  const metadata = await sharp(result.body).metadata();
  assert.equal(metadata.mediaType, result.mimeType);
  assert.equal(metadata.hasAlpha, true);
});

it("can choose AVIF when it encodes the pixels more compactly than WebP", async () => {
  let state = 127;
  const pixels = Uint8Array.from({ length: 256 * 256 * 3 }, () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state >>> 24;
  });
  const source = sharp(pixels, { raw: { width: 256, height: 256, channels: 3 } });
  const input = await source.clone().png().toBuffer();
  const avif = await source.clone().avif({ quality: 55, effort: 4 }).toBuffer();
  const result = await prepareAvatarImage(input);
  assert.ok(result.ok);
  assert.equal(result.extension, "avif");
  assert.equal(result.mimeType, "image/avif");
  assert.equal(result.body.byteLength, avif.byteLength);
});

it("rejects images whose pixel count exceeds the decoder limit", async () => {
  const large = await sharp({
    create: { width: 5001, height: 5000, channels: 3, background: "#000000" },
  }).png().toBuffer();
  assert.ok(large.byteLength <= AVATAR_MAX_BYTES);
  assert.deepEqual(await prepareAvatarImage(large), { ok: false, error: "invalid_image" });
});

it("rejects animated WebP and PNG while accepting their static formats", async () => {
  const frames = Buffer.concat([Buffer.alloc(8 * 8 * 3, 255), Buffer.alloc(8 * 8 * 3)]);
  const animated = await sharp(frames, { raw: { width: 8, height: 16, channels: 3, pageHeight: 8 } })
    .webp({ delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  assert.deepEqual(await prepareAvatarImage(animated), { ok: false, error: "invalid_image" });

  // APNG con dos fotogramas de 1 × 1, rojo y verde.
  const apng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAABAAAAAQAAAAAAAAAAAAEACgAAWn8w0AAAAAxJREFUeJxj+M/AAAADAQEAyf6S7wAAABpmY1RMAAAAAQAAAAEAAAABAAAAAAAAAAAAAQAKAADBDNoEAAAAEGZkQVQAAAACeJxjYPjPAAACAgEAGz+uYAAAAABJRU5ErkJggg==",
    "base64",
  );
  assert.deepEqual(await prepareAvatarImage(apng), { ok: false, error: "invalid_image" });
});
