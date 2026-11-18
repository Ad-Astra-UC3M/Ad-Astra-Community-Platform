import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelReservation,
  checkIn,
  listActivities,
  listAttendees,
  listReservations,
  listShifts,
  reserveShift,
} from "./activities";
import { db } from "./db";

const person = { id: "test-person", name: "Persona de prueba" };

function workshop(workspaceId: string) {
  const [activity] = listActivities(workspaceId, person.id);
  assert.ok(activity);
  const [first, second] = activity.shifts;
  assert.ok(first);
  assert.ok(second);
  return { activity, first, second };
}

test("ofrece dos turnos futuros con disponibilidad independiente", () => {
  const workspaceId = "catalog";
  const { activity, first, second } = workshop(workspaceId);

  assert.match(activity.title, /CubeSat/);
  assert.ok(first.startsAt > Date.now());
  assert.ok(first.endsAt > first.startsAt);
  assert.ok(second.startsAt > first.startsAt);
  assert.ok(first.available > 0);
  assert.equal(second.available, 0);
  assert.deepEqual(listShifts(workspaceId), activity.shifts.map((shift) => ({
    id: shift.id,
    name: shift.name,
    activityTitle: activity.title,
  })));
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
