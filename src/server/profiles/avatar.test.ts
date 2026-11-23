/**
 * @file Pruebas unitarias y de integración con PGlite del manejo de fotos de perfil: validación por
 * bytes mágicos, subida a AvatarStorage, sustitución con borrado del objeto previo, rollback ante
 * fallo en base de datos, retirada y aislamiento en consulta de talento.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";

import { createTestDb, type AppDb } from "../../db/client";
import { profiles, talentProfiles } from "../../db/schema";
import { createMemoryAvatarStorage } from "../storage/avatar-storage";
import type { AvatarStorage } from "../storage/neon-object-storage";
import {
  readProfileAvatar,
  readTalentProfileAvatar,
  removeProfileAvatar,
  uploadProfileAvatar,
} from "./avatar";
import {
  buildEmptyNoStoreResponse,
  buildPrivateAvatarResponse,
} from "./avatar-http";
import {
  AVATAR_MAX_BYTES,
  buildOwnAvatarUrl,
  buildTalentAvatarUrl,
  validateAvatarBytes,
} from "./avatar-validation";

const SAMPLE_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const SAMPLE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const SAMPLE_WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

/**
 * Inserta un perfil mínimo válido en PGlite para ejercitar operaciones de avatar.
 *
 * @param db - Base aislada del caso de prueba.
 * @param overrides - Campos opcionales que sobreescriben los predeterminados.
 * @returns Fila insertada de `public.profiles`.
 */
async function createProfile(
  db: AppDb,
  overrides: Partial<typeof profiles.$inferInsert> = {},
) {
  const suffix = randomUUID().slice(0, 8);
  const now = new Date("2026-11-24T09:00:00Z");
  const [row] = await db
    .insert(profiles)
    .values({
      authUserId: `auth-${suffix}`,
      email: `avatar.${suffix}@alumnos.uc3m.es`,
      firstName: "Marina",
      lastName: "Torres",
      degree: "Ingeniería Aeroespacial",
      course: "3.º",
      privacyAccepted: true,
      privacyVersion: "v1",
      privacyAcceptedAt: now,
      registeredAt: now,
      emailVerifiedAt: now,
      ...overrides,
    })
    .returning();
  return row;
}

