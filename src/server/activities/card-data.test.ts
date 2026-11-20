import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";

import { createTestDb, type AppDb } from "../../db/client";
import { profiles } from "../../db/schema";
import {
  getCardVersion,
  issueCard,
  readCard,
  reissueCard,
  verifyCard,
} from "./card-data";

async function insertProfile(
  db: AppDb,
  overrides: Partial<typeof profiles.$inferInsert> = {},
) {
  const suffix = randomUUID().slice(0, 8);
  const [created] = await db
    .insert(profiles)
    .values({
      authUserId: `auth-${suffix}`,
      email: `card.${suffix}@alumnos.uc3m.es`,
      firstName: "Elena",
      lastName: "Martín",
      degree: "Ingeniería Aeroespacial",
      course: "3.º",
      privacyAccepted: true,
      privacyVersion: "v1",
      privacyAcceptedAt: new Date("2026-11-19T10:00:00Z"),
      registeredAt: new Date("2026-11-19T10:00:00Z"),
      emailVerifiedAt: new Date("2026-11-19T10:05:00Z"),
      ...overrides,
    })
    .returning();
  return created;
}

describe("attendance-card service (PostgreSQL + jose HS256)", () => {
  it("issues, verifies, reads and reissues QR cards backed by public.profiles.qr_version", async () => {
    const db = await createTestDb();
    try {
      const profile = await insertProfile(db);

      assert.equal(await getCardVersion(profile.id, db), 1);

      const issued = await issueCard(profile.id, db);
      assert.equal(issued.version, 1);
      assert.equal(await verifyCard(issued.token, db), profile.id);
      assert.equal(await readCard(issued.token, db), profile.id);

      const reissued = await reissueCard(profile.id, db);
      assert.equal(reissued.version, 2);
      assert.notEqual(reissued.token, issued.token);
      assert.equal(await getCardVersion(profile.id, db), 2);

      // Previous version token is immediately invalidated.
      assert.equal(await verifyCard(issued.token, db), null);
      assert.equal(await verifyCard(reissued.token, db), profile.id);
    } finally {
      await db.close();
    }
  });

  it("rejects deactivated, unlinked, and unverified profiles (CA-09)", async () => {
    const db = await createTestDb();
    try {
      const activeProfile = await insertProfile(db);
      const { token } = await issueCard(activeProfile.id, db);
      assert.equal(await verifyCard(token, db), activeProfile.id);

      // Deactivate profile -> token immediately rejected.
      await db
        .update(profiles)
        .set({ status: "deactivated", deactivatedAt: new Date() })
        .where(eq(profiles.id, activeProfile.id));
      assert.equal(await verifyCard(token, db), null);
      await assert.rejects(() => issueCard(activeProfile.id, db));
      await assert.rejects(() => reissueCard(activeProfile.id, db));

      // Unlinked profile (authUserId === null) -> cannot issue or verify.
      const unlinked = await insertProfile(db, {
        authUserId: null,
        emailVerifiedAt: null,
      });
      await assert.rejects(() => issueCard(unlinked.id, db));

      // Unverified profile (emailVerifiedAt === null) -> cannot issue or verify.
      const unverified = await insertProfile(db, {
        emailVerifiedAt: null,
      });
      await assert.rejects(() => issueCard(unverified.id, db));

      // Even if a token was issued before emailVerifiedAt was cleared, verifyCard rejects it.
      const verifiedProfile = await insertProfile(db);
      const verifiedCard = await issueCard(verifiedProfile.id, db);
      await db
        .update(profiles)
        .set({ emailVerifiedAt: null })
        .where(eq(profiles.id, verifiedProfile.id));
      assert.equal(await verifyCard(verifiedCard.token, db), null);

      await db
        .update(profiles)
        .set({ emailVerifiedAt: new Date(), authUserId: null })
        .where(eq(profiles.id, verifiedProfile.id));
      assert.equal(await verifyCard(verifiedCard.token, db), null);
    } finally {
      await db.close();
    }
  });

  it("rejects tampered tokens, wrong audience/issuer, wrong secret, and non-UUID sub", async () => {
    const db = await createTestDb();
    const prevSecret = process.env.ATTENDANCE_QR_SECRET;
    const prevOrigin = process.env.APP_ORIGIN;
    const secret = "test-attendance-qr-secret-0123456789abcdef";
    process.env.ATTENDANCE_QR_SECRET = secret;
    process.env.APP_ORIGIN = "https://comunidad.adastrauc3m.es";
    try {
      const profile = await insertProfile(db);
      const key = new TextEncoder().encode(secret);

      const valid = await issueCard(profile.id, db);
      assert.equal(await verifyCard(valid.token, db), profile.id);

      // Tampered signature
      assert.equal(await verifyCard(`${valid.token}x`, db), null);
      // Oversized token
      assert.equal(await verifyCard("a".repeat(2049), db), null);
      // Missing profile UUID
      assert.equal(await getCardVersion(randomUUID(), db), null);

      // Wrong audience
      const wrongAud = await new SignJWT({ version: 1 })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("https://comunidad.adastrauc3m.es")
        .setAudience("other-aud")
        .setSubject(profile.id)
        .sign(key);
      assert.equal(await verifyCard(wrongAud, db), null);

      // Wrong issuer
      const wrongIss = await new SignJWT({ version: 1 })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("https://evil.example")
        .setAudience("attendance")
        .setSubject(profile.id)
        .sign(key);
      assert.equal(await verifyCard(wrongIss, db), null);

      // Wrong signing key
      const wrongKeyToken = await new SignJWT({ version: 1 })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("https://comunidad.adastrauc3m.es")
        .setAudience("attendance")
        .setSubject(profile.id)
        .sign(new TextEncoder().encode("another-secret-key-at-least-32-chars-long"));
      assert.equal(await verifyCard(wrongKeyToken, db), null);

      // Non-UUID subject
      const badSub = await new SignJWT({ version: 1 })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("https://comunidad.adastrauc3m.es")
        .setAudience("attendance")
        .setSubject("not-a-uuid")
        .sign(key);
      assert.equal(await verifyCard(badSub, db), null);
    } finally {
      if (prevSecret === undefined) delete process.env.ATTENDANCE_QR_SECRET;
      else process.env.ATTENDANCE_QR_SECRET = prevSecret;
      if (prevOrigin === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = prevOrigin;
      await db.close();
    }
  });

  it("enforces ATTENDANCE_QR_SECRET length >= 32 and requires it outside test mode", async () => {
    const db = await createTestDb();
    const prevSecret = process.env.ATTENDANCE_QR_SECRET;
    const prevTestCtx = process.env.NODE_TEST_CONTEXT;
    const prevTestAuth = process.env.AD_ASTRA_TEST_AUTH;
    try {
      const profile = await insertProfile(db);

      // Too short secret is rejected even in test context.
      process.env.ATTENDANCE_QR_SECRET = "too-short-secret";
      await assert.rejects(() => issueCard(profile.id, db), /32/);

      // Missing secret outside test mode throws.
      delete process.env.ATTENDANCE_QR_SECRET;
      delete process.env.NODE_TEST_CONTEXT;
      delete process.env.AD_ASTRA_TEST_AUTH;
      await assert.rejects(() => issueCard(profile.id, db), /ATTENDANCE_QR_SECRET/);
    } finally {
      if (prevSecret === undefined) delete process.env.ATTENDANCE_QR_SECRET;
      else process.env.ATTENDANCE_QR_SECRET = prevSecret;
      if (prevTestCtx === undefined) delete process.env.NODE_TEST_CONTEXT;
      else process.env.NODE_TEST_CONTEXT = prevTestCtx;
      if (prevTestAuth === undefined) delete process.env.AD_ASTRA_TEST_AUTH;
      else process.env.AD_ASTRA_TEST_AUTH = prevTestAuth;
      await db.close();
    }
  });

  it("blocks the test QR secret fallback whenever NEON_AUTH_BASE_URL is configured", async () => {
    const db = await createTestDb();
    const prevSecret = process.env.ATTENDANCE_QR_SECRET;
    const prevNeonAuth = process.env.NEON_AUTH_BASE_URL;
    const prevTestAuth = process.env.AD_ASTRA_TEST_AUTH;
    try {
      const profile = await insertProfile(db);
      // Issue a valid token using the test fallback before NEON_AUTH_BASE_URL is set.
      delete process.env.ATTENDANCE_QR_SECRET;
      delete process.env.NEON_AUTH_BASE_URL;
      const fallbackCard = await issueCard(profile.id, db);
      assert.equal(await verifyCard(fallbackCard.token, db), profile.id);

      // Once NEON_AUTH_BASE_URL is configured, missing ATTENDANCE_QR_SECRET must throw
      // for both issueCard and verifyCard even if AD_ASTRA_TEST_AUTH=1 and NODE_TEST_CONTEXT are set.
      process.env.NEON_AUTH_BASE_URL = "https://ep-test.neonauth.eu-central-1.aws.neon.tech/neondb/auth";
      process.env.AD_ASTRA_TEST_AUTH = "1";
      await assert.rejects(() => issueCard(profile.id, db), /ATTENDANCE_QR_SECRET/);
      await assert.rejects(() => verifyCard(fallbackCard.token, db), /ATTENDANCE_QR_SECRET/);
    } finally {
      if (prevSecret === undefined) delete process.env.ATTENDANCE_QR_SECRET;
      else process.env.ATTENDANCE_QR_SECRET = prevSecret;
      if (prevNeonAuth === undefined) delete process.env.NEON_AUTH_BASE_URL;
      else process.env.NEON_AUTH_BASE_URL = prevNeonAuth;
      if (prevTestAuth === undefined) delete process.env.AD_ASTRA_TEST_AUTH;
      else process.env.AD_ASTRA_TEST_AUTH = prevTestAuth;
      await db.close();
    }
  });
});
