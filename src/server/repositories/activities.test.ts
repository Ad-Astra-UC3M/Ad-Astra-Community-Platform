import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { asc, eq } from "drizzle-orm";

import { createTestDb, type AppDb } from "../../db/client";
import {
  activities,
  participationEvents,
  participations,
  profiles,
  shifts,
} from "../../db/schema";
import {
  addActivityImage,
  cancelReservation,
  changeReservation,
  checkIn,
  getActivity,
  listActivities,
  listReservations,
  listShifts,
  reserveShift,
} from "./activities";

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
      firstName: "Ana",
      lastName: "García",
      degree: "Ingeniería Aeroespacial",
      course: "3º",
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

async function seedActivityWithShifts(
  db: AppDb,
  options: {
    slug?: string;
    title?: string;
    description?: string;
    location?: string;
    status?: "draft" | "published" | "archived";
    createdBy?: string;
    shifts?: Array<{
      name?: string;
      startsAt: Date;
      endsAt: Date;
      capacity: number | null;
      locationOverride?: string | null;
    }>;
  },
) {
  const suffix = randomUUID().slice(0, 8);
  const [activity] = await db
    .insert(activities)
    .values({
      slug: options.slug ?? `activity-${suffix}`,
      title: options.title ?? "Taller CubeSat",
      description: options.description ?? "Montaje y pruebas de integración.",
      location: options.location ?? "Campus de Leganés",
      status: options.status ?? "published",
      createdBy: options.createdBy ?? null,
      publishedAt: (options.status ?? "published") === "published" ? BASE_NOW : null,
    })
    .returning();

  const insertedShifts = [];
  for (const shiftInput of options.shifts ?? []) {
    const [shift] = await db
      .insert(shifts)
      .values({
        activityId: activity.id,
        name: shiftInput.name ?? "normal",
        startsAt: shiftInput.startsAt,
        endsAt: shiftInput.endsAt,
        capacity: shiftInput.capacity,
        locationOverride: shiftInput.locationOverride ?? null,
      })
      .returning();
    insertedShifts.push(shift);
  }

  return { activity, shifts: insertedShifts };
}

