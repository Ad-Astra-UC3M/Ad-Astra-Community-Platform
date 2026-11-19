import assert from "node:assert/strict";
import test from "node:test";
import {
  addActivityImage,
  cancelReservation,
  changeReservation,
  checkIn,
  getActivity,
  listActivities,
  listAttendees,
  listReservations,
  listShifts,
  reserveShift,
} from "./activities";
import { db } from "./db";

const person = { id: "test-person", name: "Persona de prueba" };

function workshop(workspaceId: string) {
  const activity = listActivities(workspaceId, person.id).find((item) => item.id === "cubesat-lab");
  assert.ok(activity);
  const [first, second] = activity.shifts;
  assert.ok(first);
  assert.ok(second);
  return { activity, first, second };
}

test("ofrece dos turnos futuros con disponibilidad independiente y una actividad normal de turno único con imágenes ordenadas", () => {
  const workspaceId = "catalog";
  const { activity, first, second } = workshop(workspaceId);

  assert.match(activity.title, /CubeSat/);
  assert.ok(first.startsAt > Date.now());
  assert.ok(first.endsAt > first.startsAt);
  assert.ok(second.startsAt > first.startsAt);
  assert.ok(first.available > 0);
  assert.equal(second.available, 0);

  const singleShiftActivity = getActivity(workspaceId, "propulsion-visit", person.id);
  assert.ok(singleShiftActivity);
  assert.equal(singleShiftActivity.shifts.length, 1);
  assert.ok(singleShiftActivity.images.length >= 2);
  assert.deepEqual(
    singleShiftActivity.images.map((image) => image.position),
    [1, 2],
  );
  assert.deepEqual(singleShiftActivity.coverImage, singleShiftActivity.images[0]);

  const shifts = listShifts(workspaceId);
  assert.ok(shifts.some((shift) => shift.id === first.id && shift.activityTitle === activity.title));
  assert.ok(shifts.some((shift) => shift.id === second.id && shift.activityTitle === activity.title));
  assert.ok(shifts.some((shift) => shift.id === singleShiftActivity.shifts[0].id));
});

test("valida imágenes ordenadas por actividad (HTTPS, texto alternativo y posición positiva única)", () => {
  const workspaceId = "images";
  const { activity } = workshop(workspaceId);

  assert.equal(
    addActivityImage(workspaceId, activity.id, {
      imageUrl: "http://example.com/insegura.jpg",
      imageAlt: "No HTTPS",
      position: 1,
    }),
    "invalid_url",
  );
  assert.equal(
    addActivityImage(workspaceId, activity.id, {
      imageUrl: "javascript:alert(1)",
      imageAlt: "Esquema ejecutable",
      position: 1,
    }),
    "invalid_url",
  );
  assert.equal(
    addActivityImage(workspaceId, activity.id, {
      imageUrl: "https://www.adastrauc3m.es/cubesat-2.jpg",
      imageAlt: "   ",
      position: 1,
    }),
    "missing_alt",
  );
  assert.equal(
    addActivityImage(workspaceId, activity.id, {
      imageUrl: "https://www.adastrauc3m.es/cubesat-2.jpg",
      imageAlt: "Posición cero",
      position: 0,
    }),
    "invalid_position",
  );

  assert.equal(
    addActivityImage(workspaceId, activity.id, {
      imageUrl: "https://www.adastrauc3m.es/cubesat-detalle.jpg",
      imageAlt: "Detalle de las placas del CubeSat",
      position: 2,
    }),
    "saved",
  );
  assert.equal(
    addActivityImage(workspaceId, activity.id, {
      imageUrl: "https://www.adastrauc3m.es/cubesat-portada.jpg",
      imageAlt: "Estructura principal del CubeSat en mesa de montaje",
      position: 1,
    }),
    "saved",
  );
  assert.equal(
    addActivityImage(workspaceId, activity.id, {
      imageUrl: "https://www.adastrauc3m.es/duplicada.jpg",
      imageAlt: "Duplicada",
      position: 1,
    }),
    "duplicate_position",
  );

  const loaded = getActivity(workspaceId, activity.id, person.id);
  assert.ok(loaded);
  assert.deepEqual(
    loaded.images.map((image) => ({ position: image.position, imageAlt: image.imageAlt })),
    [
      { position: 1, imageAlt: "Estructura principal del CubeSat en mesa de montaje" },
      { position: 2, imageAlt: "Detalle de las placas del CubeSat" },
    ],
  );
  assert.equal(loaded.coverImage?.imageUrl, "https://www.adastrauc3m.es/cubesat-portada.jpg");
});

