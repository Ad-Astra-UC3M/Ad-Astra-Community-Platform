import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";

import { createTestDb, type AppDb } from "../../db/client";
import { deletionRequests, profiles } from "../../db/schema";
import {
  DISSEMINATION_POLICY_VERSION,
  DISSEMINATION_PURPOSE,
  getBasicProfile,
  getDisseminationStatus,
  getTalentProfile,
  normalizeTagList,
  parseExperiencesFromText,
  parseLanguageList,
  parseTagList,
  saveTalentProfile,
  setDisseminationDecision,
  updateBasicProfile,
} from "./repository";
import { getMyDeletionRequest, requestAccountDeletion } from "./deletion-requests";

async function createProfile(
  db: AppDb,
  overrides: Partial<typeof profiles.$inferInsert> = {},
) {
  const suffix = randomUUID().slice(0, 8);
  const now = new Date("2026-11-19T10:00:00Z");
  const [row] = await db
    .insert(profiles)
    .values({
      authUserId: `auth-${suffix}`,
      email: `student.${suffix}@alumnos.uc3m.es`,
      firstName: "Lucía",
      lastName: "Ejemplo",
      degree: "Ingeniería Aeroespacial",
      academicLevel: "Grado",
      languageModality: "Bilingüe",
      course: "2.º",
      privacyAccepted: true,
      privacyVersion: "privacy-v1",
      privacyAcceptedAt: now,
      registeredAt: now,
      emailVerifiedAt: now,
      ...overrides,
    })
    .returning();
  return row;
}

