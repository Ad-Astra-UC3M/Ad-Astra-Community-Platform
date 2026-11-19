import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { closeDb, createTestDb, getDb, type AppDb } from "./client";
import { runMigrations } from "./migrate";
import {
  accountCapabilities,
  activities,
  activityImages,
  adminAuditLogs,
  bookmarks,
  deletionRequests,
  opportunities,
  participationEvents,
  participations,
  profiles,
  shifts,
  talentDisseminationDecisions,
  talentProfiles,
} from "./schema";
import { bootstrapAdmin } from "../../scripts/bootstrap-admin";

const EXPECTED_MVP_TABLES = [
  "account_capabilities",
  "activities",
  "activity_images",
  "admin_audit_logs",
  "bookmarks",
  "deletion_requests",
  "opportunities",
  "participation_events",
  "participations",
  "profiles",
  "shifts",
  "talent_dissemination_decisions",
  "talent_profiles",
].sort();

async function insertValidProfile(
  db: AppDb,
  overrides: Partial<typeof profiles.$inferInsert> = {},
) {
  const uniqueSuffix = randomUUID().slice(0, 8);
  const [created] = await db
    .insert(profiles)
    .values({
      authUserId: `auth-${uniqueSuffix}`,
      email: `student.${uniqueSuffix}@alumnos.uc3m.es`,
      firstName: "Ana",
      lastName: "García",
      degree: "Ingeniería Aeroespacial",
      course: "3º",
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

describe("PostgreSQL MVP schema (13 tables) on PGlite", () => {
  it("applies drizzle/0000_initial.sql idempotently and creates the exact 13 MVP tables in public", async () => {
    const db = await createTestDb();
    try {
      const result = await db.execute<{ table_name: string }>(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      assert.deepEqual(
        result.rows.map((r) => r.table_name),
        EXPECTED_MVP_TABLES,
      );

      const profile = await insertValidProfile(db, { email: "ana@uc3m.es" });
      await runMigrations(db);

      const after = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, profile.id));
      assert.equal(after.length, 1);
      assert.equal(after[0].email, "ana@uc3m.es");
    } finally {
      await db.close();
    }
  });

  it("enforces profiles auth_user_id nullable uniqueness, UC3M email domain, normalization, privacy and qr_version", async () => {
    const db = await createTestDb();
    try {
      // Multiple NULL auth_user_id rows are allowed
      const p1 = await insertValidProfile(db, {
        authUserId: null,
        email: "uno@uc3m.es",
      });
      const p2 = await insertValidProfile(db, {
        authUserId: null,
        email: "dos@alumnos.uc3m.es",
      });
      const p3 = await insertValidProfile(db, {
        authUserId: "neon-user-1",
        email: "tres@lab.ing.uc3m.es",
      });
      assert.equal(p1.authUserId, null);
      assert.equal(p2.authUserId, null);
      assert.equal(p3.authUserId, "neon-user-1");

      // Duplicate non-null auth_user_id rejected
      await assert.rejects(
        () =>
          insertValidProfile(db, {
            authUserId: "neon-user-1",
            email: "cuatro@uc3m.es",
          }),
      );

      // Non-UC3M domains rejected
      for (const badEmail of [
        "user@gmail.com",
        "user@fakeuc3m.es",
        "user@uc3m.es.evil.com",
        "user@.uc3m.es",
        "user@-alumnos.uc3m.es",
      ]) {
        await assert.rejects(() =>
          insertValidProfile(db, { authUserId: null, email: badEmail }),
        );
      }

      // Uppercase or untrimmed emails rejected
      for (const unnormalized of [
        "Ana@alumnos.uc3m.es",
        " ana@uc3m.es",
        "ana@uc3m.es ",
      ]) {
        await assert.rejects(() =>
          insertValidProfile(db, { authUserId: null, email: unnormalized }),
        );
      }

      // privacy_accepted = false rejected
      await assert.rejects(() =>
        insertValidProfile(db, {
          authUserId: null,
          email: "noprivacy@uc3m.es",
          privacyAccepted: false,
        }),
      );

      // qr_version < 1 rejected
      await assert.rejects(() =>
        insertValidProfile(db, {
          authUserId: null,
          email: "badqr@uc3m.es",
          qrVersion: 0,
        }),
      );
    } finally {
      await db.close();
    }
  });

  it("rejects invalid ENUM values across domain tables", async () => {
    const db = await createTestDb();
    try {
      const profile = await insertValidProfile(db);

      await assert.rejects(() =>
        db.execute(sql`
          INSERT INTO public.account_capabilities (profile_id, capability_code)
          VALUES (${profile.id}::uuid, 'super_admin')
        `),
      );

      await assert.rejects(() =>
        db.execute(sql`
          UPDATE public.profiles
          SET status = 'suspended'
          WHERE id = ${profile.id}::uuid
        `),
      );

      await assert.rejects(() =>
        db.execute(sql`
          INSERT INTO public.activities (slug, title, description, location, status)
          VALUES ('bad-status', 'Test', 'Desc', 'Leganés', 'deleted')
        `),
      );
    } finally {
      await db.close();
    }
  });

  it("enforces admin_audit_logs CHECK constraints for bootstrap and capability actions", async () => {
    const db = await createTestDb();
    try {
      const actor = await insertValidProfile(db);
      const target = await insertValidProfile(db);

      // Valid ordinary capability grant
      await db.insert(adminAuditLogs).values({
        actorProfileId: actor.id,
        targetType: "profile",
        targetId: target.id,
        action: "capability_granted",
        result: "success",
        metadata: { capability: "content_editing" },
      });

      // Valid bootstrap entry with actor_profile_id NULL
      await db.insert(adminAuditLogs).values({
        actorProfileId: null,
        targetType: "profile",
        targetId: target.id,
        action: "capability_granted",
        result: "success",
        metadata: { capability: "general_admin", source: "bootstrap" },
      });

      // NULL actor without source = 'bootstrap' rejected
      await assert.rejects(() =>
        db.insert(adminAuditLogs).values({
          actorProfileId: null,
          targetType: "profile",
          targetId: target.id,
          action: "account_deactivated",
          result: "success",
          metadata: {},
        }),
      );

      // capability_granted with wrong target_type rejected
      await assert.rejects(() =>
        db.insert(adminAuditLogs).values({
          actorProfileId: actor.id,
          targetType: "activity",
          targetId: target.id,
          action: "capability_granted",
          result: "success",
          metadata: { capability: "general_admin" },
        }),
      );

      // capability_revoked with invalid or missing metadata.capability rejected
      await assert.rejects(() =>
        db.insert(adminAuditLogs).values({
          actorProfileId: actor.id,
          targetType: "profile",
          targetId: target.id,
          action: "capability_revoked",
          result: "success",
          metadata: { capability: "unknown_cap" },
        }),
      );

      await assert.rejects(() =>
        db.insert(adminAuditLogs).values({
          actorProfileId: actor.id,
          targetType: "profile",
          targetId: target.id,
          action: "capability_granted",
          result: "success",
          metadata: {},
        }),
      );
    } finally {
      await db.close();
    }
  });

  it("enforces deletion_requests partial unique index and resolution CHECK", async () => {
    const db = await createTestDb();
    try {
      const student = await insertValidProfile(db);
      const admin = await insertValidProfile(db);

      const [req1] = await db
        .insert(deletionRequests)
        .values({
          personId: student.id,
          status: "pending",
          reason: "Deseo retirar mis datos.",
        })
        .returning();

      // Second open request (pending or in_review) rejected
      await assert.rejects(() =>
        db.insert(deletionRequests).values({
          personId: student.id,
          status: "in_review",
          reason: "Duplicada",
        }),
      );

      // Resolving without resolved_by / resolved_at / non-empty resolution_note rejected
      await assert.rejects(() =>
        db
          .update(deletionRequests)
          .set({
            status: "resolved",
            resolutionNote: "   ",
            resolvedBy: admin.id,
            resolvedAt: new Date(),
          })
          .where(eq(deletionRequests.id, req1.id)),
      );

      await assert.rejects(() =>
        db
          .update(deletionRequests)
          .set({
            status: "resolved",
            resolutionNote: "Tramitado.",
            resolvedBy: null,
            resolvedAt: new Date(),
          })
          .where(eq(deletionRequests.id, req1.id)),
      );

      // Proper resolution succeeds
      await db
        .update(deletionRequests)
        .set({
          status: "resolved",
          resolutionNote: "Solicitud tramitada según procedimiento.",
          resolvedBy: admin.id,
          resolvedAt: new Date(),
        })
        .where(eq(deletionRequests.id, req1.id));

      // Once resolved, opening a new request is allowed
      const [req2] = await db
        .insert(deletionRequests)
        .values({
          personId: student.id,
          status: "pending",
          reason: "Nueva solicitud posterior.",
        })
        .returning();
      assert.equal(req2.status, "pending");
    } finally {
      await db.close();
    }
  });

  it("enforces activities, shifts, participations, and participation_events CHECK constraints", async () => {
    const db = await createTestDb();
    try {
      const student = await insertValidProfile(db);
      const organizer = await insertValidProfile(db);

      // Non-HTTPS external_registration_url rejected
      await assert.rejects(() =>
        db.insert(activities).values({
          slug: "bad-url-activity",
          title: "Taller",
          description: "Desc",
          location: "Leganés",
          externalRegistrationUrl: "http://example.com/reg",
        }),
      );

      const [activity] = await db
        .insert(activities)
        .values({
          slug: "cubesat-workshop",
          title: "Taller CubeSat",
          description: "Montaje de subsistemas.",
          location: "Campus Leganés",
          externalRegistrationUrl: "https://adastrauc3m.es/cubesat",
          status: "published",
          createdBy: organizer.id,
          publishedAt: new Date(),
        })
        .returning();

      // Activity images checks
      await db.insert(activityImages).values({
        activityId: activity.id,
        imageUrl: "https://cdn.adastrauc3m.es/cubesat.jpg",
        imageAlt: "Prototipo CubeSat en laboratorio",
        position: 1,
      });

      await assert.rejects(() =>
        db.insert(activityImages).values({
          activityId: activity.id,
          imageUrl: "http://insecure.example/img.jpg",
          imageAlt: "Alt válido",
          position: 2,
        }),
      );

      await assert.rejects(() =>
        db.insert(activityImages).values({
          activityId: activity.id,
          imageUrl: "https://cdn.adastrauc3m.es/2.jpg",
          imageAlt: "   ",
          position: 2,
        }),
      );

      // Shifts defaults & checks
      const [shift1] = await db
        .insert(shifts)
        .values({
          activityId: activity.id,
          startsAt: new Date("2026-12-01T10:00:00Z"),
          endsAt: new Date("2026-12-01T12:00:00Z"),
          capacity: 20,
        })
        .returning();
      assert.equal(shift1.name, "normal");

      const [shift2] = await db
        .insert(shifts)
        .values({
          activityId: activity.id,
          name: "tarde",
          startsAt: new Date("2026-12-01T16:00:00Z"),
          endsAt: new Date("2026-12-01T18:00:00Z"),
          capacity: null,
        })
        .returning();

      await assert.rejects(() =>
        db.insert(shifts).values({
          activityId: activity.id,
          startsAt: new Date("2026-12-01T12:00:00Z"),
          endsAt: new Date("2026-12-01T10:00:00Z"),
        }),
      );

      await assert.rejects(() =>
        db.insert(shifts).values({
          activityId: activity.id,
          startsAt: new Date("2026-12-01T12:00:00Z"),
          endsAt: new Date("2026-12-01T14:00:00Z"),
          capacity: 0,
        }),
      );

      // Participations CHECK
      const [part] = await db
        .insert(participations)
        .values({
          personId: student.id,
          shiftId: shift1.id,
          status: "booked",
        })
        .returning();

      await assert.rejects(() =>
        db
          .update(participations)
          .set({ attendedAt: new Date() })
          .where(eq(participations.id, part.id)),
      );

      await assert.rejects(() =>
        db
          .update(participations)
          .set({ status: "attended", attendedAt: null })
          .where(eq(participations.id, part.id)),
      );

      // participation_events valid events
      await db.insert(participationEvents).values([
        {
          participationId: part.id,
          personId: student.id,
          actorProfileId: student.id,
          shiftId: shift1.id,
          eventType: "reserved",
        },
        {
          participationId: part.id,
          personId: student.id,
          actorProfileId: student.id,
          shiftId: shift2.id,
          fromShiftId: shift1.id,
          eventType: "changed",
        },
        {
          participationId: part.id,
          personId: student.id,
          actorProfileId: organizer.id,
          shiftId: shift2.id,
          eventType: "attendance_manual",
          reason: "Confirmación manual por incidencia de lector.",
        },
        {
          participationId: part.id,
          personId: student.id,
          actorProfileId: organizer.id,
          shiftId: shift2.id,
          eventType: "attendance_corrected",
          previousStatus: "attended",
          newStatus: "booked",
          reason: "Escaneo accidental de turno equivocado.",
        },
      ]);

      // Invalid participation_events rejected
      // 1. changed with same shift
      await assert.rejects(() =>
        db.insert(participationEvents).values({
          participationId: part.id,
          personId: student.id,
          actorProfileId: student.id,
          shiftId: shift1.id,
          fromShiftId: shift1.id,
          eventType: "changed",
        }),
      );

      // 2. reserved with from_shift_id set
      await assert.rejects(() =>
        db.insert(participationEvents).values({
          participationId: part.id,
          personId: student.id,
          actorProfileId: student.id,
          shiftId: shift2.id,
          fromShiftId: shift1.id,
          eventType: "reserved",
        }),
      );

      // 3. door_registered without reason
      await assert.rejects(() =>
        db.insert(participationEvents).values({
          participationId: part.id,
          personId: student.id,
          actorProfileId: organizer.id,
          shiftId: shift2.id,
          eventType: "door_registered",
          reason: "   ",
        }),
      );

      // 4. attendance_corrected with same previous/new status
      await assert.rejects(() =>
        db.insert(participationEvents).values({
          participationId: part.id,
          personId: student.id,
          actorProfileId: organizer.id,
          shiftId: shift2.id,
          eventType: "attendance_corrected",
          previousStatus: "booked",
          newStatus: "booked",
          reason: "Sin cambio real",
        }),
      );

      // 5. attendance_qr with previous_status set
      await assert.rejects(() =>
        db.insert(participationEvents).values({
          participationId: part.id,
          personId: student.id,
          actorProfileId: organizer.id,
          shiftId: shift2.id,
          eventType: "attendance_qr",
          previousStatus: "booked",
          newStatus: "attended",
        }),
      );

      // Cancellation history survives participation deletion
      await db.delete(participations).where(eq(participations.id, part.id));
      await db.insert(participationEvents).values({
        participationId: part.id,
        personId: student.id,
        actorProfileId: student.id,
        shiftId: shift2.id,
        eventType: "cancelled",
      });
      const events = await db
        .select()
        .from(participationEvents)
        .where(eq(participationEvents.participationId, part.id));
      assert.equal(events.length, 5);
    } finally {
      await db.close();
    }
  });

  it("enforces opportunities CHECK constraints and bookmarks composite PK", async () => {
    const db = await createTestDb();
    try {
      const student = await insertValidProfile(db);

      // Published opportunity without application_url or contact_email rejected
      await assert.rejects(() =>
        db.insert(opportunities).values({
          slug: "no-contact",
          type: "internship",
          title: "Prácticas sin contacto",
          organization: "Ad Astra",
          description: "Desc",
          status: "published",
        }),
      );

      // image_url without image_alt rejected
      await assert.rejects(() =>
        db.insert(opportunities).values({
          slug: "no-alt",
          type: "research",
          title: "Investigación sin alt",
          organization: "UC3M",
          description: "Desc",
          imageUrl: "https://cdn.adastrauc3m.es/lab.png",
          imageAlt: "",
          status: "draft",
        }),
      );

      const [opp] = await db
        .insert(opportunities)
        .values({
          slug: "esa-internship",
          type: "internship",
          title: "Prácticas de propulsión",
          organization: "ESA Partner",
          description: "Desarrollo de toberas.",
          applicationUrl: "https://example.org/apply",
          imageUrl: "https://example.org/banner.png",
          imageAlt: "Banco de ensayos de propulsión",
          status: "published",
          publishedAt: new Date(),
        })
        .returning();

      await db.insert(bookmarks).values({
        personId: student.id,
        opportunityId: opp.id,
      });

      // Duplicate bookmark rejected
      await assert.rejects(() =>
        db.insert(bookmarks).values({
          personId: student.id,
          opportunityId: opp.id,
        }),
      );
    } finally {
      await db.close();
    }
  });

  it("enforces talent_profiles JSONB CHECK functions and creates all 5 GIN indexes", async () => {
    const db = await createTestDb();
    try {
      const student = await insertValidProfile(db);

      // Verify all 5 GIN indexes exist
      const idxResult = await db.execute<{ indexname: string; indexdef: string }>(sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'talent_profiles'
      `);
      const ginIndexes = idxResult.rows.filter((r) =>
        r.indexdef.toLowerCase().includes("using gin"),
      );
      assert.equal(ginIndexes.length, 5);
      for (const col of [
        "skills",
        "tools",
        "interests",
        "sectors",
        "opportunity_types",
      ]) {
        assert.ok(
          ginIndexes.some((idx) => idx.indexdef.includes(`(${col})`)),
          `Expected GIN index on talent_profiles.${col}`,
        );
      }

      // Valid talent_profiles row accepted
      await db.insert(talentProfiles).values({
        personId: student.id,
        university: "Universidad Carlos III de Madrid",
        expectedGraduationYear: 2027,
        headline: "Estudiante de Aeroespacial · Propulsión y GNC",
        skills: ["python", "matlab", "cfd"],
        tools: ["ansys", "git"],
        interests: ["propulsion", "cubesats"],
        sectors: ["space"],
        opportunityTypes: ["internship", "research"],
        experiences: [
          {
            kind: "team",
            title: "Ingeniera de propulsión",
            organization: "Ad Astra UC3M",
            description: "Diseño y ensayos en banco estático.",
            is_featured: true,
            sort_order: 0,
          },
          {
            kind: "project",
            title: "Simulador 6-DOF",
            organization: null,
            description: "Simulador de trayectoria en Python.",
            is_featured: false,
            sort_order: 1,
          },
        ],
        languages: [
          { language: "Español", level: "Nativo" },
          { language: "Inglés", level: "C1" },
        ],
        links: [
          { kind: "github", label: "GitHub", url: "https://github.com/ana" },
          { kind: "cv", label: "CV", url: "http://portfolio.example.com/cv.pdf" },
        ],
      });

      // GIN array containment query works
      const matched = await db
        .select()
        .from(talentProfiles)
        .where(sql`${talentProfiles.skills} @> ARRAY['python']::text[]`);
      assert.equal(matched.length, 1);

      // javascript: link rejected
      await assert.rejects(() =>
        db
          .update(talentProfiles)
          .set({
            links: [
              { kind: "other", label: "XSS", url: "javascript:alert(1)" },
            ],
          })
          .where(eq(talentProfiles.personId, student.id)),
      );

      // Duplicate normalized language rejected
      await assert.rejects(() =>
        db
          .update(talentProfiles)
          .set({
            languages: [
              { language: "Inglés", level: "B2" },
              { language: " inglés ", level: "C1" },
            ],
          })
          .where(eq(talentProfiles.personId, student.id)),
      );

      // Invalid experience shape rejected (bad kind & missing fields)
      await assert.rejects(() =>
        db
          .update(talentProfiles)
          .set({
            experiences: [
              {
                // @ts-expect-error testing DB CHECK constraint with invalid kind
                kind: "hobby",
                title: "Inválido",
                organization: null,
                description: null,
                is_featured: false,
                sort_order: 0,
              },
            ],
          })
          .where(eq(talentProfiles.personId, student.id)),
      );

      await assert.rejects(() =>
        db.execute(sql`
          UPDATE public.talent_profiles
          SET experiences = '[{"kind": "work"}]'::jsonb
          WHERE person_id = ${student.id}::uuid
        `),
      );

      // Talent dissemination decisions append-only history
      await db.insert(talentDisseminationDecisions).values([
        {
          personId: student.id,
          purpose: "internal_and_future_talent_sharing",
          granted: true,
          policyVersion: "talent-diffusion-v1",
        },
        {
          personId: student.id,
          purpose: "internal_and_future_talent_sharing",
          granted: false,
          policyVersion: "talent-diffusion-v1",
        },
      ]);
      const decisions = await db
        .select()
        .from(talentDisseminationDecisions)
        .where(eq(talentDisseminationDecisions.personId, student.id));
      assert.equal(decisions.length, 2);
    } finally {
      await db.close();
    }
  });

  it("executes bootstrapAdmin safely and idempotently in a single transaction", async () => {
    const db = await createTestDb();
    try {
      // Missing profile rejected
      await assert.rejects(() =>
        bootstrapAdmin(db, "missing@uc3m.es"),
      );

      // Unlinked profile rejected
      await insertValidProfile(db, {
        authUserId: null,
        email: "unlinked@uc3m.es",
        emailVerifiedAt: new Date(),
      });
      await assert.rejects(() =>
        bootstrapAdmin(db, "unlinked@uc3m.es"),
      );

      // Unverified profile rejected
      await insertValidProfile(db, {
        authUserId: "auth-unverified",
        email: "unverified@uc3m.es",
        emailVerifiedAt: null,
      });
      await assert.rejects(() =>
        bootstrapAdmin(db, "unverified@uc3m.es"),
      );

      // Deactivated profile rejected
      await insertValidProfile(db, {
        authUserId: "auth-deactivated",
        email: "deactivated@uc3m.es",
        status: "deactivated",
        deactivatedAt: new Date(),
        emailVerifiedAt: new Date(),
      });
      await assert.rejects(() =>
        bootstrapAdmin(db, "deactivated@uc3m.es"),
      );

      // Active, linked, verified profile succeeds (case/whitespace insensitive input)
      const adminProfile = await insertValidProfile(db, {
        authUserId: "auth-admin-1",
        email: "responsable.it@uc3m.es",
        emailVerifiedAt: new Date(),
      });

      const first = await bootstrapAdmin(db, "  Responsable.IT@uc3m.es ");
      assert.equal(first.granted, true);
      assert.equal(first.alreadyHadCapability, false);
      assert.equal(first.profileId, adminProfile.id);

      // Second call is idempotent and does NOT duplicate audit log
      const second = await bootstrapAdmin(db, "responsable.it@uc3m.es");
      assert.equal(second.granted, false);
      assert.equal(second.alreadyHadCapability, true);
      assert.equal(second.profileId, adminProfile.id);

      const caps = await db
        .select()
        .from(accountCapabilities)
        .where(
          and(
            eq(accountCapabilities.profileId, adminProfile.id),
            eq(accountCapabilities.capabilityCode, "general_admin"),
          ),
        );
      assert.equal(caps.length, 1);
      assert.equal(caps[0].grantedBy, null);

      const audits = await db
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.targetId, adminProfile.id));
      assert.equal(audits.length, 1);
      assert.equal(audits[0].actorProfileId, null);
      assert.equal(audits[0].targetType, "profile");
      assert.equal(audits[0].action, "capability_granted");
      assert.deepEqual(audits[0].metadata, {
        capability: "general_admin",
        source: "bootstrap",
      });
    } finally {
      await db.close();
    }
  });

  it("provides a migrated PGlite database via getDb() under NODE_TEST_CONTEXT", async () => {
    try {
      const db = await getDb();
      const res = await db.execute<{ ok: number }>(sql`SELECT 1 AS ok`);
      assert.equal(res.rows[0].ok, 1);
    } finally {
      await closeDb();
    }
  });
});