test("rechaza duplicados, respeta el aforo y libera una plaza al cancelar", () => {
  const workspaceId = "capacity";
  const { activity, first, second } = workshop(workspaceId);
  const reserve = (shiftId: string, participant = person) => (
    reserveShift(workspaceId, activity.id, shiftId, participant)
  );

  assert.equal(reserve(first.id), "reserved");
  assert.equal(reserve(first.id), "duplicate");
  assert.equal(reserve(second.id), "full");

  for (let index = 1; index < first.available; index++) {
    assert.equal(reserve(first.id, { id: `person-${index}`, name: `Participante ${index}` }), "reserved");
  }
  const nextPerson = { id: "next-person", name: "Siguiente participante" };
  assert.equal(reserve(first.id, nextPerson), "full");
  assert.equal(reserve(first.id), "duplicate");
  assert.equal(cancelReservation(workspaceId, person.id, first.id), "cancelled");
  assert.equal(cancelReservation(workspaceId, person.id, first.id), "missing");
  assert.equal(reserve(first.id, nextPerson), "reserved");
  assert.deepEqual(listReservations(workspaceId, person.id), []);

  const [seedAttendee] = listAttendees(workspaceId, second.id);
  assert.equal(cancelReservation(workspaceId, seedAttendee.personId, second.id), "cancelled");
  assert.equal(reserve(second.id, nextPerson), "reserved");
  assert.equal(listReservations(workspaceId, nextPerson.id).length, 2);
});

test("cambia de turno de forma atómica y conserva la reserva original si falla el destino", (context) => {
  const workspaceId = "shift-change";
  const { activity, first, second } = workshop(workspaceId);
  const singleShift = getActivity(workspaceId, "propulsion-visit", person.id);
  assert.ok(singleShift);

  assert.equal(reserveShift(workspaceId, activity.id, first.id, person), "reserved");

  // Destino completo: falla y conserva intacta la reserva original
  assert.equal(changeReservation(workspaceId, person.id, first.id, second.id), "full");
  assert.deepEqual(
    listReservations(workspaceId, person.id).map((row) => row.shiftId),
    [first.id],
  );

  // Mismo turno o actividad distinta
  assert.equal(changeReservation(workspaceId, person.id, first.id, first.id), "same_shift");
  assert.equal(changeReservation(workspaceId, person.id, first.id, singleShift.shifts[0].id), "different_activity");

  // Liberamos el turno de tarde y ejecutamos el cambio atómico
  const [seedAttendee] = listAttendees(workspaceId, second.id);
  assert.equal(cancelReservation(workspaceId, seedAttendee.personId, second.id), "cancelled");

  const reservationsBefore = listReservations(workspaceId, person.id);
  assert.deepEqual(
    reservationsBefore[0]?.alternativeShifts.map((shift) => shift.id),
    [second.id],
  );

  assert.equal(changeReservation(workspaceId, person.id, first.id, second.id), "changed");
  assert.deepEqual(
    listReservations(workspaceId, person.id).map((row) => row.shiftId),
    [second.id],
  );
  assert.equal(workshop(workspaceId).first.available, first.available);
  assert.equal(workshop(workspaceId).second.available, 0);

  // Si ya ha empezado el turno, el cambio se rechaza y conserva la reserva
  context.mock.timers.enable({ apis: ["Date"], now: first.startsAt });
  assert.equal(changeReservation(workspaceId, person.id, second.id, first.id), "closed");
  assert.deepEqual(
    listReservations(workspaceId, person.id).map((row) => row.shiftId),
    [second.id],
  );
});