describe("profile avatar validation & repository (PostgreSQL + AvatarStorage)", () => {
  it("validates real JPEG/PNG/WebP magic bytes and rejects SVG, HTML, empty or oversized files", () => {
    assert.deepEqual(validateAvatarBytes(SAMPLE_PNG), {
      ok: true,
      mimeType: "image/png",
      extension: "png",
    });
    assert.deepEqual(validateAvatarBytes(SAMPLE_JPEG), {
      ok: true,
      mimeType: "image/jpeg",
      extension: "jpg",
    });
    assert.deepEqual(validateAvatarBytes(SAMPLE_WEBP), {
      ok: true,
      mimeType: "image/webp",
      extension: "webp",
    });

    assert.deepEqual(validateAvatarBytes(new Uint8Array(0)), {
      ok: false,
      error: "empty_file",
    });

    const tooLarge = new Uint8Array(AVATAR_MAX_BYTES + 1);
    tooLarge.set(SAMPLE_PNG, 0);
    assert.deepEqual(validateAvatarBytes(tooLarge), {
      ok: false,
      error: "file_too_large",
    });

    const svgBytes = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    assert.deepEqual(validateAvatarBytes(svgBytes), {
      ok: false,
      error: "invalid_image",
    });

    const textBytes = new TextEncoder().encode("not an image");
    assert.deepEqual(validateAvatarBytes(textBytes), {
      ok: false,
      error: "invalid_image",
    });

    assert.equal(buildOwnAvatarUrl(null), null);
    assert.equal(
      buildOwnAvatarUrl(new Date("2026-11-24T10:00:00Z")),
      `/api/profile/avatar?v=${Date.parse("2026-11-24T10:00:00Z")}`,
    );
    const uid = "11111111-1111-4111-8111-111111111111";
    assert.equal(
      buildTalentAvatarUrl(uid, new Date("2026-11-24T10:00:00Z")),
      `/api/admin/talent/${uid}/avatar?v=${Date.parse("2026-11-24T10:00:00Z")}`,
    );
    assert.equal(buildTalentAvatarUrl("not-a-uuid", new Date()), null);
  });

  it("uploads, reads, replaces (deleting prior object), enforces talent gate, and removes avatars", async () => {
    const db = await createTestDb();
    try {
      const storage = createMemoryAvatarStorage();
      const student = await createProfile(db);

      assert.equal(await readProfileAvatar(student.id, storage, db), null);

      const t1 = new Date("2026-11-24T10:00:00Z");
      const firstUpload = await uploadProfileAvatar(student.id, SAMPLE_PNG, storage, db, t1);
      assert.equal(firstUpload.ok, true);
      if (!firstUpload.ok) return;
      assert.match(firstUpload.avatarKey, new RegExp(`^avatars/${student.id}/.+\\.png$`));

      const read1 = await readProfileAvatar(student.id, storage, db);
      assert.ok(read1);
      assert.equal(read1.contentType, "image/png");
      assert.deepEqual(read1.body, SAMPLE_PNG);
      assert.equal(read1.avatarUpdatedAt.toISOString(), t1.toISOString());

      // Admin talent avatar read is blocked until the profile actually has a talent_profiles row
      assert.equal(await readTalentProfileAvatar(student.id, storage, db), null);
      await db.insert(talentProfiles).values({
        personId: student.id,
        university: "UC3M",
        headline: "GNC",
      });
      const talentRead = await readTalentProfileAvatar(student.id, storage, db);
      assert.ok(talentRead);
      assert.equal(talentRead.contentType, "image/png");

      // Replace avatar with WebP -> old PNG object is removed from storage
      const t2 = new Date("2026-11-24T10:05:00Z");
      const secondUpload = await uploadProfileAvatar(student.id, SAMPLE_WEBP, storage, db, t2);
      assert.equal(secondUpload.ok, true);
      if (!secondUpload.ok) return;
      assert.notEqual(secondUpload.avatarKey, firstUpload.avatarKey);
      assert.equal(await storage.getObject(firstUpload.avatarKey), null);

      const read2 = await readProfileAvatar(student.id, storage, db);
      assert.ok(read2);
      assert.equal(read2.contentType, "image/webp");
      assert.deepEqual(read2.body, SAMPLE_WEBP);

      // Remove avatar clears DB metadata and deletes object from storage; second call is idempotent
      const t3 = new Date("2026-11-24T10:10:00Z");
      const removed = await removeProfileAvatar(student.id, storage, db, t3);
      assert.deepEqual(removed, { ok: true, removed: true });
      assert.equal(await storage.getObject(secondUpload.avatarKey), null);
      assert.equal(await readProfileAvatar(student.id, storage, db), null);

      const [rowAfterRemove] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, student.id));
      assert.equal(rowAfterRemove.avatarKey, null);
      assert.equal(rowAfterRemove.avatarUpdatedAt, null);

      const removedAgain = await removeProfileAvatar(student.id, storage, db, t3);
      assert.deepEqual(removedAgain, { ok: true, removed: false });
    } finally {
      await db.close();
    }
  });

  it("handles missing profile, unconfigured storage, and storage errors cleanly", async () => {
    const db = await createTestDb();
    try {
      const storage = createMemoryAvatarStorage();
      const student = await createProfile(db);

      assert.deepEqual(
        await uploadProfileAvatar("bad-id", SAMPLE_PNG, storage, db),
        { ok: false, error: "missing" },
      );
      assert.deepEqual(
        await uploadProfileAvatar(randomUUID(), SAMPLE_PNG, storage, db),
        { ok: false, error: "missing" },
      );
      assert.deepEqual(
        await uploadProfileAvatar(student.id, SAMPLE_PNG, null, db),
        { ok: false, error: "storage_unavailable" },
      );

      const failingStorage: AvatarStorage = {
        /** Simula fallo de red o credenciales contra Neon Object Storage. */
        async putObject() {
          throw new Error("S3 network timeout");
        },
        /** Sin objetos disponibles en la simulación de fallo. */
        async getObject() {
          return null;
        },
        /** Limpieza simulada sin efecto. */
        async deleteObject() {
          return undefined;
        },
      };

      assert.deepEqual(
        await uploadProfileAvatar(student.id, SAMPLE_JPEG, failingStorage, db),
        { ok: false, error: "storage_error" },
      );

      // Compensating cleanup removes newly uploaded orphan key if DB transaction fails
      const firstUpload = await uploadProfileAvatar(student.id, SAMPLE_PNG, storage, db);
      assert.equal(firstUpload.ok, true);
      if (!firstUpload.ok) return;

      const uploadedKeys: string[] = [];
      const deletedKeys: string[] = [];
      const trackedStorage: AvatarStorage = {
        /** Registra la clave nueva antes de enviarla al almacén en memoria. */
        async putObject(key, body, contentType) {
          uploadedKeys.push(key);
          return storage.putObject(key, body, contentType);
        },
        /** Delega lectura al almacén en memoria. */
        getObject(key) {
          return storage.getObject(key);
        },
        /** Registra la clave eliminada como limpieza compensatoria. */
        async deleteObject(key) {
          deletedKeys.push(key);
          return storage.deleteObject(key);
        },
      };

      const failingTxDb = Object.create(db) as AppDb;
      failingTxDb.transaction = async () => {
        throw new Error("Simulated PostgreSQL failure");
      };

      await assert.rejects(
        () => uploadProfileAvatar(student.id, SAMPLE_JPEG, trackedStorage, failingTxDb),
        /Simulated PostgreSQL failure/,
      );
      assert.equal(uploadedKeys.length, 1);
      assert.deepEqual(deletedKeys, uploadedKeys);
      assert.equal(await storage.getObject(uploadedKeys[0]), null);

      const intact = await readProfileAvatar(student.id, storage, db);
      assert.ok(intact);
      assert.equal(intact.contentType, "image/png");
      assert.deepEqual(intact.body, SAMPLE_PNG);
    } finally {
      await db.close();
    }
  });

  it("builds private HTTP avatar responses with nosniff and no-store error headers", async () => {
    const unauth = buildEmptyNoStoreResponse(401);
    assert.equal(unauth.status, 401);
    assert.equal(unauth.headers.get("cache-control"), "no-store");

    const missing = buildEmptyNoStoreResponse(404);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");

    const ok = buildPrivateAvatarResponse({
      body: SAMPLE_PNG,
      contentType: "image/png",
      avatarUpdatedAt: new Date("2026-11-24T10:00:00Z"),
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "image/png");
    assert.equal(ok.headers.get("cache-control"), "private, max-age=3600");
    assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
    assert.equal(ok.headers.get("content-disposition"), "inline");
    assert.equal(ok.headers.get("vary"), "Cookie");
    assert.deepEqual(new Uint8Array(await ok.arrayBuffer()), SAMPLE_PNG);
  });
});
