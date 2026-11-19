import assert from "node:assert/strict";
import test from "node:test";
import { listAttendees, listReservations, reserveShift } from "./activities";
import {
  addActivityShift,
  correctAttendance,
  createAdminActivity,
  createAdminOpportunity,
  deleteShift,
  getAccountAdminDetail,
  getAdminMetrics,
  getDeletionRequest,
  getTalentAdminDetail,
  isAccountDeactivated,
  listAdminActivities,
  listAdminOpportunities,
  listAttendanceAudit,
  listDeletionRequests,
  manualConfirmAttendance,
  registerAtDoor,
  resolveDeletionRequest,
  searchAccounts,
  searchTalentProfiles,
  setActivityStatus,
  setAdminOpportunityStatus,
  updateShiftCapacity,
} from "./admin";
import { db } from "./db";
import { requestAccountDeletion, saveTalentProfile, setDisseminationDecision } from "./profile";
import { SessionStore } from "./session-store";

const store = new SessionStore(db);

function createVerifiedStudent(
  workspaceId: string,
  suffix: string,
  overrides: Partial<{ firstName: string; lastName: string; degree: string; course: string }> = {},
) {
  const token = `verify-${workspaceId}-${suffix}`;
  const created = store.createAccount(
    workspaceId,
    {
      firstName: overrides.firstName ?? `Lucía ${suffix}`,
      lastName: overrides.lastName ?? "Mendoza",
      email: `lucia.${suffix}@alumnos.uc3m.es`,
      degree: overrides.degree ?? "Ingeniería Aeroespacial",
      course: overrides.course ?? "3º",
      password: "PasswordSegura123",
    },
    token,
  );
  assert.equal(created, true);
  const user = store.verifyAccount(workspaceId, token);
  assert.ok(user);
  return user;
}

