import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";

import { createTestDb, type AppDb } from "../../db/client";
import { adminAuditLogs, bookmarks, profiles } from "../../db/schema";
import {
  createOpportunity,
  getOpportunity,
  listBookmarks,
  listOpportunities,
  removeBookmark,
  saveBookmark,
  updateOpportunityStatus,
} from "./opportunities";

const BASE_NOW = new Date("2026-11-20T10:00:00Z");

async function createProfile(
  db: AppDb,
  overrides: Partial<typeof profiles.$inferInsert> = {},
) {
  const suffix = randomUUID().slice(0, 8);
  const [profile] = await db
    .insert(profiles)
    .values({
      authUserId: `auth-${suffix}`,
      email: `student.${suffix}@alumnos.uc3m.es`,
      firstName: "Lucía",
      lastName: "Pérez",
      degree: "Ingeniería Aeroespacial",
      course: "4º",
      privacyAccepted: true,
      privacyVersion: "v1",
      privacyAcceptedAt: BASE_NOW,
      registeredAt: BASE_NOW,
      emailVerifiedAt: BASE_NOW,
      ...overrides,
    })
    .returning();
  return profile;
}

describe("opportunities PostgreSQL repository (CA-05)", () => {
  it("publica prácticas e investigación con y sin imagen y exige invariantes HTTPS, imageAlt y medio externo al publicar", async () => {
    const db = await createTestDb();
    try {
      const editor = await createProfile(db, { email: "editor@uc3m.es" });
      const student = await createProfile(db);

      const internship = await createOpportunity(
        {
          slug: "practicas-dinamica-vuelo",
          type: "internship",
          title: "Prácticas en dinámica de vuelo",
          organization: "Estela Aeroespacial",
          description: "Simulación de órbitas bajas y análisis de telemetría.",
          requirements: "Python o MATLAB y nivel B2 de inglés.",
          location: "Tres Cantos, Madrid",
          workModality: "Híbrida",
          applicationUrl: "https://estela-aero.example/apply/flight-dynamics",
          deadlineAt: new Date("2026-12-20T23:59:00Z"),
          status: "published",
        },
        editor.id,
        db,
      );
      assert.equal(internship.ok, true);
      if (internship.ok) {
        assert.equal(internship.opportunity.slug, "practicas-dinamica-vuelo");
        assert.equal(internship.opportunity.type, "internship");
        assert.equal(internship.opportunity.imageUrl, null);
        assert.equal(internship.opportunity.imageAlt, null);
        assert.equal(internship.opportunity.status, "published");
        assert.ok(internship.opportunity.publishedAt instanceof Date);
      }

      const research = await createOpportunity(
        {
          slug: "investigacion-propulsion-electrica",
          type: "research",
          title: "Colaboración en propulsión eléctrica",
          organization: "Grupo EP2 · UC3M",
          description: "Diagnóstico de plasma y calibración de sensores de empuje.",
          requirements: "Disponibilidad 8 h/semana en Leganés.",
          location: "Campus de Leganés",
          workModality: "Presencial",
          researchLead: "Dra. Elena Navarro",
          contactEmail: "EP2@uc3m.example",
          imageUrl: "https://ep2.uc3m.example/media/lab.webp",
          imageAlt: "Banco de ensayos de propulsión eléctrica",
          infoUrl: "https://ep2.uc3m.example/lineas/propulsion",
          status: "published",
        },
        editor.id,
        db,
      );
      assert.equal(research.ok, true);
      if (research.ok) {
        assert.equal(research.opportunity.type, "research");
        assert.equal(research.opportunity.contactEmail, "ep2@uc3m.example");
        assert.equal(research.opportunity.researchLead, "Dra. Elena Navarro");
        assert.equal(research.opportunity.imageUrl, "https://ep2.uc3m.example/media/lab.webp");
        assert.equal(research.opportunity.imageAlt, "Banco de ensayos de propulsión eléctrica");
        assert.equal(research.opportunity.infoUrl, "https://ep2.uc3m.example/lineas/propulsion");
      }

      // Validaciones negativas (RF-08 / CA-05)
      assert.deepEqual(
        await createOpportunity(
          {
            type: "research",
            title: "Sin alt",
            organization: "UC3M",
            description: "Descripción válida.",
            contactEmail: "lab@uc3m.example",
            imageUrl: "https://uc3m.example/lab.jpg",
            imageAlt: "   ",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "missing_image_alt" },
      );

      assert.deepEqual(
        await createOpportunity(
          {
            type: "internship",
            title: "Solo infoUrl",
            organization: "Empresa",
            description: "No tiene solicitud ni correo.",
            infoUrl: "https://empresa.example/info",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "missing_contact" },
      );

      assert.deepEqual(
        await createOpportunity(
          {
            type: "internship",
            title: "Solicitud HTTP",
            organization: "Empresa",
            description: "URL no segura.",
            applicationUrl: "http://empresa.example/apply",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "invalid_application_url" },
      );

      assert.deepEqual(
        await createOpportunity(
          {
            type: "internship",
            title: "Info ejecutable",
            organization: "Empresa",
            description: "Rechaza javascript:.",
            contactEmail: "jobs@empresa.example",
            infoUrl: "javascript:alert(1)",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "invalid_info_url" },
      );

      assert.deepEqual(
        await createOpportunity(
          {
            type: "research",
            title: "Imagen HTTP",
            organization: "UC3M",
            description: "Rechaza imagen no HTTPS.",
            contactEmail: "lab@uc3m.example",
            imageUrl: "http://uc3m.example/portada.png",
            imageAlt: "Portada",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "invalid_image_url" },
      );

      assert.deepEqual(
        await createOpportunity(
          {
            type: "research",
            title: "Correo inválido",
            organization: "UC3M",
            description: "Rechaza mailto:.",
            contactEmail: "mailto:lab@uc3m.example",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "invalid_contact_email" },
      );

      assert.deepEqual(
        await createOpportunity(
          {
            type: "internship",
            title: "   ",
            organization: "Empresa",
            description: "Desc",
            applicationUrl: "https://empresa.example/apply",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "missing_title" },
      );

      assert.deepEqual(
        await createOpportunity(
          {
            slug: "practicas-dinamica-vuelo",
            type: "internship",
            title: "Slug duplicado",
            organization: "Empresa",
            description: "Desc",
            applicationUrl: "https://empresa.example/apply",
            status: "published",
          },
          editor.id,
          db,
        ),
        { ok: false, error: "duplicate_slug" },
      );

      // Borrador sin contacto permitido, pero no publicable
      const draftIncomplete = await createOpportunity(
        {
          slug: "borrador-sin-contacto",
          type: "internship",
          title: "Borrador sin medio externo",
          organization: "Empresa",
          description: "Aún en preparación.",
          infoUrl: "https://empresa.example/info",
          status: "draft",
        },
        editor.id,
        db,
      );
      assert.equal(draftIncomplete.ok, true);
      assert.equal(await getOpportunity("borrador-sin-contacto", student.id, db), undefined);
      assert.deepEqual(
        await updateOpportunityStatus("borrador-sin-contacto", "published", editor.id, db),
        { ok: false, error: "missing_contact" },
      );

      // Borrador completo publicable con auditoría en admin_audit_logs
      const draftReady = await createOpportunity(
        {
          slug: "borrador-listo",
          type: "research",
          title: "Materiales compuestos aeroespaciales",
          organization: "UC3M",
          description: "Ensayos de fatiga en carbono.",
          contactEmail: "materiales@uc3m.example",
          status: "draft",
        },
        editor.id,
        db,
      );
      assert.equal(draftReady.ok, true);
      assert.equal(
        (await listOpportunities(student.id, undefined, db)).some((o) => o.slug === "borrador-listo"),
        false,
      );

      const published = await updateOpportunityStatus("borrador-listo", "published", editor.id, db);
      assert.equal(published.ok, true);
      if (published.ok) {
        assert.equal(published.opportunity.status, "published");
        assert.ok(published.opportunity.publishedAt instanceof Date);

        const audits = await db
          .select()
          .from(adminAuditLogs)
          .where(eq(adminAuditLogs.targetId, published.opportunity.id));
        assert.equal(audits.length, 1);
        assert.equal(audits[0].actorProfileId, editor.id);
        assert.equal(audits[0].targetType, "opportunity");
        assert.equal(audits[0].action, "opportunity_status_updated");
        assert.equal(audits[0].result, "success");
      }

      // Filtrado y búsqueda por UUID y por slug
      const all = await listOpportunities(student.id, undefined, db);
      const internships = await listOpportunities(student.id, "internship", db);
      const researches = await listOpportunities(student.id, "research", db);
      assert.equal(all.length, 3);
      assert.equal(internships.length, 1);
      assert.equal(researches.length, 2);

      if (research.ok) {
        const byId = await getOpportunity(research.opportunity.id, student.id, db);
        const bySlug = await getOpportunity(research.opportunity.slug, student.id, db);
        assert.deepEqual(byId, bySlug);
      }
    } finally {
      await db.close();
    }
  });

  it("gestiona marcadores idempotentes aislados por persona y devuelve datos mínimos sin enlaces al archivar", async () => {
    const db = await createTestDb();
    try {
      const editor = await createProfile(db, { email: "editor@uc3m.es" });
      const personA = await createProfile(db);
      const personB = await createProfile(db);

      const created = await createOpportunity(
        {
          slug: "avionics-testing",
          type: "internship",
          title: "Prácticas de verificación de aviónica",
          organization: "Nadir Sistemas Espaciales",
          description: "Banco de pruebas hardware-in-the-loop.",
          location: "Getafe, Madrid",
          workModality: "Presencial",
          applicationUrl: "https://nadir.example/apply/avionics",
          contactEmail: "talento@nadir.example",
          infoUrl: "https://nadir.example/info",
          status: "published",
        },
        editor.id,
        db,
      );
      assert.equal(created.ok, true);
      if (!created.ok) return;
      const target = created.opportunity;

      // Marcado idempotente por slug y por UUID
      assert.equal(await saveBookmark(personA.id, target.slug, db), "saved");
      assert.equal(await saveBookmark(personA.id, target.id, db), "saved");

      const rawBookmarks = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.personId, personA.id));
      assert.equal(rawBookmarks.length, 1);

      assert.equal((await getOpportunity(target.id, personA.id, db))?.bookmarked, true);
      assert.equal((await getOpportunity(target.id, personB.id, db))?.bookmarked, false);
      assert.equal((await listBookmarks(personA.id, db)).length, 1);
      assert.deepEqual(await listBookmarks(personB.id, db), []);
      assert.equal(await saveBookmark(personA.id, "no-existe", db), "missing");

      // Archivar oportunidad guardada
      const archived = await updateOpportunityStatus(target.id, "archived", editor.id, db);
      assert.equal(archived.ok, true);

      assert.equal(await getOpportunity(target.id, personA.id, db), undefined);
      assert.equal((await listOpportunities(personA.id, undefined, db)).length, 0);
      assert.equal(await saveBookmark(personB.id, target.id, db), "missing");

      // El marcador archivado expone solo datos mínimos y ningún enlace de solicitud
      const archivedBookmarks = await listBookmarks(personA.id, db);
      assert.equal(archivedBookmarks.length, 1);
      assert.deepEqual(archivedBookmarks[0], {
        id: target.id,
        slug: target.slug,
        type: target.type,
        title: target.title,
        organization: target.organization,
        status: "archived",
      });
      assert.equal("applicationUrl" in archivedBookmarks[0], false);
      assert.equal("contactEmail" in archivedBookmarks[0], false);
      assert.equal("infoUrl" in archivedBookmarks[0], false);

      // Retirar marcador archivado e idempotencia
      assert.equal(await removeBookmark(personA.id, target.slug, db), "removed");
      assert.equal(await removeBookmark(personA.id, target.id, db), "removed");
      assert.deepEqual(await listBookmarks(personA.id, db), []);
    } finally {
      await db.close();
    }
  });
});
