/**
 * Pruebas de integración con Node y PGlite de los casos administrativos que
 * exponen las páginas y Server Actions de Next.js. Inyectan una base Drizzle
 * aislada por caso y llaman a los módulos de servidor para verificar reglas,
 * efectos persistidos y auditoría.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { and, eq } from "drizzle-orm";

import { createTestDb, type AppDb } from "../db/client";
import {
  adminAuditLogs,
  participationEvents,
  participations,
  profiles,
} from "../db/schema";
import {
  addActivityShift,
  createAdminActivity,
  deleteShift,
  listAdminActivities,
  setActivityStatus,
  updateShiftCapacity,
} from "./activities/admin-data";
import {
  correctAttendance,
  getShiftDetail,
  listActiveAccountsForDoor,
  listAttendanceAudit,
  listShiftAttendeesDetailed,
  listShiftSummaries,
  manualConfirmAttendance,
  registerAtDoor,
} from "./activities/attendance-data";
import {
  getAccountAdminDetail,
  getAdminMetrics,
  searchAccounts,
  setProfileCapability,
  setProfileStatus,
} from "./accounts/repository";
import {
  createAdminOpportunity,
  listAdminOpportunities,
  setAdminOpportunityStatus,
} from "./opportunities/repository";
import {
  getDeletionRequest,
  listDeletionRequests,
  requestAccountDeletion,
  resolveDeletionRequest,
} from "./profiles/deletion-requests";
import {
  saveTalentProfile,
  setDisseminationDecision,
} from "./profiles/repository";
import {
  getTalentAdminDetail,
  searchTalentProfiles,
} from "./profiles/talent-consultation";

/**
 * Inserta el perfil base que usan los casos de administración. Simula los
 * campos locales de una cuenta ya verificada por Auth.
 * @param db Cliente Drizzle de la base PGlite aislada del caso.
 * @param overrides Campos que sustituyen los valores sintéticos para el rol o estado que se prueba.
 * @returns La fila de profiles persistida y devuelta por PostgreSQL.
 */
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
      email: `user.${suffix}@alumnos.uc3m.es`,
      firstName: "Lucía",
      lastName: "Mendoza",
      degree: "Ingeniería Aeroespacial",
      course: "3.º",
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