test("CA-10: inscripción manual en puerta, validación y rectificación auditadas en acciones separadas", () => {
  const workspaceId = "admin-door-ca10";
  const organizer = store.demoUser(workspaceId, "organizer");
  const student = createVerifiedStudent(workspaceId, "door1");
  const extraStudent = createVerifiedStudent(workspaceId, "door2");
  const deactivatedStudent = createVerifiedStudent(workspaceId, "door3");

  const start = Date.now() + 60 * 60 * 1000;
  const end = start + 2 * 60 * 60 * 1000;
  const created = createAdminActivity(
    workspaceId,
    {
      title: "Taller de propulsión en puerta",
      description: "Sesión práctica con dos turnos.",
      location: "Laboratorio 1.1",
      shifts: [
        { id: "door-shift-a", name: "Grupo A", startsAt: start, endsAt: end, capacity: 1 },
        { id: "door-shift-b", name: "Grupo B", startsAt: start + 3 * 60 * 60 * 1000, endsAt: end + 3 * 60 * 60 * 1000, capacity: 2 },
      ],
    },
    organizer.id,
  );
  assert.equal(created.ok, true);

  // Motivo obligatorio
  assert.deepEqual(
    registerAtDoor(workspaceId, "door-shift-a", student.id, organizer.id, "   "),
    { ok: false, error: "missing_reason" },
  );

  // Cuenta desactivada rechazada
  assert.equal(store.setAccountStatus(workspaceId, deactivatedStudent.id, "deactivated", organizer.id), true);
  assert.equal(isAccountDeactivated(workspaceId, deactivatedStudent.id), true);
  assert.equal(isAccountDeactivated(workspaceId, student.id), false);
  assert.deepEqual(
    registerAtDoor(workspaceId, "door-shift-a", deactivatedStudent.id, organizer.id, "Llegada en puerta"),
    { ok: false, error: "account_deactivated" },
  );

  // Alta en puerta con plaza: deja estado booked (attended_at = NULL) y registra auditoría
  const registered = registerAtDoor(
    workspaceId,
    "door-shift-a",
    student.id,
    organizer.id,
    "Alta presencial en acceso",
    start + 1000,
  );
  assert.equal(registered.ok, true);
  if (registered.ok) {
    assert.equal(registered.status, "booked");
  }
  const attendeesA = listAttendees(workspaceId, "door-shift-a");
  assert.deepEqual(attendeesA, [{ personId: student.id, name: student.name, attended: false }]);

  // Duplicado en el mismo turno: devuelve { ok: false, error: "duplicate", existing: true } sin duplicar
  assert.deepEqual(
    registerAtDoor(workspaceId, "door-shift-a", student.id, organizer.id, "Segundo intento"),
    { ok: false, error: "duplicate", existing: true },
  );
  assert.equal(listAttendees(workspaceId, "door-shift-a").length, 1);

  // Sin plaza en el turno A
  assert.deepEqual(
    registerAtDoor(workspaceId, "door-shift-a", extraStudent.id, organizer.id, "Sin aforo"),
    { ok: false, error: "full" },
  );

  // Permitido en otro turno de la misma actividad si hay plaza
  const secondShiftReg = registerAtDoor(
    workspaceId,
    "door-shift-b",
    student.id,
    organizer.id,
    "Cambio presencial a Grupo B",
    start + 2000,
  );
  assert.equal(secondShiftReg.ok, true);
  assert.equal(listReservations(workspaceId, student.id).length, 2);

  // Turno terminado rechazado (ends_at <= now)
  assert.deepEqual(
    registerAtDoor(workspaceId, "door-shift-b", extraStudent.id, organizer.id, "Fuera de hora", end + 3 * 60 * 60 * 1000),
    { ok: false, error: "shift_ended" },
  );

  // Confirmación manual en acción separada exige motivo
  assert.deepEqual(
    manualConfirmAttendance(workspaceId, "door-shift-a", student.id, organizer.id, ""),
    { ok: false, error: "missing_reason" },
  );

  const confirmed = manualConfirmAttendance(
    workspaceId,
    "door-shift-a",
    student.id,
    organizer.id,
    "Validado manualmente sin cámara",
    start + 5000,
  );
  assert.deepEqual(confirmed, { ok: true, previousStatus: "booked", newStatus: "attended" });
  assert.deepEqual(listAttendees(workspaceId, "door-shift-a"), [
    { personId: student.id, name: student.name, attended: true },
  ]);

  // Rectificación manual de attended -> booked conservando la plaza y exigiendo motivo
  assert.deepEqual(
    correctAttendance(workspaceId, "door-shift-a", student.id, "booked", organizer.id, "   "),
    { ok: false, error: "missing_reason" },
  );
  const rectified = correctAttendance(
    workspaceId,
    "door-shift-a",
    student.id,
    "booked",
    organizer.id,
    "Se marcó por error",
    start + 6000,
  );
  assert.deepEqual(rectified, { ok: true, previousStatus: "attended", newStatus: "booked" });
  assert.deepEqual(listAttendees(workspaceId, "door-shift-a"), [
    { personId: student.id, name: student.name, attended: false },
  ]);

  // Auditoría completa de las 3 operaciones en turno A
  const audit = listAttendanceAudit(workspaceId, "door-shift-a");
  assert.equal(audit.length, 3);
  assert.deepEqual(
    audit.map((entry) => ({
      action: entry.action,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      actorId: entry.actorId,
    })),
    [
      {
        action: "correction",
        previousStatus: "attended",
        newStatus: "booked",
        reason: "Se marcó por error",
        actorId: organizer.id,
      },
      {
        action: "manual_confirm",
        previousStatus: "booked",
        newStatus: "attended",
        reason: "Validado manualmente sin cámara",
        actorId: organizer.id,
      },
      {
        action: "door_registration",
        previousStatus: null,
        newStatus: "booked",
        reason: "Alta presencial en acceso",
        actorId: organizer.id,
      },
    ],
  );
});