test("registra asistencia una sola vez y solo para la participación exacta", () => {
  const workspaceId = "attendance";
  const { activity, first, second } = workshop(workspaceId);

  assert.equal(reserveShift(workspaceId, "other-activity", first.id, person), "missing");
  assert.equal(reserveShift(workspaceId, activity.id, first.id, person), "reserved");
  assert.equal(checkIn(workspaceId, second.id, person.id, "organizer"), "missing");
  assert.equal(checkIn("other-workspace", first.id, person.id, "organizer"), "missing");
  assert.equal(cancelReservation("other-workspace", person.id, first.id), "missing");
  assert.deepEqual(listReservations("other-workspace", person.id), []);
  assert.deepEqual(listAttendees("other-workspace", first.id), []);
  assert.deepEqual(listAttendees(workspaceId, first.id), [
    { personId: person.id, name: person.name, attended: false },
  ]);

  assert.equal(checkIn(workspaceId, first.id, person.id, "organizer"), "recorded");
  assert.equal(checkIn(workspaceId, first.id, person.id, "another-organizer"), "already");
  const attendance = db.prepare(`
    SELECT attended_at, attended_by, attendance_method FROM demo_activity_reservations
    WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
  `).get(workspaceId, first.id, person.id);
  assert.equal(typeof attendance?.attended_at, "number");
  assert.equal(attendance?.attended_by, "organizer");
  assert.equal(attendance?.attendance_method, "qr");
  assert.equal(cancelReservation(workspaceId, person.id, first.id), "attended");
  assert.equal(changeReservation(workspaceId, person.id, first.id, second.id), "attended");
  assert.equal(listReservations(workspaceId, person.id)[0]?.status, "attended");
  assert.deepEqual(listAttendees(workspaceId, first.id), [
    { personId: person.id, name: person.name, attended: true },
  ]);
  assert.equal(workshop(workspaceId).first.available, first.available - 1);
});

test("el inicio del turno cierra nuevas reservas y cancelaciones", (context) => {
  const workspaceId = "deadline";
  const { activity, first } = workshop(workspaceId);
  assert.equal(reserveShift(workspaceId, activity.id, first.id, person), "reserved");

  context.mock.timers.enable({ apis: ["Date"], now: first.startsAt });
  assert.equal(
    reserveShift(workspaceId, activity.id, first.id, { id: "late-person", name: "Otra persona" }),
    "closed",
  );
  assert.equal(cancelReservation(workspaceId, person.id, first.id), "closed");
  assert.equal(listReservations(workspaceId, person.id)[0]?.canCancel, false);
});

test("una actividad archivada conserva reservas previas pero impide nuevas reservas y cambios", () => {
  const workspaceId = "archived-activity";
  const { activity, first, second } = workshop(workspaceId);
  assert.equal(reserveShift(workspaceId, activity.id, first.id, person), "reserved");

  db.prepare(
    "UPDATE demo_activities SET status = 'archived' WHERE workspace_id = ? AND id = ?",
  ).run(workspaceId, activity.id);

  assert.equal(getActivity(workspaceId, activity.id, person.id), undefined);
  assert.equal(listActivities(workspaceId, person.id).some((item) => item.id === activity.id), false);
  assert.equal(
    reserveShift(workspaceId, activity.id, first.id, { id: "other-person", name: "Otra persona" }),
    "closed",
  );

  const [seedAttendee] = listAttendees(workspaceId, second.id);
  assert.equal(cancelReservation(workspaceId, seedAttendee.personId, second.id), "cancelled");
  assert.equal(changeReservation(workspaceId, person.id, first.id, second.id), "closed");
  assert.equal(listReservations(workspaceId, person.id).length, 1);
});