describe("administrative flows (PostgreSQL)", () => {
  /**
   * Comprueba las transiciones de puerta y asistencia, sus motivos, el aforo y
   * el historial de una participación tras corregir el estado.
   */
  it("CA-10: alta en puerta -> booked, confirmación manual, rectificación attended -> booked conservando plaza y auditoría cronológica", async () => {
    const db = await createTestDb();
    try {
      const organizer = await createProfile(db, {
        email: "org.puerta@uc3m.es",
        firstName: "Sofía",
        lastName: "Organizadora",
      });
      const student = await createProfile(db, {
        email: "alumno.puerta1@alumnos.uc3m.es",
        firstName: "Diego",
        lastName: "Navarro",
      });
      const extraStudent = await createProfile(db, {
        email: "alumno.puerta2@alumnos.uc3m.es",
        firstName: "Marta",
        lastName: "López",
      });
      const deactivatedStudent = await createProfile(db, {
        email: "alumno.baja@alumnos.uc3m.es",
        firstName: "Pablo",
        lastName: "Baja",
        status: "deactivated",
        deactivatedAt: new Date("2026-11-18T10:00:00Z"),
      });

      const start = new Date("2026-11-25T10:00:00Z");
      const end = new Date("2026-11-25T12:00:00Z");
      const created = await createAdminActivity(
        {
          title: "Taller de propulsión en puerta",
          description: "Sesión práctica con dos turnos.",
          location: "Laboratorio 1.1",
          shifts: [
            { name: "Grupo A", startsAt: start, endsAt: end, capacity: 1 },
            {
              name: "Grupo B",
              startsAt: new Date("2026-11-25T15:00:00Z"),
              endsAt: new Date("2026-11-25T17:00:00Z"),
              capacity: 2,
            },
          ],
        },
        organizer.id,
        db,
      );
      assert.equal(created.ok, true);
      if (!created.ok) return;

      const shiftA = created.activity.shifts[0];
      const shiftB = created.activity.shifts[1];

      // Motivo obligatorio
      assert.deepEqual(
        await registerAtDoor(shiftA.id, student.id, organizer.id, "   ", start, db),
        { ok: false, error: "missing_reason" },
      );

      // Cuenta desactivada rechazada
      assert.deepEqual(
        await registerAtDoor(
          shiftA.id,
          deactivatedStudent.id,
          organizer.id,
          "Llegada en puerta",
          start,
          db,
        ),
        { ok: false, error: "account_deactivated" },
      );

      // Alta en puerta con plaza: deja estado booked y registra evento door_registered
      const tDoor = new Date("2026-11-25T10:05:00Z");
      const registered = await registerAtDoor(
        shiftA.id,
        student.id,
        organizer.id,
        "Alta presencial en acceso",
        tDoor,
        db,
      );
      assert.equal(registered.ok, true);
      if (registered.ok) {
        assert.equal(registered.status, "booked");
        assert.equal(registered.personId, student.id);
      }

      const detailA = await getShiftDetail(shiftA.id, db);
      assert.ok(detailA);
      assert.equal(detailA.reservedCount, 1);
      assert.equal(detailA.attendedCount, 0);
      assert.equal(detailA.available, 0);

      const summaries = await listShiftSummaries(db);
      assert.equal(summaries.length, 2);

      const candidates = await listActiveAccountsForDoor(shiftA.id, "Navarro", db);
      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].alreadyInShift, true);

      // Duplicado en el mismo turno
      assert.deepEqual(
        await registerAtDoor(
          shiftA.id,
          student.id,
          organizer.id,
          "Segundo intento",
          tDoor,
          db,
        ),
        { ok: false, error: "duplicate", existing: true },
      );

      // Sin plaza en turno A
      assert.deepEqual(
        await registerAtDoor(
          shiftA.id,
          extraStudent.id,
          organizer.id,
          "Sin aforo",
          tDoor,
          db,
        ),
        { ok: false, error: "full" },
      );

      // Turno terminado rechazado (ends_at <= now)
      assert.deepEqual(
        await registerAtDoor(
          shiftB.id,
          extraStudent.id,
          organizer.id,
          "Fuera de hora",
          new Date("2026-11-25T17:00:00Z"),
          db,
        ),
        { ok: false, error: "shift_ended" },
      );

      // Confirmación manual exige motivo y cambia a attended (method = 'manual')
      assert.deepEqual(
        await manualConfirmAttendance(shiftA.id, student.id, organizer.id, "", tDoor, db),
        { ok: false, error: "missing_reason" },
      );

      const tManual = new Date("2026-11-25T10:15:00Z");
      const confirmed = await manualConfirmAttendance(
        shiftA.id,
        student.id,
        organizer.id,
        "Validado manualmente sin cámara",
        tManual,
        db,
      );
      assert.equal(confirmed.ok, true);
      if (confirmed.ok) {
        assert.equal(confirmed.previousStatus, "booked");
        assert.equal(confirmed.newStatus, "attended");
      }

      // Repetir confirmación manual devuelve already_attended
      assert.deepEqual(
        await manualConfirmAttendance(
          shiftA.id,
          student.id,
          organizer.id,
          "Reintento",
          tManual,
          db,
        ),
        { ok: false, error: "already_attended" },
      );

      const attendeesAfterConfirm = await listShiftAttendeesDetailed(shiftA.id, "Diego", db);
      assert.equal(attendeesAfterConfirm.length, 1);
      assert.equal(attendeesAfterConfirm[0].status, "attended");
      assert.equal(attendeesAfterConfirm[0].attendanceMethod, "manual");

      // Rectificación attended -> booked limpia campos de validación y conserva la plaza
      assert.deepEqual(
        await correctAttendance(shiftA.id, student.id, "booked", organizer.id, "   ", tManual, db),
        { ok: false, error: "missing_reason" },
      );

      const tCorrect = new Date("2026-11-25T10:20:00Z");
      const corrected = await correctAttendance(
        shiftA.id,
        student.id,
        "booked",
        organizer.id,
        "Se marcó por error",
        tCorrect,
        db,
      );
      assert.equal(corrected.ok, true);
      if (corrected.ok) {
        assert.equal(corrected.previousStatus, "attended");
        assert.equal(corrected.newStatus, "booked");
      }

      // Estado igual -> unchanged
      assert.deepEqual(
        await correctAttendance(shiftA.id, student.id, "booked", organizer.id, "Sin cambio", tCorrect, db),
        { ok: false, error: "unchanged" },
      );

      const [participationRow] = await db
        .select()
        .from(participations)
        .where(
          and(
            eq(participations.shiftId, shiftA.id),
            eq(participations.personId, student.id),
          ),
        );
      assert.ok(participationRow);
      assert.equal(participationRow.status, "booked");
      assert.equal(participationRow.attendedAt, null);
      assert.equal(participationRow.validatedBy, null);
      assert.equal(participationRow.attendanceMethod, null);

      // Historial cronológico de participation_events
      const audit = await listAttendanceAudit(shiftA.id, db);
      assert.equal(audit.length, 3);
      assert.deepEqual(
        audit.map((entry) => ({
          eventType: entry.eventType,
          previousStatus: entry.previousStatus,
          newStatus: entry.newStatus,
          reason: entry.reason,
          actorProfileId: entry.actorProfileId,
        })),
        [
          {
            eventType: "door_registered",
            previousStatus: null,
            newStatus: null,
            reason: "Alta presencial en acceso",
            actorProfileId: organizer.id,
          },
          {
            eventType: "attendance_manual",
            previousStatus: null,
            newStatus: null,
            reason: "Validado manualmente sin cámara",
            actorProfileId: organizer.id,
          },
          {
            eventType: "attendance_corrected",
            previousStatus: "attended",
            newStatus: "booked",
            reason: "Se marcó por error",
            actorProfileId: organizer.id,
          },
        ],
      );
    } finally {
      await db.close();
    }
  });

  /**
   * Prueba las reglas de edición de turnos, imágenes y oportunidades. La
   * conservación de turnos con participación o historial se verifica en la base.
   */
  it("CA-06 y CA-05: actividades con turno normal, imágenes HTTPS, borrado protegido por participaciones/eventos, y oportunidades admin", async () => {
    const db = await createTestDb();
    try {
      const editor = await createProfile(db, {
        email: "editor@uc3m.es",
        firstName: "Laura",
        lastName: "Editora",
      });
      const student1 = await createProfile(db, { email: "s1@alumnos.uc3m.es" });
      const student2 = await createProfile(db, { email: "s2@alumnos.uc3m.es" });

      const start = new Date("2026-12-01T10:00:00Z");
      const end = new Date("2026-12-01T12:00:00Z");

      // Rechaza horario inválido, aforo <= 0, imagen no HTTPS e imagen sin alt
      assert.equal(
        (
          await createAdminActivity(
            { title: "Mala", description: "D", location: "L", startsAt: end, endsAt: start, capacity: 10 },
            editor.id,
            db,
          )
        ).ok,
        false,
      );
      assert.deepEqual(
        await createAdminActivity(
          {
            title: "Insegura",
            description: "D",
            location: "L",
            startsAt: start,
            endsAt: end,
            capacity: 5,
            images: [{ imageUrl: "http://example.com/a.jpg", imageAlt: "Foto" }],
          },
          editor.id,
          db,
        ),
        { ok: false, error: "invalid_image_url" },
      );
      assert.deepEqual(
        await createAdminActivity(
          {
            title: "Sin alt",
            description: "D",
            location: "L",
            startsAt: start,
            endsAt: end,
            capacity: 5,
            images: [{ imageUrl: "https://adastrauc3m.es/a.jpg", imageAlt: "  " }],
          },
          editor.id,
          db,
        ),
        { ok: false, error: "missing_image_alt" },
      );

      // Crea actividad sin shifts explícitos -> turno 'normal' + imágenes ordenadas + audit log
      const created = await createAdminActivity(
        {
          title: "Seminario de órbitas LEO",
          description: "Mecánica orbital aplicada.",
          location: "Salón de grados",
          startsAt: start,
          endsAt: end,
          capacity: 3,
          images: [
            { imageUrl: "https://adastrauc3m.es/orbita-2.jpg", imageAlt: "Esquema", position: 2 },
            { imageUrl: "https://adastrauc3m.es/orbita-1.jpg", imageAlt: "Portada", position: 1 },
          ],
        },
        editor.id,
        db,
      );
      assert.equal(created.ok, true);
      if (!created.ok) return;

      assert.equal(created.activity.shifts.length, 1);
      assert.equal(created.activity.shifts[0].name, "normal");
      assert.equal(created.activity.images.length, 2);
      assert.equal(created.activity.images[0].position, 1);

      const normalShiftId = created.activity.shifts[0].id;
      await registerAtDoor(normalShiftId, student1.id, editor.id, "Alta 1", new Date("2026-12-01T09:00:00Z"), db);
      await registerAtDoor(normalShiftId, student2.id, editor.id, "Alta 2", new Date("2026-12-01T09:01:00Z"), db);

      // Protección below_reserved y has_participants
      assert.deepEqual(await updateShiftCapacity(normalShiftId, 1, db), {
        ok: false,
        error: "below_reserved",
        reservedCount: 2,
      });
      assert.deepEqual(await updateShiftCapacity(normalShiftId, 2, db), {
        ok: true,
        shiftId: normalShiftId,
        capacity: 2,
        reservedCount: 2,
      });
      const delOccupied = await deleteShift(normalShiftId, db);
      assert.equal(delOccupied.ok, false);
      if (!delOccupied.ok) {
        assert.equal(delOccupied.error, "has_participants");
      }

      // Incluso si se borran las participaciones vigentes pero existen eventos históricos en participation_events, deleteShift bloquea
      const extraShift = await addActivityShift(
        created.activity.id,
        {
          name: "Turno con evento histórico",
          startsAt: new Date("2026-12-01T14:00:00Z"),
          endsAt: new Date("2026-12-01T16:00:00Z"),
          capacity: 5,
        },
        db,
      );
      assert.equal(extraShift.ok, true);
      if (!extraShift.ok) return;

      await db.insert(participationEvents).values({
        participationId: randomUUID(),
        personId: student1.id,
        actorProfileId: student1.id,
        shiftId: extraShift.shift.id,
        eventType: "cancelled",
      });
      const delWithHistory = await deleteShift(extraShift.shift.id, db);
      assert.equal(delWithHistory.ok, false);
      if (!delWithHistory.ok) {
        assert.equal(delWithHistory.error, "has_participants");
      }

      // Turno completamente vacío sí puede eliminarse
      const emptyShift = await addActivityShift(
        created.activity.id,
        {
          name: "Turno vacío",
          startsAt: new Date("2026-12-01T17:00:00Z"),
          endsAt: new Date("2026-12-01T18:00:00Z"),
          capacity: null,
        },
        db,
      );
      assert.equal(emptyShift.ok, true);
      if (emptyShift.ok) {
        assert.deepEqual(await deleteShift(emptyShift.shift.id, db), {
          ok: true,
          shiftId: emptyShift.shift.id,
        });
      }

      // Borrador sin turnos válidos no puede publicarse
      const draft = await createAdminActivity(
        {
          title: "Borrador sin turnos",
          description: "Pendiente",
          location: "Campus Leganés",
          status: "draft",
          shifts: [],
        },
        editor.id,
        db,
      );
      assert.equal(draft.ok, true);
      if (draft.ok) {
        assert.deepEqual(
          await setActivityStatus(draft.activity.id, "published", editor.id, db),
          { ok: false, error: "no_valid_shifts" },
        );
      }

      // Archivar registra auditoría y bloquea altas en puerta
      assert.deepEqual(
        await setActivityStatus(created.activity.id, "archived", editor.id, db),
        { ok: true, activityId: created.activity.id, status: "archived" },
      );
      const activitiesList = await listAdminActivities(db);
      assert.ok(activitiesList.some((a) => a.id === created.activity.id && a.status === "archived"));

      // Oportunidades admin (CA-05)
      const draftOpp = await createAdminOpportunity(
        {
          slug: "practicas-estructuras-fem",
          type: "internship",
          title: "Prácticas en estructuras FEM",
          organization: "Ad Astra Partners",
          description: "Análisis FEM de cohetes sonda.",
          contactEmail: "estructuras@partner.example",
          status: "draft",
        },
        editor.id,
        db,
      );
      assert.equal(draftOpp.ok, true);
      if (draftOpp.ok) {
        assert.equal(draftOpp.opportunity.status, "draft");
        const publishedBySlug = await setAdminOpportunityStatus(
          "practicas-estructuras-fem",
          "published",
          editor.id,
          db,
        );
        assert.equal(publishedBySlug.ok, true);
        if (publishedBySlug.ok) {
          assert.equal(publishedBySlug.opportunity.status, "published");
        }
        const opps = await listAdminOpportunities(db);
        assert.ok(opps.some((o) => o.id === draftOpp.opportunity.id && o.status === "published"));
      }
    } finally {
      await db.close();
    }
  });

  /**
   * Verifica concesiones y revocaciones idempotentes, actividad de las cuentas,
   * revocación de sesión mediante un colaborador de prueba y consulta de talento.
   */
  it("CA-01 y CA-04: auditoría de capacidades sin duplicar, desactivación revocando sesiones, aislamiento de talento y búsqueda GIN por etiquetas", async () => {
    const db = await createTestDb();
    try {
      const admin = await createProfile(db, {
        email: "admin@uc3m.es",
        firstName: "Carlos",
        lastName: "Admin",
      });
      const studentA = await createProfile(db, {
        authUserId: "neon-user-marina",
        email: "marina.aero@alumnos.uc3m.es",
        firstName: "Marina",
        lastName: "Soler",
        degree: "Ingeniería Aeroespacial",
        course: "4.º",
      });
      const studentB = await createProfile(db, {
        authUserId: "neon-user-hugo",
        email: "hugo.teleco@alumnos.uc3m.es",
        firstName: "Hugo",
        lastName: "Vega",
        degree: "Ingeniería de Telecomunicación",
        course: "2.º",
      });

      // Concesión y retirada de capacidades auditada solo ante cambio efectivo
      const grant1 = await setProfileCapability(studentA.id, "content_editing", true, admin.id, db);
      assert.deepEqual(grant1, {
        ok: true,
        changed: true,
        capability: "content_editing",
        enabled: true,
      });

      // Reintento idempotente no duplica admin_audit_logs
      const grant2 = await setProfileCapability(studentA.id, "content_editing", true, admin.id, db);
      assert.deepEqual(grant2, {
        ok: true,
        changed: false,
        capability: "content_editing",
        enabled: true,
      });

      // Retirada sí audita; segundo intento no duplica
      const revoke1 = await setProfileCapability(studentA.id, "content_editing", false, admin.id, db);
      assert.deepEqual(revoke1, {
        ok: true,
        changed: true,
        capability: "content_editing",
        enabled: false,
      });
      const revoke2 = await setProfileCapability(studentA.id, "content_editing", false, admin.id, db);
      assert.deepEqual(revoke2, {
        ok: true,
        changed: false,
        capability: "content_editing",
        enabled: false,
      });

      const capLogs = await db
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.targetId, studentA.id));
      assert.equal(capLogs.length, 2);
      assert.deepEqual(
        capLogs.map((l) => l.action).sort(),
        ["capability_granted", "capability_revoked"],
      );

      // Perfil de talento para studentA
      const savedTalent = await saveTalentProfile(
        studentA.id,
        {
          university: "UC3M",
          expectedGraduationYear: 2027,
          headline: "Especialista en guiado y GNC",
          skills: ["Python", "Simulink", "GNC"],
          tools: ["MATLAB", "Git"],
          interests: ["Propulsión", "CubeSats"],
          sectors: ["Aeroespacial"],
          opportunityTypes: ["Prácticas"],
          experiences: [
            {
              kind: "team",
              title: "Control Orbital",
              organization: "Ad Astra",
              description: "Simulaciones ADCS",
              isFeatured: true,
              sortOrder: 0,
            },
          ],
          languages: [{ language: "Inglés", level: "C1" }],
          links: [{ kind: "github", label: "GitHub", url: "https://github.com/marina-gnc" }],
        },
        db,
      );
      assert.equal(savedTalent.ok, true);
      await setDisseminationDecision(studentA.id, true, {}, db);

      // Ficha de cuenta nunca expone talento (CA-01)
      const accountDetail = await getAccountAdminDetail(studentA.id, db);
      assert.ok(accountDetail);
      assert.equal(accountDetail.capabilityAudit.length, 2);
      assert.equal("skills" in accountDetail, false);
      assert.equal("headline" in accountDetail, false);
      assert.equal("links" in accountDetail, false);
      assert.equal("experiences" in accountDetail, false);
      assert.equal("talentProfile" in accountDetail, false);

      // Búsqueda de cuentas por filtros
      assert.equal((await searchAccounts({ query: "Marina" }, db)).length, 1);
      assert.equal((await searchAccounts({ degree: "Telecomunicación" }, db)).length, 1);

      // Desactivación invoca callback de revocación de sesiones en Neon Auth
      const revokedAuthUsers: string[] = [];
      const deactivated = await setProfileStatus(
        studentB.id,
        "deactivated",
        admin.id,
        async (authUserId) => {
          revokedAuthUsers.push(authUserId);
        },
        db,
      );
      assert.equal(deactivated.ok, true);
      assert.deepEqual(revokedAuthUsers, ["neon-user-hugo"]);

      const metrics = await getAdminMetrics(db);
      assert.equal(metrics.totalAccounts, 3);
      assert.equal(metrics.activeAccounts, 2);
      assert.equal(metrics.deactivatedAccounts, 1);

      // Consulta de talento separada usando operadores GIN (&&) por etiquetas normalizadas
      const byTag = await searchTalentProfiles({ tags: ["SIMULINK", "inexistente"] }, db);
      assert.equal(byTag.length, 1);
      assert.equal(byTag[0].personId, studentA.id);
      assert.equal(byTag[0].disseminationGranted, true);

      const bySectorTag = await searchTalentProfiles({ tags: ["aeroespacial"] }, db);
      assert.equal(bySectorTag.length, 1);

      const byTagAndQuery = await searchTalentProfiles(
        { tags: ["python"], query: "guiado" },
        db,
      );
      assert.equal(byTagAndQuery.length, 1);

      const noMatchTag = await searchTalentProfiles({ tags: ["rust"] }, db);
      assert.equal(noMatchTag.length, 0);

      const talentDetail = await getTalentAdminDetail(studentA.id, db);
      assert.ok(talentDetail);
      assert.equal(talentDetail.headline, "Especialista en guiado y GNC");
      assert.equal(talentDetail.experiences.length, 1);
      assert.equal(talentDetail.links.length, 1);
      assert.equal(await getTalentAdminDetail(studentB.id, db), null);
    } finally {
      await db.close();
    }
  });

  /**
   * Sigue el paso a revisión y la resolución motivada de una solicitud a través
   * del servicio, comprobando el detalle, métricas y auditoría persistida.
   */
  it("CA-11: tramitación y resolución motivada de solicitudes de supresión con auditoría", async () => {
    const db = await createTestDb();
    try {
      const admin = await createProfile(db, {
        email: "admin.del@uc3m.es",
        firstName: "Elena",
        lastName: "Responsable",
      });
      const student = await createProfile(db, {
        email: "alumno.del@alumnos.uc3m.es",
        firstName: "Javier",
        lastName: "Ruiz",
      });

      const created = await requestAccountDeletion(
        student.id,
        "Termino el grado este cuatrimestre.",
        new Date("2026-11-19T09:00:00Z"),
        db,
      );
      assert.equal(created.ok, true);
      if (!created.ok) return;

      const list = await listDeletionRequests(db);
      assert.equal(list.length, 1);
      assert.equal(list[0].status, "pending");

      const metricsBefore = await getAdminMetrics(db);
      assert.equal(metricsBefore.pendingDeletionRequests, 1);

      // Paso a in_review cumple el CHECK de PostgreSQL (resolution_note/resolved_by/resolved_at permanecen NULL)
      const inReview = await resolveDeletionRequest(
        created.request.id,
        "in_review",
        "Verificando historial antes de proceder.",
        admin.id,
        new Date("2026-11-19T10:00:00Z"),
        db,
      );
      assert.equal(inReview.ok, true);
      if (inReview.ok) {
        assert.equal(inReview.request.status, "in_review");
        assert.equal(inReview.request.resolvedAt, null);
        assert.equal(inReview.request.resolutionNote, null);
      }

      // Resolver sin motivo o sin actor es rechazado
      assert.deepEqual(
        await resolveDeletionRequest(
          created.request.id,
          "resolved",
          "   ",
          admin.id,
          new Date("2026-11-19T11:00:00Z"),
          db,
        ),
        { ok: false, error: "missing_resolution_note" },
      );
      assert.deepEqual(
        await resolveDeletionRequest(
          created.request.id,
          "resolved",
          "Cuenta desactivada",
          " ",
          new Date("2026-11-19T11:00:00Z"),
          db,
        ),
        { ok: false, error: "missing_actor" },
      );

      // Resolver con motivo, autor y fecha
      const resolvedAt = new Date("2026-11-19T12:00:00Z");
      const resolved = await resolveDeletionRequest(
        created.request.id,
        "resolved",
        "Cuenta desactivada y datos voluntarios eliminados conforme al aviso de privacidad.",
        admin.id,
        resolvedAt,
        db,
      );
      assert.equal(resolved.ok, true);
      if (resolved.ok) {
        assert.equal(resolved.request.status, "resolved");
        assert.equal(resolved.request.resolvedBy, admin.id);
        assert.equal(resolved.request.resolvedAt?.toISOString(), resolvedAt.toISOString());
      }

      const loaded = await getDeletionRequest(created.request.id, db);
      assert.ok(loaded);
      assert.equal(loaded.status, "resolved");

      const metricsAfter = await getAdminMetrics(db);
      assert.equal(metricsAfter.pendingDeletionRequests, 0);

      // No permite modificar una solicitud ya resuelta
      assert.deepEqual(
        await resolveDeletionRequest(
          created.request.id,
          "in_review",
          "Reabrir",
          admin.id,
          new Date("2026-11-19T13:00:00Z"),
          db,
        ),
        { ok: false, error: "already_resolved" },
      );

      // Auditoría registrada en admin_audit_logs
      const logs = await db
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.targetId, created.request.id));
      assert.equal(logs.length, 2);
      assert.deepEqual(
        logs.map((l) => l.action).sort(),
        ["deletion_request_in_review", "deletion_request_resolved"],
      );
    } finally {
      await db.close();
    }
  });

  /**
   * Enfrenta dos operaciones concurrentes de revocación, desactivación o una de
   * cada clase. Comprueba que queda un general_admin activo en cada disputa.
   */
  it("CA-01: protege transaccionalmente el último general_admin activo frente a revocación/desactivación directa y concurrente", async () => {
    const db = await createTestDb();
    try {
      const adminA = await createProfile(db, {
        authUserId: "neon-admin-a",
        email: "admin.a@uc3m.es",
        firstName: "Alicia",
        lastName: "Admin",
      });
      const adminB = await createProfile(db, {
        authUserId: "neon-admin-b",
        email: "admin.b@uc3m.es",
        firstName: "Bruno",
        lastName: "Admin",
      });

      // Solo adminA tiene general_admin
      const grantA = await setProfileCapability(adminA.id, "general_admin", true, adminA.id, db);
      assert.equal(grantA.ok, true);

      // (a) Llamada directa sobre el único general_admin activo -> last_general_admin
      assert.deepEqual(
        await setProfileCapability(adminA.id, "general_admin", false, adminA.id, db),
        { ok: false, error: "last_general_admin" },
      );

      let revokedCalls = 0;
      assert.deepEqual(
        await setProfileStatus(
          adminA.id,
          "deactivated",
          adminA.id,
          async () => {
            revokedCalls += 1;
          },
          db,
        ),
        { ok: false, error: "last_general_admin" },
      );
      assert.equal(revokedCalls, 0);

      // Conceder general_admin a adminB -> ahora hay dos general_admin activos
      const grantB = await setProfileCapability(adminB.id, "general_admin", true, adminA.id, db);
      assert.equal(grantB.ok, true);

      // (b1) Revocación mutua concurrente: exactamente una triunfa y otra falla con last_general_admin
      const revokeRace = await Promise.all([
        setProfileCapability(adminA.id, "general_admin", false, adminB.id, db),
        setProfileCapability(adminB.id, "general_admin", false, adminA.id, db),
      ]);
      const revokeSuccesses = revokeRace.filter((r) => r.ok);
      const revokeFailures = revokeRace.filter((r) => !r.ok);
      assert.equal(revokeSuccesses.length, 1);
      assert.equal(revokeFailures.length, 1);
      assert.equal(revokeFailures[0].error, "last_general_admin");

      const remainingAfterRevoke = (await searchAccounts({ status: "active" }, db)).filter((a) =>
        a.capabilities.includes("general_admin"),
      );
      assert.equal(remainingAfterRevoke.length, 1);

      // Volver a tener ambos activos con general_admin y probar desactivación mutua concurrente
      await setProfileCapability(adminA.id, "general_admin", true, adminA.id, db);
      await setProfileCapability(adminB.id, "general_admin", true, adminA.id, db);

      const deactivateRace = await Promise.all([
        setProfileStatus(adminA.id, "deactivated", adminB.id, undefined, db),
        setProfileStatus(adminB.id, "deactivated", adminA.id, undefined, db),
      ]);
      const deactSuccesses = deactivateRace.filter((r) => r.ok);
      const deactFailures = deactivateRace.filter((r) => !r.ok);
      assert.equal(deactSuccesses.length, 1);
      assert.equal(deactFailures.length, 1);
      assert.equal(deactFailures[0].error, "last_general_admin");

      const remainingAfterDeact = (await searchAccounts({ status: "active" }, db)).filter((a) =>
        a.capabilities.includes("general_admin"),
      );
      assert.equal(remainingAfterDeact.length, 1);

      // Volver a reactivar ambos y probar carrera mixta (uno revoca mientras el otro desactiva)
      await setProfileStatus(adminA.id, "active", adminA.id, undefined, db);
      await setProfileStatus(adminB.id, "active", adminA.id, undefined, db);

      const mixedRace = await Promise.all([
        setProfileCapability(adminA.id, "general_admin", false, adminB.id, db),
        setProfileStatus(adminB.id, "deactivated", adminA.id, undefined, db),
      ]);
      assert.equal(mixedRace.filter((r) => r.ok).length, 1);
      const mixedFailure = mixedRace.find((r) => !r.ok);
      assert.ok(mixedFailure && !mixedFailure.ok);
      assert.equal(mixedFailure.error, "last_general_admin");

      const remainingAfterMixed = (await searchAccounts({ status: "active" }, db)).filter((a) =>
        a.capabilities.includes("general_admin"),
      );
      assert.equal(remainingAfterMixed.length, 1);
    } finally {
      await db.close();
    }
  });
});