test("CA-06: creación con turno 'normal' por defecto, aforo/borrado protegidos y archivo con historial", () => {
  const workspaceId = "admin-activities-ca06";
  const organizer = store.demoUser(workspaceId, "organizer");
  const student1 = createVerifiedStudent(workspaceId, "act1");
  const student2 = createVerifiedStudent(workspaceId, "act2");

  const start = Date.now() + 24 * 60 * 60 * 1000;
  const end = start + 2 * 60 * 60 * 1000;

  // Rechaza horario inválido y aforo <= 0
  assert.equal(
    createAdminActivity(
      workspaceId,
      { title: "Mala fecha", description: "Desc", location: "Aula", startsAt: end, endsAt: start, capacity: 10 },
      organizer.id,
    ).ok,
    false,
  );
  assert.equal(
    createAdminActivity(
      workspaceId,
      { title: "Mal aforo", description: "Desc", location: "Aula", startsAt: start, endsAt: end, capacity: 0 },
      organizer.id,
    ).ok,
    false,
  );

  // Rechaza imagen sin HTTPS o sin alt
  assert.deepEqual(
    createAdminActivity(
      workspaceId,
      {
        title: "Imagen insegura",
        description: "Desc",
        location: "Aula",
        startsAt: start,
        endsAt: end,
        capacity: 5,
        images: [{ imageUrl: "http://example.com/a.jpg", imageAlt: "Foto" }],
      },
      organizer.id,
    ),
    { ok: false, error: "invalid_image_url" },
  );
  assert.deepEqual(
    createAdminActivity(
      workspaceId,
      {
        title: "Imagen sin alt",
        description: "Desc",
        location: "Aula",
        startsAt: start,
        endsAt: end,
        capacity: 5,
        images: [{ imageUrl: "https://www.adastrauc3m.es/foto.jpg", imageAlt: "  " }],
      },
      organizer.id,
    ),
    { ok: false, error: "missing_image_alt" },
  );

  // Sin turnos explícitos crea automáticamente el turno 'normal' + imágenes ordenadas
  const created = createAdminActivity(
    workspaceId,
    {
      title: "Seminario de órbitas LEO",
      description: "Introducción a mecánica orbital aplicada.",
      location: "Salón de grados",
      startsAt: start,
      endsAt: end,
      capacity: 3,
      images: [
        { imageUrl: "https://www.adastrauc3m.es/orbita-1.jpg", imageAlt: "Portada del seminario", position: 1 },
        { imageUrl: "https://www.adastrauc3m.es/orbita-2.jpg", imageAlt: "Esquema de transferencia", position: 2 },
      ],
    },
    organizer.id,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.equal(created.activity.shifts.length, 1);
  assert.equal(created.activity.shifts[0].name, "normal");
  assert.equal(created.activity.shifts[0].capacity, 3);
  assert.equal(created.activity.images.length, 2);

  const normalShiftId = created.activity.shifts[0].id;
  assert.equal(reserveShift(workspaceId, created.activity.id, normalShiftId, student1), "reserved");
  assert.equal(reserveShift(workspaceId, created.activity.id, normalShiftId, student2), "reserved");

  // No permite reducir aforo por debajo de las 2 reservas vigentes ni borrar turno con participantes
  assert.deepEqual(updateShiftCapacity(workspaceId, normalShiftId, 1), {
    ok: false,
    error: "below_reserved",
    reservedCount: 2,
  });
  assert.deepEqual(updateShiftCapacity(workspaceId, normalShiftId, 2), {
    ok: true,
    shiftId: normalShiftId,
    capacity: 2,
    reservedCount: 2,
  });
  assert.deepEqual(deleteShift(workspaceId, normalShiftId), {
    ok: false,
    error: "has_participants",
    reservedCount: 2,
  });

  // Añadir turno auxiliar vacío y borrarlo sí está permitido
  const extraShift = addActivityShift(workspaceId, created.activity.id, {
    name: "Turno extra",
    startsAt: end + 60 * 60 * 1000,
    endsAt: end + 2 * 60 * 60 * 1000,
    capacity: 5,
  });
  assert.equal(extraShift.ok, true);
  if (extraShift.ok) {
    assert.deepEqual(deleteShift(workspaceId, extraShift.shift.id), { ok: true, shiftId: extraShift.shift.id });
  }

  // Publicar un borrador sin turnos válidos falla con no_valid_shifts
  const draft = createAdminActivity(
    workspaceId,
    {
      title: "Actividad borrador",
      description: "Pendiente de horario",
      location: "Campus Leganés",
      status: "draft",
      startsAt: start,
      endsAt: end,
      capacity: 4,
    },
    organizer.id,
  );
  assert.equal(draft.ok, true);
  if (draft.ok) {
    assert.deepEqual(deleteShift(workspaceId, draft.activity.shifts[0].id), {
      ok: true,
      shiftId: draft.activity.shifts[0].id,
    });
    assert.deepEqual(setActivityStatus(workspaceId, draft.activity.id, "published", organizer.id), {
      ok: false,
      error: "no_valid_shifts",
    });
  }

  // Archivar conserva el historial de reservas pero impide nuevas altas en puerta
  assert.deepEqual(setActivityStatus(workspaceId, created.activity.id, "archived", organizer.id), {
    ok: true,
    activityId: created.activity.id,
    status: "archived",
  });
  assert.equal(listAttendees(workspaceId, normalShiftId).length, 2);
  const thirdStudent = createVerifiedStudent(workspaceId, "act3");
  assert.deepEqual(
    registerAtDoor(workspaceId, normalShiftId, thirdStudent.id, organizer.id, "Intento en archivada"),
    { ok: false, error: "activity_not_published" },
  );

  const allActivities = listAdminActivities(workspaceId);
  assert.ok(allActivities.some((item) => item.id === created.activity.id && item.status === "archived"));
});

test("CA-01 y CA-05: métricas, búsqueda de cuentas sin exponer talento, consulta de talento separada y oportunidades admin", () => {
  const workspaceId = "admin-metrics-talent-ca01";
  const organizer = store.demoUser(workspaceId, "organizer");
  const studentA = createVerifiedStudent(workspaceId, "aero", {
    firstName: "Marina",
    lastName: "Soler",
    degree: "Ingeniería Aeroespacial",
    course: "4º",
  });
  const studentB = createVerifiedStudent(workspaceId, "teleco", {
    firstName: "Carlos",
    lastName: "Vega",
    degree: "Ingeniería de Telecomunicación",
    course: "2º",
  });

  // Reserva para studentA y perfil de talento para studentA
  assert.equal(reserveShift(workspaceId, "cubesat-lab", "cubesat-lab-early", studentA), "reserved");
  const savedTalent = saveTalentProfile(workspaceId, studentA.id, {
    university: "UC3M",
    graduationYear: 2027,
    headline: "Especialista en guiado y GNC",
    skills: ["Python", "Simulink", "GNC"],
    tools: ["MATLAB", "Git"],
    interests: ["Propulsión", "CubeSats"],
    links: [{ kind: "github", label: "GitHub", url: "https://github.com/marina-gnc" }],
  });
  assert.equal(savedTalent.ok, true);
  setDisseminationDecision(workspaceId, studentA.id, true);

  // Métricas generales
  const metrics = getAdminMetrics(workspaceId);
  assert.ok(metrics.totalAccounts >= 3);
  const earlyMetric = metrics.shifts.find((s) => s.shiftId === "cubesat-lab-early");
  assert.ok(earlyMetric);
  assert.equal(earlyMetric.reservedCount, 1);
  assert.equal(earlyMetric.attendedCount, 0);

  // Búsqueda y filtros de cuentas
  assert.equal(searchAccounts(workspaceId, { query: "Marina" }).length, 1);
  assert.equal(searchAccounts(workspaceId, { degree: "Telecomunicación" }).length, 1);
  assert.equal(searchAccounts(workspaceId, { course: "4º" }).length, 1);
  assert.equal(searchAccounts(workspaceId, { hasParticipation: "yes" }).some((a) => a.id === studentA.id), true);
  assert.equal(searchAccounts(workspaceId, { hasParticipation: "yes" }).some((a) => a.id === studentB.id), false);

  // Capacidades independientes y auditoría en detalle de cuenta (sin exponer talento)
  store.setCapability(workspaceId, studentA.id, "content_editing", true, organizer.id);
  const detail = getAccountAdminDetail(workspaceId, studentA.id);
  assert.ok(detail);
  assert.equal(detail.email, "lucia.aero@alumnos.uc3m.es");
  assert.equal(detail.reservations.length, 1);
  assert.deepEqual(detail.capabilities, ["content_editing"]);
  assert.equal(detail.capabilityAudit.length, 1);
  assert.equal(detail.capabilityAudit[0].action, "granted");
  assert.equal(detail.capabilityAudit[0].capability, "content_editing");
  assert.equal("skills" in detail, false);
  assert.equal("headline" in detail, false);
  assert.equal("links" in detail, false);
  assert.equal("talentProfile" in detail, false);

  // Consulta de talento separada sí busca por habilidades/herramientas/intereses y devuelve enlaces
  const talentResults = searchTalentProfiles(workspaceId, "Simulink");
  assert.equal(talentResults.length, 1);
  assert.equal(talentResults[0].accountId, studentA.id);
  assert.equal(talentResults[0].disseminationGranted, true);
  assert.equal(searchTalentProfiles(workspaceId, "Propulsión").length, 1);
  assert.equal(searchTalentProfiles(workspaceId, "Inexistente").length, 0);

  const talentDetail = getTalentAdminDetail(workspaceId, studentA.id);
  assert.ok(talentDetail);
  assert.equal(talentDetail.headline, "Especialista en guiado y GNC");
  assert.equal(talentDetail.links.length, 1);
  assert.equal(talentDetail.links[0].url, "https://github.com/marina-gnc");
  assert.equal(getTalentAdminDetail(workspaceId, studentB.id), null);

  // Gestión administrativa de oportunidades (borradores, publicadas, archivadas)
  const draftOpp = createAdminOpportunity(workspaceId, {
    type: "internship",
    title: "Borrador de prácticas en estructuras",
    organization: "Ad Astra Partners",
    description: "Análisis FEM de cohetes sonda.",
    contactEmail: "estructuras@partner.example",
    status: "draft",
  });
  assert.equal(draftOpp.ok, true);
  if (draftOpp.ok) {
    assert.ok(listAdminOpportunities(workspaceId).some((o) => o.id === draftOpp.opportunity.id && o.status === "draft"));
    const publishedOpp = setAdminOpportunityStatus(workspaceId, draftOpp.opportunity.id, "published");
    assert.equal(publishedOpp.ok, true);
    assert.ok(
      listAdminOpportunities(workspaceId).some((o) => o.id === draftOpp.opportunity.id && o.status === "published"),
    );
  }
  assert.ok(organizer.id);
});

test("CA-11: gestión y resolución motivada de solicitudes de supresión con autor y fecha", () => {
  const workspaceId = "admin-deletion-ca11";
  const organizer = store.demoUser(workspaceId, "organizer");
  const student = createVerifiedStudent(workspaceId, "del1");

  const createdReq = requestAccountDeletion(workspaceId, student.id, "Termino el grado este cuatrimestre.");
  assert.equal(createdReq.ok, true);
  if (!createdReq.ok) return;

  const list = listDeletionRequests(workspaceId);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, createdReq.request.id);
  assert.equal(list[0].status, "pending");

  // Paso a en revisión
  const inReview = resolveDeletionRequest(
    workspaceId,
    createdReq.request.id,
    "in_review",
    "Verificando historial antes de proceder.",
    organizer.id,
  );
  assert.equal(inReview.ok, true);
  if (inReview.ok) {
    assert.equal(inReview.request.status, "in_review");
    assert.equal(inReview.request.resolvedAt, null);
  }

  // Resolver sin motivo o sin autor es rechazado
  assert.deepEqual(
    resolveDeletionRequest(workspaceId, createdReq.request.id, "resolved", "   ", organizer.id),
    { ok: false, error: "missing_resolution_note" },
  );
  assert.deepEqual(
    resolveDeletionRequest(workspaceId, createdReq.request.id, "resolved", "Cuenta desactivada y datos revisados", " "),
    { ok: false, error: "missing_actor" },
  );

  // Resolver con motivo, autor y fecha
  const resolvedAt = Date.UTC(2026, 10, 19, 12, 0, 0);
  const resolved = resolveDeletionRequest(
    workspaceId,
    createdReq.request.id,
    "resolved",
    "Cuenta desactivada y datos voluntarios eliminados conforme al aviso de privacidad.",
    organizer.id,
    resolvedAt,
  );
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.request.status, "resolved");
    assert.equal(
      resolved.request.resolutionNote,
      "Cuenta desactivada y datos voluntarios eliminados conforme al aviso de privacidad.",
    );
    assert.equal(resolved.request.resolvedBy, organizer.id);
    assert.equal(resolved.request.resolvedAt, resolvedAt);
  }

  const loaded = getDeletionRequest(workspaceId, createdReq.request.id);
  assert.ok(loaded);
  assert.equal(loaded.status, "resolved");
  assert.equal(loaded.resolvedBy, organizer.id);

  // No permite volver a modificar una solicitud ya resuelta
  assert.deepEqual(
    resolveDeletionRequest(workspaceId, createdReq.request.id, "in_review", "Reabrir", organizer.id),
    { ok: false, error: "already_resolved" },
  );
});
