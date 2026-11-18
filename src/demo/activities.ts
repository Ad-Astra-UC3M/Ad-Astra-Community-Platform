import { db } from "./db";

type Participant = { id: string; name: string };
type BookingStatus = "booked" | "attended";

type Shift = {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  capacity: number;
  available: number;
  booking: BookingStatus | null;
};

type ActivitySummary = {
  id: string;
  title: string;
  description: string;
  location: string;
};

type Activity = ActivitySummary & { shifts: Shift[] };

type Reservation = {
  shiftId: string;
  shiftName: string;
  activityId: string;
  activityTitle: string;
  location: string;
  startsAt: number;
  endsAt: number;
  status: BookingStatus;
  canCancel: boolean;
};

const workshopId = "cubesat-lab";
const workshopTitle = "Taller de integración de un CubeSat";
const workshopLocation = "Aula de prototipado · Campus de Leganés";
const workshopDescription =
  "Monta la estructura de un CubeSat didáctico y comprueba el encaje de sus placas. " +
  "En grupos pequeños, conectaréis los subsistemas y repasaréis la lista de verificación antes de la integración. " +
  "Los dos turnos cubren la misma práctica.";

db.exec(`
  CREATE TABLE IF NOT EXISTS demo_activities (
    workspace_id TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    PRIMARY KEY (workspace_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS demo_activity_shifts (
    workspace_id TEXT NOT NULL,
    id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    name TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    PRIMARY KEY (workspace_id, id),
    FOREIGN KEY (workspace_id, activity_id) REFERENCES demo_activities (workspace_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS demo_activity_reservations (
    workspace_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    person_name TEXT NOT NULL,
    reserved_at INTEGER NOT NULL,
    attended_at INTEGER,
    attended_by TEXT,
    attendance_method TEXT CHECK (attendance_method = 'qr'),
    PRIMARY KEY (workspace_id, shift_id, person_id),
    FOREIGN KEY (workspace_id, shift_id) REFERENCES demo_activity_shifts (workspace_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS demo_activity_cancellations (
    workspace_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    cancelled_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id, shift_id) REFERENCES demo_activity_shifts (workspace_id, id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS demo_activity_reservation_owner
    ON demo_activity_reservations (workspace_id, person_id);
`);

