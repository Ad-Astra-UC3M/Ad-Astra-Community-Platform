/**
 * @file Pruebas unitarias y de integración con PGlite del manejo de fotos de perfil: validación por
 * bytes mágicos, subida a AvatarStorage, sustitución con borrado del objeto previo, rollback ante
 * fallo en base de datos, retirada y aislamiento en consulta de talento.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";

import { createTestDb, type AppDb } from "../../db/client";
import { avatarDeletions, profiles, talentProfiles } from "../../db/schema";
import { flushAvatarDeletions } from "./avatar-cleanup";
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

const SAMPLE_PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
let SAMPLE_JPEG: Uint8Array;
let SAMPLE_WEBP: Uint8Array;
before(async () => {
  SAMPLE_JPEG = new Uint8Array(await sharp(SAMPLE_PNG).jpeg().toBuffer());
  SAMPLE_WEBP = new Uint8Array(await sharp(SAMPLE_PNG).webp().toBuffer());
});

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
      assert.match(firstUpload.avatarKey, new RegExp(`^avatars/${student.id}/.+\\.(webp|avif)$`));

      const read1 = await readProfileAvatar(student.id, storage, db);
      assert.ok(read1);
      assert.match(read1.contentType, /^image\/(webp|avif)$/);
      assert.ok((await sharp(read1.body).metadata()).width);
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
      assert.match(talentRead.contentType, /^image\/(webp|avif)$/);

      // Replace avatar with WebP -> old PNG object is removed from storage
      const t2 = new Date("2026-11-24T10:05:00Z");
      const secondUpload = await uploadProfileAvatar(student.id, SAMPLE_WEBP, storage, db, t2);
      assert.equal(secondUpload.ok, true);
      if (!secondUpload.ok) return;
      assert.notEqual(secondUpload.avatarKey, firstUpload.avatarKey);
      assert.equal(await storage.getObject(firstUpload.avatarKey), null);

      const read2 = await readProfileAvatar(student.id, storage, db);
      assert.ok(read2);
      assert.match(read2.contentType, /^image\/(webp|avif)$/);
      assert.ok((await sharp(read2.body).metadata()).width);

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
      let transactionCalls = 0;
      failingTxDb.transaction = async (fn, config) => {
        if (transactionCalls++ > 0) throw new Error("Simulated PostgreSQL failure");
        return db.transaction(async (tx) => {
          await fn(tx);
          throw new Error("Simulated PostgreSQL failure");
        }, config);
      };

      await assert.rejects(
        () => uploadProfileAvatar(student.id, SAMPLE_JPEG, trackedStorage, failingTxDb),
        /Simulated PostgreSQL failure/,
      );
      assert.equal(uploadedKeys.length, 1);
      // Si PostgreSQL falla también al limpiar, la tarea queda persistida para el siguiente intento.
      const unavailableDb = Object.create(db) as AppDb;
      unavailableDb.select = () => { throw new Error("Database still unavailable"); };
      assert.equal(await flushAvatarDeletions(unavailableDb, trackedStorage, student.id), false);
      assert.equal((await db.select().from(avatarDeletions)).length, 1);
      assert.equal(await flushAvatarDeletions(db, trackedStorage, student.id), true);
      assert.deepEqual(deletedKeys, uploadedKeys);
      assert.equal(await storage.getObject(uploadedKeys[0]), null);

      const intact = await readProfileAvatar(student.id, storage, db);
      assert.ok(intact);
      assert.match(intact.contentType, /^image\/(webp|avif)$/);
      assert.ok((await sharp(intact.body).metadata()).width);
    } finally {
      await db.close();
    }
  });

  it("keeps failed deletions retryable and reports unavailable storage", async () => {
    const db = await createTestDb();
    try {
      const storage = createMemoryAvatarStorage();
      const student = await createProfile(db);
      const uploaded = await uploadProfileAvatar(student.id, SAMPLE_PNG, storage, db);
      assert.ok(uploaded.ok);
      if (!uploaded.ok) return;
      const failingStorage = { ...storage, async deleteObject() { throw new Error("offline"); } };
      assert.deepEqual(await removeProfileAvatar(student.id, failingStorage, db), { ok: false, error: "cleanup_pending" });
      assert.ok(await storage.getObject(uploaded.avatarKey));
      assert.deepEqual(await removeProfileAvatar(student.id, null, db), { ok: false, error: "cleanup_pending" });
      assert.deepEqual(await removeProfileAvatar(student.id, storage, db), { ok: true, removed: true });
      assert.equal(await storage.getObject(uploaded.avatarKey), null);
    } finally {
      await db.close();
    }
  });

  it("hides the current photo while storage is unconfigured and completes its deletion later", async () => {
    const db = await createTestDb();
    try {
      const storage = createMemoryAvatarStorage();
      const student = await createProfile(db);
      const uploaded = await uploadProfileAvatar(student.id, SAMPLE_PNG, storage, db);
      assert.ok(uploaded.ok);
      if (!uploaded.ok) return;
      assert.deepEqual(await removeProfileAvatar(student.id, null, db), { ok: false, error: "cleanup_pending" });
      assert.equal(await readProfileAvatar(student.id, storage, db), null);
      assert.ok(await storage.getObject(uploaded.avatarKey));
      assert.equal((await db.select().from(avatarDeletions)).length, 1);
      assert.deepEqual(await removeProfileAvatar(student.id, storage, db), { ok: true, removed: true });
      assert.equal(await storage.getObject(uploaded.avatarKey), null);
    } finally { await db.close(); }
  });

  it("preserves failed replacement cleanups and the committed image after a lost commit response", async () => {
    const db = await createTestDb();
    try {
      const storage = createMemoryAvatarStorage();
      const student = await createProfile(db);
      const first = await uploadProfileAvatar(student.id, SAMPLE_PNG, storage, db);
      assert.ok(first.ok);
      if (!first.ok) return;
      const offlineDelete = { ...storage, async deleteObject() { throw new Error("offline"); } };
      const second = await uploadProfileAvatar(student.id, SAMPLE_WEBP, offlineDelete, db);
      assert.ok(second.ok);
      assert.equal((await db.select().from(avatarDeletions)).length, 1);
      assert.ok(await storage.getObject(first.avatarKey));
      await removeProfileAvatar(student.id, storage, db);
      assert.equal((await db.select().from(avatarDeletions)).length, 0);
      assert.equal(await storage.getObject(first.avatarKey), null);

      const uncertainDb = Object.create(db) as AppDb;
      uncertainDb.transaction = async (fn, config) => {
        await db.transaction(fn, config);
        throw new Error("Lost commit response");
      };
      await assert.rejects(uploadProfileAvatar(student.id, SAMPLE_PNG, storage, uncertainDb), /Lost commit response/);
      const current = await readProfileAvatar(student.id, storage, db);
      assert.ok(current, "never compensate by deleting an image still referenced by the committed profile");
      await removeProfileAvatar(student.id, storage, db);
    } finally { await db.close(); }
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
    assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
    assert.equal(ok.headers.get("content-disposition"), "inline");
    assert.equal(ok.headers.get("vary"), "Cookie");
    assert.deepEqual(new Uint8Array(await ok.arrayBuffer()), SAMPLE_PNG);
  });
});