describe("activities PostgreSQL repository", () => {
  it("CA-06: lista solo actividades publicadas, resuelve por UUID o slug, ordena imágenes (portada = menor posición) y calcula plazas", async () => {
    const db = await createTestDb();
    try {
      const student = await createProfile(db);
      const organizer = await createProfile(db, { email: "org@uc3m.es" });

      const workshop = await seedActivityWithShifts(db, {
        slug: "cubesat-lab",
        title: "Taller de integración CubeSat",
        location: "Aula de prototipado · Leganés",
        status: "published",
        createdBy: organizer.id,
        shifts: [
          {
            name: "Turno mañana",
            startsAt: new Date("2026-12-01T09:00:00Z"),
            endsAt: new Date("2026-12-01T11:00:00Z"),
            capacity: 2,
          },
          {
            name: "Turno abierto",
            startsAt: new Date("2026-12-01T15:00:00Z"),
            endsAt: new Date("2026-12-01T17:00:00Z"),
            capacity: null,
          },
        ],
      });

      const draft = await seedActivityWithShifts(db, {
        slug: "borrador-secreto",
        title: "Actividad en borrador",
        status: "draft",
        shifts: [
          {
            startsAt: new Date("2026-12-02T10:00:00Z"),
            endsAt: new Date("2026-12-02T12:00:00Z"),
            capacity: 10,
          },
        ],
      });

      const archived = await seedActivityWithShifts(db, {
        slug: "actividad-archivada",
        title: "Actividad archivada",
        status: "archived",
      });

      // Validación de imágenes (CA-06)
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "http://example.com/insegura.jpg", imageAlt: "No HTTPS", position: 1 },
          db,
        ),
        "invalid_url",
      );
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "javascript:alert(1)", imageAlt: "XSS", position: 1 },
          db,
        ),
        "invalid_url",
      );
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "https://cdn.adastrauc3m.es/img.jpg", imageAlt: "   ", position: 1 },
          db,
        ),
        "missing_alt",
      );
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "https://cdn.adastrauc3m.es/img.jpg", imageAlt: "Posición inválida", position: 0 },
          db,
        ),
        "invalid_position",
      );
      assert.equal(
        await addActivityImage(
          randomUUID(),
          { imageUrl: "https://cdn.adastrauc3m.es/img.jpg", imageAlt: "Inexistente", position: 1 },
          db,
        ),
        "missing_activity",
      );

      // Inserción desordenada de posiciones
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "https://cdn.adastrauc3m.es/detalle.jpg", imageAlt: "Detalle de subsistemas", position: 3 },
          db,
        ),
        "saved",
      );
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "https://cdn.adastrauc3m.es/portada.jpg", imageAlt: "Estructura principal CubeSat", position: 1 },
          db,
        ),
        "saved",
      );
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "https://cdn.adastrauc3m.es/mesa.jpg", imageAlt: "Mesa de ensayo", position: 2 },
          db,
        ),
        "saved",
      );
      assert.equal(
        await addActivityImage(
          workshop.activity.id,
          { imageUrl: "https://cdn.adastrauc3m.es/duplicada.jpg", imageAlt: "Posición repetida", position: 1 },
          db,
        ),
        "duplicate_position",
      );

      const catalog = await listActivities(student.id, db);
      assert.equal(catalog.length, 1);
      assert.equal(catalog[0].id, workshop.activity.id);
      assert.equal(catalog[0].slug, "cubesat-lab");
      assert.deepEqual(
        catalog[0].images.map((img) => ({ position: img.position, imageAlt: img.imageAlt })),
        [
          { position: 1, imageAlt: "Estructura principal CubeSat" },
          { position: 2, imageAlt: "Mesa de ensayo" },
          { position: 3, imageAlt: "Detalle de subsistemas" },
        ],
      );
      assert.equal(catalog[0].coverImage?.imageUrl, "https://cdn.adastrauc3m.es/portada.jpg");
      assert.equal(catalog[0].shifts[0].available, 2);
      assert.equal(catalog[0].shifts[0].booking, null);
      assert.equal(catalog[0].shifts[1].capacity, null);
      assert.equal(catalog[0].shifts[1].available, null);

      const byUuid = await getActivity(workshop.activity.id, student.id, db);
      const bySlug = await getActivity("cubesat-lab", student.id, db);
      assert.deepEqual(byUuid, bySlug);

      assert.equal(await getActivity(draft.activity.id, student.id, db), undefined);
      assert.equal(await getActivity(draft.activity.slug, student.id, db), undefined);
      assert.equal(await getActivity(archived.activity.slug, student.id, db), undefined);
      assert.equal(await getActivity("no-existe", student.id, db), undefined);

      const allShifts = await listShifts(db);
      assert.ok(
        allShifts.some(
          (s) =>
            s.id === workshop.shifts[0].id &&
            s.activityId === workshop.activity.id &&
            s.activitySlug === "cubesat-lab" &&
            s.activityTitle === "Taller de integración CubeSat" &&
            s.capacity === 2,
        ),
      );
    } finally {
      await db.close();
    }
  });

  it("CA-07: permite dos turnos distintos por persona, rechaza duplicado/desactivado/cerrado y resuelve disputa concurrente por la última plaza", async () => {
    const db = await createTestDb();
    try {
      const studentA = await createProfile(db);
      const studentB = await createProfile(db);
      const deactivated = await createProfile(db, {
        status: "deactivated",
        deactivatedAt: BASE_NOW,
      });

      const { activity, shifts: [shiftMorning, shiftAfternoon, shiftPast, shiftUnlimited] } =
        await seedActivityWithShifts(db, {
          slug: "propulsion-lab",
          title: "Laboratorio de propulsión",
          status: "published",
          shifts: [
            {
              name: "Mañana",
              startsAt: new Date("2026-12-05T09:00:00Z"),
              endsAt: new Date("2026-12-05T11:00:00Z"),
              capacity: 2,
            },
            {
              name: "Tarde (última plaza)",
              startsAt: new Date("2026-12-05T15:00:00Z"),
              endsAt: new Date("2026-12-05T17:00:00Z"),
              capacity: 1,
            },
            {
              name: "Pasado",
              startsAt: new Date("2026-11-19T09:00:00Z"),
              endsAt: new Date("2026-11-19T11:00:00Z"),
              capacity: 5,
            },
            {
              name: "Sin límite",
              startsAt: new Date("2026-12-06T09:00:00Z"),
              endsAt: new Date("2026-12-06T11:00:00Z"),
              capacity: null,
            },
          ],
        });

      // Cuenta desactivada rechazada
      assert.equal(
        await reserveShift(activity.slug, shiftMorning.id, deactivated.id, BASE_NOW, db),
        "deactivated",
      );

      // Turno pasado cerrado y actividad incorrecta missing
      assert.equal(
        await reserveShift(activity.id, shiftPast.id, studentA.id, BASE_NOW, db),
        "closed",
      );
      assert.equal(
        await reserveShift("otra-actividad", shiftMorning.id, studentA.id, BASE_NOW, db),
        "missing",
      );

      // Misma persona reserva en dos turnos distintos
      assert.equal(
        await reserveShift(activity.slug, shiftMorning.id, studentA.id, BASE_NOW, db),
        "reserved",
      );
      assert.equal(
        await reserveShift(activity.id, shiftUnlimited.id, studentA.id, BASE_NOW, db),
        "reserved",
      );
      // Duplicado en mismo turno
      assert.equal(
        await reserveShift(activity.id, shiftMorning.id, studentA.id, BASE_NOW, db),
        "duplicate",
      );

      const reservationsA = await listReservations(studentA.id, db, BASE_NOW);
      assert.equal(reservationsA.length, 2);

      // Disputa concurrente por la última plaza (capacity = 1)
      const concurrentResults = await Promise.all([
        reserveShift(activity.id, shiftAfternoon.id, studentA.id, BASE_NOW, db),
        reserveShift(activity.id, shiftAfternoon.id, studentB.id, BASE_NOW, db),
      ]);
      assert.deepEqual([...concurrentResults].sort(), ["full", "reserved"]);

      const afternoonParticipations = await db
        .select()
        .from(participations)
        .where(eq(participations.shiftId, shiftAfternoon.id));
      assert.equal(afternoonParticipations.length, 1);

      const afternoonEvents = await db
        .select()
        .from(participationEvents)
        .where(eq(participationEvents.shiftId, shiftAfternoon.id));
      assert.equal(afternoonEvents.length, 1);
      assert.equal(afternoonEvents[0].eventType, "reserved");
      assert.equal(afternoonEvents[0].participationId, afternoonParticipations[0].id);
      assert.equal(afternoonEvents[0].actorProfileId, afternoonParticipations[0].personId);

      // Verificar disponibilidad actualizada y estado de reserva
      const loaded = await getActivity(activity.id, afternoonParticipations[0].personId, db);
      assert.ok(loaded);
      const afternoonView = loaded.shifts.find((s) => s.id === shiftAfternoon.id);
      assert.equal(afternoonView?.available, 0);
      assert.equal(afternoonView?.booking, "booked");
      const unlimitedView = loaded.shifts.find((s) => s.id === shiftUnlimited.id);
      assert.equal(unlimitedView?.available, null);
    } finally {
      await db.close();
    }
  });

  it("CA-08: cambia de turno atómicamente conservando participation_id, preserva origen ante fallo y conserva evento 'cancelled' tras borrar reserva", async () => {
    const db = await createTestDb();
    try {
      const studentA = await createProfile(db);
      const studentB = await createProfile(db);

      const main = await seedActivityWithShifts(db, {
        slug: "avionics-lab",
        title: "Práctica de aviónica",
        status: "published",
        shifts: [
          {
            name: "Grupo A",
            startsAt: new Date("2026-12-10T10:00:00Z"),
            endsAt: new Date("2026-12-10T12:00:00Z"),
            capacity: 2,
          },
          {
            name: "Grupo B",
            startsAt: new Date("2026-12-10T16:00:00Z"),
            endsAt: new Date("2026-12-10T18:00:00Z"),
            capacity: 1,
          },
          {
            name: "Grupo C",
            startsAt: new Date("2026-12-11T10:00:00Z"),
            endsAt: new Date("2026-12-11T12:00:00Z"),
            capacity: 3,
          },
        ],
      });

      const otherActivity = await seedActivityWithShifts(db, {
        slug: "other-activity",
        title: "Otra actividad",
        status: "published",
        shifts: [
          {
            name: "Único",
            startsAt: new Date("2026-12-12T10:00:00Z"),
            endsAt: new Date("2026-12-12T12:00:00Z"),
            capacity: 5,
          },
        ],
      });

      const [shiftA, shiftB, shiftC] = main.shifts;
      const [otherShift] = otherActivity.shifts;

      // Student A reserva Grupo A y Grupo C; Student B ocupa la única plaza de Grupo B
      assert.equal(await reserveShift(main.activity.id, shiftA.id, studentA.id, BASE_NOW, db), "reserved");
      assert.equal(await reserveShift(main.activity.id, shiftC.id, studentA.id, BASE_NOW, db), "reserved");
      assert.equal(await reserveShift(main.activity.id, shiftB.id, studentB.id, BASE_NOW, db), "reserved");

      const [initialReservation] = await listReservations(studentA.id, db, BASE_NOW);
      assert.ok(initialReservation);
      const originalParticipationId = initialReservation.participationId;
      assert.equal(initialReservation.shiftId, shiftA.id);
      assert.equal(initialReservation.canCancel, true);
      // Grupo B está lleno y Grupo C ya está reservado por studentA -> otherShifts vacío
      assert.deepEqual(initialReservation.otherShifts, []);

      // Fallos que deben preservar intacta la reserva original
      assert.equal(await changeReservation(studentA.id, shiftA.id, shiftA.id, BASE_NOW, db), "same_shift");
      assert.equal(
        await changeReservation(studentA.id, shiftA.id, otherShift.id, BASE_NOW, db),
        "different_activity",
      );
      assert.equal(await changeReservation(studentA.id, shiftA.id, shiftB.id, BASE_NOW, db), "full");
      assert.equal(await changeReservation(studentA.id, shiftA.id, shiftC.id, BASE_NOW, db), "duplicate");

      // Destino ya iniciado
      assert.equal(
        await changeReservation(studentA.id, shiftC.id, shiftA.id, shiftA.startsAt, db),
        "closed",
      );

      // Comprobar que la reserva original sigue intacta en shiftA con el mismo participation_id
      const stillInA = await db
        .select()
        .from(participations)
        .where(eq(participations.id, originalParticipationId));
      assert.equal(stillInA.length, 1);
      assert.equal(stillInA[0].shiftId, shiftA.id);

      // Liberamos Grupo B para ejecutar el cambio atómico
      assert.equal(await cancelReservation(studentB.id, shiftB.id, BASE_NOW, db), "cancelled");

      const beforeChange = await listReservations(studentA.id, db, BASE_NOW);
      const resA = beforeChange.find((r) => r.shiftId === shiftA.id);
      assert.deepEqual(
        resA?.otherShifts.map((s) => s.id),
        [shiftB.id],
      );

      // Cambio atómico A -> B conservando participation_id
      const changeTime = new Date("2026-11-20T12:05:00Z");
      assert.equal(await changeReservation(studentA.id, shiftA.id, shiftB.id, changeTime, db), "changed");

      const afterChangeRows = await db
        .select()
        .from(participations)
        .where(eq(participations.id, originalParticipationId));
      assert.equal(afterChangeRows.length, 1);
      assert.equal(afterChangeRows[0].shiftId, shiftB.id);
      assert.equal(afterChangeRows[0].status, "booked");

      const loaded = await getActivity(main.activity.id, studentA.id, db);
      assert.equal(loaded?.shifts.find((s) => s.id === shiftA.id)?.available, 2);
      assert.equal(loaded?.shifts.find((s) => s.id === shiftB.id)?.available, 0);

      // Cancelación borra participations pero conserva participation_id en participation_events
      const cancelTime = new Date("2026-11-21T10:00:00Z");
      assert.equal(await cancelReservation(studentA.id, shiftB.id, cancelTime, db), "cancelled");
      assert.equal(await cancelReservation(studentA.id, shiftB.id, cancelTime, db), "missing");

      const deletedRows = await db
        .select()
        .from(participations)
        .where(eq(participations.id, originalParticipationId));
      assert.equal(deletedRows.length, 0);

      const history = await db
        .select()
        .from(participationEvents)
        .where(eq(participationEvents.participationId, originalParticipationId))
        .orderBy(asc(participationEvents.createdAt), asc(participationEvents.id));
      assert.deepEqual(
        history.map((ev) => ({
          eventType: ev.eventType,
          shiftId: ev.shiftId,
          fromShiftId: ev.fromShiftId,
          actorProfileId: ev.actorProfileId,
          createdAt: ev.createdAt.getTime(),
        })),
        [
          {
            eventType: "reserved",
            shiftId: shiftA.id,
            fromShiftId: null,
            actorProfileId: studentA.id,
            createdAt: BASE_NOW.getTime(),
          },
          {
            eventType: "changed",
            shiftId: shiftB.id,
            fromShiftId: shiftA.id,
            actorProfileId: studentA.id,
            createdAt: changeTime.getTime(),
          },
          {
            eventType: "cancelled",
            shiftId: shiftB.id,
            fromShiftId: null,
            actorProfileId: studentA.id,
            createdAt: cancelTime.getTime(),
          },
        ],
      );

      // Re-reservar tras cancelar crea un nuevo participation_id distinto (spec §1.2B)
      const rebookTime = new Date("2026-11-21T11:00:00Z");
      assert.equal(await reserveShift(main.activity.id, shiftB.id, studentA.id, rebookTime, db), "reserved");
      const [newReservation] = (await listReservations(studentA.id, db, rebookTime)).filter(
        (r) => r.shiftId === shiftB.id,
      );
      assert.ok(newReservation);
      assert.notEqual(newReservation.participationId, originalParticipationId);

      // Cambios concurrentes cruzados (A -> B y B -> A) sin deadlock
      const swapTime = new Date("2026-11-21T12:00:00Z");
      assert.equal(await reserveShift(main.activity.id, shiftA.id, studentB.id, rebookTime, db), "reserved");
      const swapResults = await Promise.all([
        changeReservation(studentA.id, shiftB.id, shiftA.id, swapTime, db),
        changeReservation(studentB.id, shiftA.id, shiftB.id, swapTime, db),
      ]);
      assert.ok(swapResults.includes("changed"));

      // Si el turno ya empezó, cancelación devuelve closed
      assert.equal(await cancelReservation(studentA.id, shiftC.id, shiftC.startsAt, db), "closed");

      // Actividad archivada: impide cambiar de turno (closed) pero permite cancelar reserva previa
      await db
        .update(activities)
        .set({ status: "archived" })
        .where(eq(activities.id, main.activity.id));
      assert.equal(await changeReservation(studentA.id, shiftC.id, shiftA.id, BASE_NOW, db), "closed");
      assert.equal(await cancelReservation(studentA.id, shiftC.id, BASE_NOW, db), "cancelled");
    } finally {
      await db.close();
    }
  });

  it("CA-09: checkIn por QR registra una sola vez, no duplica participation_events al reescanear y rechaza cuentas desactivadas", async () => {
    const db = await createTestDb();
    try {
      const student = await createProfile(db);
      const otherStudent = await createProfile(db);
      const organizer1 = await createProfile(db, { email: "org1@uc3m.es" });
      const organizer2 = await createProfile(db, { email: "org2@uc3m.es" });

      const { activity, shifts: [shift1, shift2] } = await seedActivityWithShifts(db, {
        slug: "qr-workshop",
        title: "Taller con validación QR",
        status: "published",
        shifts: [
          {
            name: "Turno 1",
            startsAt: new Date("2026-12-15T10:00:00Z"),
            endsAt: new Date("2026-12-15T12:00:00Z"),
            capacity: 5,
          },
          {
            name: "Turno 2",
            startsAt: new Date("2026-12-15T15:00:00Z"),
            endsAt: new Date("2026-12-15T17:00:00Z"),
            capacity: 5,
          },
        ],
      });

      assert.equal(await reserveShift(activity.id, shift1.id, student.id, BASE_NOW, db), "reserved");
      assert.equal(await reserveShift(activity.id, shift1.id, otherStudent.id, BASE_NOW, db), "reserved");

      // Sin reserva en shift2 -> missing
      assert.equal(await checkIn(shift2.id, student.id, organizer1.id, BASE_NOW, db), "missing");

      // Escaneo doble concurrente: uno registra y el otro devuelve already sin duplicar evento
      const checkInTime = new Date("2026-12-15T10:05:00Z");
      const [firstScan, secondScan] = await Promise.all([
        checkIn(shift1.id, student.id, organizer1.id, checkInTime, db),
        checkIn(shift1.id, student.id, organizer2.id, new Date("2026-12-15T10:06:00Z"), db),
      ]);
      assert.deepEqual([firstScan, secondScan].sort(), ["already", "recorded"]);

      // Reescaneo secuencial adicional
      assert.equal(
        await checkIn(shift1.id, student.id, organizer2.id, new Date("2026-12-15T10:07:00Z"), db),
        "already",
      );

      const [part] = await db
        .select()
        .from(participations)
        .where(eq(participations.personId, student.id));
      assert.equal(part.status, "attended");
      assert.equal(part.attendanceMethod, "qr");
      assert.ok(part.attendedAt instanceof Date);
      assert.ok(part.validatedBy === organizer1.id || part.validatedBy === organizer2.id);

      const qrEvents = await db
        .select()
        .from(participationEvents)
        .where(eq(participationEvents.participationId, part.id));
      const attendanceQrEvents = qrEvents.filter((e) => e.eventType === "attendance_qr");
      assert.equal(attendanceQrEvents.length, 1);
      assert.equal(attendanceQrEvents[0].actorProfileId, part.validatedBy);

      // Tras asistencia no se puede cancelar ni cambiar
      assert.equal(await cancelReservation(student.id, shift1.id, BASE_NOW, db), "attended");
      assert.equal(await changeReservation(student.id, shift1.id, shift2.id, BASE_NOW, db), "attended");
      const [resView] = await listReservations(student.id, db, BASE_NOW);
      assert.equal(resView.status, "attended");
      assert.equal(resView.canCancel, false);
      assert.deepEqual(resView.otherShifts, []);

      // Cuenta desactivada rechazada al escanear QR
      await db
        .update(profiles)
        .set({ status: "deactivated", deactivatedAt: checkInTime })
        .where(eq(profiles.id, otherStudent.id));

      assert.equal(
        await checkIn(shift1.id, otherStudent.id, organizer1.id, checkInTime, db),
        "deactivated",
      );

      const [otherPart] = await db
        .select()
        .from(participations)
        .where(eq(participations.personId, otherStudent.id));
      assert.equal(otherPart.status, "booked");
    } finally {
      await db.close();
    }
  });
});