function writeTransaction<Result>(operation: () => Result): Result {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedWorkspace(workspaceId: string) {
  const existing = db.prepare(
    "SELECT 1 FROM demo_activities WHERE workspace_id = ? AND id = ?",
  ).get(workspaceId, workshopId);
  if (existing) return;

  writeTransaction(() => {
    const activity = db.prepare(`
      INSERT INTO demo_activities (workspace_id, id, title, description, location)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id, id) DO NOTHING
    `).run(workspaceId, workshopId, workshopTitle, workshopDescription, workshopLocation);
    if (activity.changes === 0) return;

    const now = new Date();
    const day = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10] as const;
    const insertShift = db.prepare(`
      INSERT INTO demo_activity_shifts (workspace_id, id, activity_id, name, starts_at, ends_at, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertShift.run(
      workspaceId, "cubesat-lab-early", workshopId, "Turno de mañana",
      Date.UTC(...day, 9, 30), Date.UTC(...day, 11), 8,
    );
    insertShift.run(
      workspaceId, "cubesat-lab-late", workshopId, "Turno de tarde",
      Date.UTC(...day, 15, 30), Date.UTC(...day, 17), 1,
    );
    db.prepare(`
      INSERT INTO demo_activity_reservations (workspace_id, shift_id, person_id, person_name, reserved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, "cubesat-lab-late", "demo-attendee", "Participante de demostración", now.getTime());
  });
}

function readShifts(workspaceId: string, activityId: string, personId: string): Shift[] {
  const shifts = db.prepare(`
    SELECT shift.id, shift.name,
      shift.starts_at AS startsAt, shift.ends_at AS endsAt, shift.capacity,
      shift.capacity - COUNT(reservation.person_id) AS available,
      MAX(CASE WHEN reservation.person_id = ? THEN
        CASE WHEN reservation.attended_at IS NULL THEN 'booked' ELSE 'attended' END
      END) AS booking
    FROM demo_activity_shifts AS shift
    LEFT JOIN demo_activity_reservations AS reservation
      ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
    WHERE shift.workspace_id = ? AND shift.activity_id = ?
    GROUP BY shift.workspace_id, shift.id
    ORDER BY shift.starts_at, shift.id
  `).all(personId, workspaceId, activityId) as unknown as Shift[];

  return shifts.map((shift) => ({ ...shift }));
}

export function listActivities(workspaceId: string, personId: string): Activity[] {
  seedWorkspace(workspaceId);
  const activities = db.prepare(`
    SELECT id, title, description, location
    FROM demo_activities WHERE workspace_id = ? ORDER BY title, id
  `).all(workspaceId) as ActivitySummary[];

  return activities.map((activity) => ({
    ...activity,
    shifts: readShifts(workspaceId, activity.id, personId),
  }));
}

export function getActivity(workspaceId: string, activityId: string, personId: string): Activity | undefined {
  seedWorkspace(workspaceId);
  const activity = db.prepare(`
    SELECT id, title, description, location
    FROM demo_activities WHERE workspace_id = ? AND id = ?
  `).get(workspaceId, activityId) as ActivitySummary | undefined;

  if (activity) {
    return { ...activity, shifts: readShifts(workspaceId, activityId, personId) };
  }
}

export function listShifts(workspaceId: string): { id: string; name: string; activityTitle: string }[] {
  seedWorkspace(workspaceId);
  const shifts = db.prepare(`
    SELECT shift.id, shift.name, activity.title AS activityTitle
    FROM demo_activity_shifts AS shift
    JOIN demo_activities AS activity
      ON activity.workspace_id = shift.workspace_id AND activity.id = shift.activity_id
    WHERE shift.workspace_id = ? ORDER BY shift.starts_at, shift.id
  `).all(workspaceId) as { id: string; name: string; activityTitle: string }[];

  return shifts.map((shift) => ({ ...shift }));
}

export function listReservations(workspaceId: string, personId: string): Reservation[] {
  const now = Date.now();
  const rows = db.prepare(`
    SELECT shift.id AS shiftId, shift.name AS shiftName,
      activity.id AS activityId, activity.title AS activityTitle, activity.location,
      shift.starts_at AS startsAt, shift.ends_at AS endsAt,
      CASE WHEN reservation.attended_at IS NULL THEN 'booked' ELSE 'attended' END AS status
    FROM demo_activity_reservations AS reservation
    JOIN demo_activity_shifts AS shift
      ON shift.workspace_id = reservation.workspace_id AND shift.id = reservation.shift_id
    JOIN demo_activities AS activity
      ON activity.workspace_id = shift.workspace_id AND activity.id = shift.activity_id
    WHERE reservation.workspace_id = ? AND reservation.person_id = ?
    ORDER BY shift.starts_at, shift.id
  `).all(workspaceId, personId) as unknown as Omit<Reservation, "canCancel">[];

  return rows.map((row) => ({
    ...row,
    canCancel: row.status === "booked" && row.startsAt > now,
  }));
}

export function reserveShift(
  workspaceId: string,
  activityId: string,
  shiftId: string,
  participant: Participant,
): "reserved" | "duplicate" | "full" | "closed" | "missing" {
  seedWorkspace(workspaceId);

  return writeTransaction(() => {
    const shift = readShifts(workspaceId, activityId, participant.id).find((row) => row.id === shiftId);
    if (!shift) return "missing";
    if (shift.booking) return "duplicate";

    const now = Date.now();
    if (shift.startsAt <= now) return "closed";
    if (shift.available < 1) return "full";

    db.prepare(`
      INSERT INTO demo_activity_reservations (workspace_id, shift_id, person_id, person_name, reserved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, shiftId, participant.id, participant.name, now);
    return "reserved";
  });
}

export function cancelReservation(
  workspaceId: string,
  personId: string,
  shiftId: string,
): "cancelled" | "attended" | "closed" | "missing" {
  return writeTransaction(() => {
    const reservation = db.prepare(`
      SELECT shift.starts_at AS startsAt, reservation.attended_at AS attendedAt
      FROM demo_activity_reservations AS reservation
      JOIN demo_activity_shifts AS shift
        ON shift.workspace_id = reservation.workspace_id AND shift.id = reservation.shift_id
      WHERE reservation.workspace_id = ? AND reservation.shift_id = ? AND reservation.person_id = ?
    `).get(workspaceId, shiftId, personId) as { startsAt: number; attendedAt: number | null } | undefined;

    if (!reservation) return "missing";
    if (reservation.attendedAt !== null) return "attended";
    const now = Date.now();
    if (reservation.startsAt <= now) return "closed";

    db.prepare(`
      DELETE FROM demo_activity_reservations WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
    `).run(workspaceId, shiftId, personId);
    db.prepare(`
      INSERT INTO demo_activity_cancellations (workspace_id, shift_id, person_id, cancelled_at)
      VALUES (?, ?, ?, ?)
    `).run(workspaceId, shiftId, personId, now);
    return "cancelled";
  });
}

export function listAttendees(
  workspaceId: string,
  shiftId: string,
): { personId: string; name: string; attended: boolean }[] {
  seedWorkspace(workspaceId);
  const rows = db.prepare(`
    SELECT person_id AS personId, person_name AS name, attended_at IS NOT NULL AS attended
    FROM demo_activity_reservations
    WHERE workspace_id = ? AND shift_id = ? ORDER BY person_name, person_id
  `).all(workspaceId, shiftId) as { personId: string; name: string; attended: number }[];

  return rows.map((row) => ({ ...row, attended: row.attended === 1 }));
}

export function checkIn(
  workspaceId: string,
  shiftId: string,
  personId: string,
  organizerId: string,
): "recorded" | "already" | "missing" {
  return writeTransaction(() => {
    const result = db.prepare(`
      UPDATE demo_activity_reservations
      SET attended_at = ?, attended_by = ?, attendance_method = 'qr'
      WHERE workspace_id = ? AND shift_id = ? AND person_id = ? AND attended_at IS NULL
    `).run(Date.now(), organizerId, workspaceId, shiftId, personId);
    if (result.changes > 0) return "recorded";

    const reservation = db.prepare(`
      SELECT 1 FROM demo_activity_reservations
      WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
    `).get(workspaceId, shiftId, personId);
    return reservation ? "already" : "missing";
  });
}