describe("profile repository (PostgreSQL)", () => {
  it("CA-02: lee y actualiza perfil básico manteniendo email, id y status inmutables", async () => {
    const db = await createTestDb();
    try {
      const student = await createProfile(db, {
        email: "lucia.perfil@alumnos.uc3m.es",
      });

      const initial = await getBasicProfile(student.id, db);
      assert.ok(initial);
      assert.equal(initial.id, student.id);
      assert.equal(initial.email, "lucia.perfil@alumnos.uc3m.es");
      assert.equal(initial.firstName, "Lucía");
      assert.equal(initial.lastName, "Ejemplo");
      assert.equal(initial.degree, "Ingeniería Aeroespacial");
      assert.equal(initial.academicLevel, "Grado");
      assert.equal(initial.languageModality, "Bilingüe");
      assert.equal(initial.course, "2.º");
      assert.equal(initial.privacyVersion, "privacy-v1");

      // Inexistente o ID inválido
      assert.equal(await getBasicProfile(randomUUID(), db), null);
      assert.equal(await getBasicProfile("not-a-uuid", db), null);

      // Rechaza cambio de correo
      assert.deepEqual(
        await updateBasicProfile(
          student.id,
          {
            firstName: "Lucía Nueva",
            lastName: "Ejemplo",
            degree: "Ingeniería Aeroespacial",
            course: "3.º",
            email: "otro@alumnos.uc3m.es",
          },
          db,
        ),
        { ok: false, error: "email_immutable" },
      );

      // Rechaza cambio de id o status
      assert.deepEqual(
        await updateBasicProfile(
          student.id,
          {
            firstName: "Lucía Nueva",
            lastName: "Ejemplo",
            degree: "Ingeniería Aeroespacial",
            course: "3.º",
            id: randomUUID(),
          },
          db,
        ),
        { ok: false, error: "identity_immutable" },
      );
      assert.deepEqual(
        await updateBasicProfile(
          student.id,
          {
            firstName: "Lucía Nueva",
            lastName: "Ejemplo",
            degree: "Ingeniería Aeroespacial",
            course: "3.º",
            status: "deactivated",
          },
          db,
        ),
        { ok: false, error: "identity_immutable" },
      );

      // Rechaza campos vacíos o demasiado largos sin cambios parciales
      assert.deepEqual(
        await updateBasicProfile(
          student.id,
          {
            firstName: "No Guardar",
            lastName: "Ejemplo",
            degree: "Ingeniería Aeroespacial",
            course: "   ",
          },
          db,
        ),
        { ok: false, error: "fields" },
      );
      assert.deepEqual(
        await updateBasicProfile(
          student.id,
          {
            firstName: "No Guardar",
            lastName: "Ejemplo",
            degree: "D".repeat(121),
            course: "3.º",
          },
          db,
        ),
        { ok: false, error: "fields" },
      );

      const unchanged = await getBasicProfile(student.id, db);
      assert.deepEqual(unchanged, initial);

      // Actualización válida (incluyendo academicLevel y languageModality, y reenviando mismo correo)
      const updated = await updateBasicProfile(
        student.id,
        {
          firstName: "Lucía",
          lastName: "Martínez",
          degree: "Doble Grado en Ingeniería Aeroespacial",
          course: "3.º",
          academicLevel: "Máster",
          languageModality: "Inglés",
          email: "LUCIA.PERFIL@ALUMNOS.UC3M.ES",
        },
        db,
      );
      assert.equal(updated.ok, true);
      if (updated.ok) {
        assert.equal(updated.profile.email, "lucia.perfil@alumnos.uc3m.es");
        assert.equal(updated.profile.lastName, "Martínez");
        assert.equal(updated.profile.degree, "Doble Grado en Ingeniería Aeroespacial");
        assert.equal(updated.profile.course, "3.º");
        assert.equal(updated.profile.academicLevel, "Máster");
        assert.equal(updated.profile.languageModality, "Inglés");
      }
    } finally {
      await db.close();
    }
  });

  it("CA-04: normaliza etiquetas, guarda JSONB validado, rechaza JSONB/idiomas/URLs inválidos y aísla lecturas ajenas", async () => {
    const db = await createTestDb();
    try {
      const owner = await createProfile(db, {
        email: "talento@alumnos.uc3m.es",
        firstName: "Clara",
        lastName: "Ramos",
      });
      const peer = await createProfile(db, {
        email: "companero@alumnos.uc3m.es",
        firstName: "Diego",
        lastName: "Soler",
      });

      // Normalización coherente de etiquetas (recorte + minúsculas + sin vacíos ni duplicados)
      assert.deepEqual(
        parseTagList(" C++, Python ,  c++ , , MATLAB\npython "),
        ["c++", "python", "matlab"],
      );
      assert.deepEqual(
        normalizeTagList(["  GNC ", "gnc", "", "  Simulink  "]),
        ["gnc", "simulink"],
      );

      // Helpers de texto para compatibilidad con formularios
      assert.deepEqual(parseLanguageList("Español (Nativo), Inglés (C1)"), [
        { language: "Español", level: "Nativo" },
        { language: "Inglés", level: "C1" },
      ]);
      const parsedExp = parseExperiencesFromText({
        experiencesSummary: "Prácticas en laboratorio de propulsión.",
        featuredProject: "Banco de telemetría CubeSat",
      });
      assert.equal(parsedExp.length, 2);
      assert.equal(parsedExp[0].kind, "project");
      assert.equal(parsedExp[0].isFeatured, true);

      // Perfil inicialmente vacío para la persona titular
      const empty = await getTalentProfile(owner.id, owner.id, db);
      assert.ok(empty);
      assert.equal(empty.personId, owner.id);
      assert.equal(empty.university, "");
      assert.equal(empty.expectedGraduationYear, null);
      assert.deepEqual(empty.skills, []);
      assert.deepEqual(empty.experiences, []);
      assert.deepEqual(empty.languages, []);
      assert.deepEqual(empty.links, []);
      assert.equal(empty.updatedAt, null);

      // Aislamiento frente a lectura ajena (CA-04)
      assert.equal(await getTalentProfile(peer.id, owner.id, db), null);
      assert.equal(await getTalentProfile(owner.id, randomUUID(), db), null);

      // Guardado completo (UPSERT)
      const saved = await saveTalentProfile(
        owner.id,
        {
          university: "Universidad Carlos III de Madrid",
          expectedGraduationYear: 2027,
          headline: "Estudiante de propulsión y aviónica",
          skills: ["C++", "Python", " c++ ", "CAD"],
          tools: ["MATLAB", "KiCad", "Git"],
          interests: ["Satélites pequeños", "Control de vuelo"],
          sectors: ["Aeroespacial", "Robótica"],
          opportunityTypes: ["Prácticas", "Investigación"],
          experiences: [
            {
              kind: "team",
              title: "Subsistema de Aviónica",
              organization: "Ad Astra UC3M",
              description: "Diseño de telemetría LoRa y PCBs de vuelo.",
              isFeatured: true,
              sortOrder: 0,
            },
            {
              kind: "project",
              title: "Banco de ensayos",
              organization: null,
              description: "Adquisición de datos a 1 kHz.",
              isFeatured: false,
              sortOrder: 1,
            },
          ],
          languages: [
            { language: "Español", level: "Nativo" },
            { language: "Inglés", level: "C1" },
          ],
          links: [
            { kind: "cv", label: "CV actualizado", url: "https://example.org/clara-cv.pdf" },
            { kind: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/clara-demo" },
            { kind: "github", label: "GitHub", url: "https://github.com/clara-demo" },
            { kind: "portfolio", label: "Portfolio", url: "http://clara-demo.example.com/proyectos" },
          ],
        },
        db,
      );
      assert.equal(saved.ok, true);
      if (saved.ok) {
        assert.equal(saved.profile.university, "Universidad Carlos III de Madrid");
        assert.equal(saved.profile.expectedGraduationYear, 2027);
        assert.deepEqual(saved.profile.skills, ["c++", "python", "cad"]);
        assert.deepEqual(saved.profile.opportunityTypes, ["prácticas", "investigación"]);
        assert.equal(saved.profile.experiences.length, 2);
        assert.equal(saved.profile.experiences[0].isFeatured, true);
        assert.equal(saved.profile.languages.length, 2);
        assert.equal(saved.profile.links.length, 4);
        assert.ok(saved.profile.updatedAt instanceof Date);
      }

      // Rechaza esquemas ejecutables y URLs no válidas sin alterar datos previos
      for (const badUrl of [
        "javascript:alert(1)",
        "JAVASCRIPT:void(0)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "vbscript:msgbox(1)",
        "mailto:test@uc3m.es",
        "ftp://files.example.org/cv.pdf",
        "https://example.org/has space",
        "no-es-una-url",
      ]) {
        assert.deepEqual(
          await saveTalentProfile(
            owner.id,
            {
              university: "No debe guardarse",
              links: [{ kind: "other", label: "Malo", url: badUrl }],
            },
            db,
          ),
          { ok: false, error: "invalid_url" },
          `Debe rechazar la URL ${badUrl}`,
        );
      }

      // Rechaza tipo de enlace inválido
      assert.deepEqual(
        await saveTalentProfile(
          owner.id,
          {
            links: [{ kind: "unknown" as never, label: "Otro", url: "https://example.org" }],
          },
          db,
        ),
        { ok: false, error: "invalid_link_kind" },
      );

      // Rechaza idiomas duplicados normalizados (case/trim) e idiomas vacíos
      assert.deepEqual(
        await saveTalentProfile(
          owner.id,
          {
            languages: [
              { language: "Español", level: "Nativo" },
              { language: "  español ", level: "C2" },
            ],
          },
          db,
        ),
        { ok: false, error: "duplicate_language" },
      );
      assert.deepEqual(
        await saveTalentProfile(
          owner.id,
          {
            languages: [{ language: "Inglés", level: "   " }],
          },
          db,
        ),
        { ok: false, error: "invalid_languages" },
      );

      // Rechaza experiencias con kind inválido, título vacío o sortOrder negativo
      assert.deepEqual(
        await saveTalentProfile(
          owner.id,
          {
            experiences: [
              { kind: "hobby" as never, title: "X", isFeatured: false, sortOrder: 0 },
            ],
          },
          db,
        ),
        { ok: false, error: "invalid_experiences" },
      );
      assert.deepEqual(
        await saveTalentProfile(
          owner.id,
          {
            experiences: [
              { kind: "work", title: "   ", isFeatured: false, sortOrder: 0 },
            ],
          },
          db,
        ),
        { ok: false, error: "invalid_experiences" },
      );
      assert.deepEqual(
        await saveTalentProfile(
          owner.id,
          {
            experiences: [
              { kind: "work", title: "Prácticas", isFeatured: false, sortOrder: -1 },
            ],
          },
          db,
        ),
        { ok: false, error: "invalid_experiences" },
      );

      // Rechaza año inválido
      assert.deepEqual(
        await saveTalentProfile(owner.id, { expectedGraduationYear: 1800 }, db),
        { ok: false, error: "invalid_year" },
      );
      assert.deepEqual(
        await saveTalentProfile(owner.id, { expectedGraduationYear: "dos-mil" }, db),
        { ok: false, error: "invalid_year" },
      );

      // Los datos válidos previos permanecen intactos
      const afterRejected = await getTalentProfile(owner.id, owner.id, db);
      assert.equal(afterRejected?.university, "Universidad Carlos III de Madrid");
      assert.equal(afterRejected?.links.length, 4);
      assert.equal(afterRejected?.experiences.length, 2);

      // Permite vaciar campos opcionales y retirar enlaces
      const cleared = await saveTalentProfile(
        owner.id,
        {
          university: "",
          expectedGraduationYear: null,
          headline: "",
          skills: [],
          tools: [],
          interests: [],
          sectors: [],
          opportunityTypes: [],
          experiences: [],
          languages: [],
          links: [],
        },
        db,
      );
      assert.equal(cleared.ok, true);
      const afterClear = await getTalentProfile(owner.id, owner.id, db);
      assert.equal(afterClear?.university, "");
      assert.equal(afterClear?.expectedGraduationYear, null);
      assert.deepEqual(afterClear?.skills, []);
      assert.deepEqual(afterClear?.experiences, []);
      assert.deepEqual(afterClear?.languages, []);
      assert.deepEqual(afterClear?.links, []);
    } finally {
      await db.close();
    }
  });

  it("CA-04: evalúa difusión append-only sin duplicar, con vencimiento valid_until y sin borrar talento", async () => {
    const db = await createTestDb();
    try {
      const student = await createProfile(db, {
        email: "difusion@alumnos.uc3m.es",
        firstName: "Mateo",
        lastName: "Vega",
      });

      const savedTalent = await saveTalentProfile(
        student.id,
        {
          university: "UC3M",
          headline: "Aviónica embebida",
          skills: ["Rust", "RTOS"],
          links: [{ kind: "github", label: "GitHub", url: "https://github.com/mateo-demo" }],
        },
        db,
      );
      assert.equal(savedTalent.ok, true);

      const t0 = new Date("2026-11-19T10:00:00Z");
      const initial = await getDisseminationStatus(student.id, t0, db);
      assert.equal(initial.purpose, DISSEMINATION_PURPOSE);
      assert.equal(initial.policyVersion, DISSEMINATION_POLICY_VERSION);
      assert.equal(initial.granted, false);
      assert.equal(initial.expired, false);
      assert.equal(initial.decidedAt, null);
      assert.deepEqual(initial.history, []);

      // Concesión con fecha de validez
      const t1 = new Date("2026-11-19T11:00:00Z");
      const validUntil = new Date("2027-06-01T00:00:00Z");
      const granted = await setDisseminationDecision(
        student.id,
        true,
        { validUntil, now: t1 },
        db,
      );
      assert.ok(granted);
      assert.equal(granted.granted, true);
      assert.equal(granted.expired, false);
      assert.equal(granted.history.length, 1);
      assert.equal(granted.validUntil?.toISOString(), validUntil.toISOString());

      // Repetir el mismo estado vigente no duplica fila en historial
      const repeated = await setDisseminationDecision(
        student.id,
        true,
        { validUntil, now: new Date("2026-11-19T12:00:00Z") },
        db,
      );
      assert.ok(repeated);
      assert.equal(repeated.history.length, 1);

      // Al superar valid_until (valid_until <= now), devuelve granted: false
      const afterExpiry = await getDisseminationStatus(
        student.id,
        new Date("2027-06-01T00:00:00Z"),
        db,
      );
      assert.equal(afterExpiry.granted, false);
      assert.equal(afterExpiry.expired, true);
      assert.equal(afterExpiry.history.length, 1);

      // Renovar tras vencimiento sí inserta una nueva decisión
      const tRenew = new Date("2027-06-02T10:00:00Z");
      const renewed = await setDisseminationDecision(
        student.id,
        true,
        { validUntil: new Date("2028-06-01T00:00:00Z"), now: tRenew },
        db,
      );
      assert.ok(renewed);
      assert.equal(renewed.granted, true);
      assert.equal(renewed.history.length, 2);

      // Retirar difusión registra nuevo evento sin borrar el perfil de talento
      const tRevoke = new Date("2027-06-03T10:00:00Z");
      const revoked = await setDisseminationDecision(
        student.id,
        false,
        { now: tRevoke },
        db,
      );
      assert.ok(revoked);
      assert.equal(revoked.granted, false);
      assert.equal(revoked.history.length, 3);
      assert.equal(revoked.history[0].granted, false);

      // Repetir retirada no duplica
      const revokedAgain = await setDisseminationDecision(
        student.id,
        false,
        { now: new Date("2027-06-03T11:00:00Z") },
        db,
      );
      assert.equal(revokedAgain?.history.length, 3);

      const talentAfterRevoke = await getTalentProfile(student.id, student.id, db);
      assert.equal(talentAfterRevoke?.headline, "Aviónica embebida");
      assert.equal(talentAfterRevoke?.links.length, 1);
    } finally {
      await db.close();
    }
  });

  it("CA-11: solicitud de supresión idempotente en pending/in_review y aislamiento de lectura ajena", async () => {
    const db = await createTestDb();
    try {
      const owner = await createProfile(db, {
        email: "supresion@alumnos.uc3m.es",
        firstName: "Elena",
        lastName: "Cano",
      });
      const admin = await createProfile(db, {
        email: "admin.sup@uc3m.es",
        firstName: "Admin",
        lastName: "General",
      });
      const other = await createProfile(db, {
        email: "ajeno@alumnos.uc3m.es",
        firstName: "Hugo",
        lastName: "Gil",
      });

      assert.equal(await getMyDeletionRequest(owner.id, owner.id, db), null);

      const t1 = new Date("2026-11-19T12:00:00Z");
      const first = await requestAccountDeletion(
        owner.id,
        "Ya terminé la titulación.",
        t1,
        db,
      );
      assert.equal(first.ok, true);
      if (!first.ok) return;
      assert.equal(first.created, true);
      assert.equal(first.request.status, "pending");
      assert.equal(first.request.reason, "Ya terminé la titulación.");
      assert.equal(first.request.resolvedAt, null);

      // No borra ni desactiva la cuenta automáticamente
      assert.equal((await getBasicProfile(owner.id, db))?.status, "active");

      // Reintento mientras está pending devuelve la existente sin duplicar
      const duplicatePending = await requestAccountDeletion(
        owner.id,
        "Segundo intento",
        new Date("2026-11-19T12:05:00Z"),
        db,
      );
      assert.equal(duplicatePending.ok, true);
      if (duplicatePending.ok) {
        assert.equal(duplicatePending.created, false);
        assert.equal(duplicatePending.request.id, first.request.id);
      }

      // Reintento mientras está in_review también es idempotente
      await db
        .update(deletionRequests)
        .set({ status: "in_review" })
        .where(eq(deletionRequests.id, first.request.id));

      const duplicateInReview = await requestAccountDeletion(
        owner.id,
        "Tercer intento",
        new Date("2026-11-19T12:10:00Z"),
        db,
      );
      assert.equal(duplicateInReview.ok, true);
      if (duplicateInReview.ok) {
        assert.equal(duplicateInReview.created, false);
        assert.equal(duplicateInReview.request.id, first.request.id);
        assert.equal(duplicateInReview.request.status, "in_review");
      }

      // Aislamiento: solo el titular puede consultar su propia solicitud
      assert.equal((await getMyDeletionRequest(owner.id, owner.id, db))?.id, first.request.id);
      assert.equal(await getMyDeletionRequest(other.id, owner.id, db), null);

      // Rechaza motivo demasiado largo
      const tooLong = await requestAccountDeletion(
        other.id,
        "x".repeat(1001),
        t1,
        db,
      );
      assert.deepEqual(tooLong, { ok: false, error: "reason_too_long" });

      // Tras resolver la solicitud, permite abrir una nueva
      await db
        .update(deletionRequests)
        .set({
          status: "resolved",
          resolutionNote: "Revisada y tramitada.",
          resolvedBy: admin.id,
          resolvedAt: new Date("2026-11-19T13:00:00Z"),
        })
        .where(eq(deletionRequests.id, first.request.id));

      const afterResolved = await requestAccountDeletion(
        owner.id,
        "Nueva petición",
        new Date("2026-11-19T14:00:00Z"),
        db,
      );
      assert.equal(afterResolved.ok, true);
      if (afterResolved.ok) {
        assert.equal(afterResolved.created, true);
        assert.notEqual(afterResolved.request.id, first.request.id);
      }
    } finally {
      await db.close();
    }
  });
});
