import { db } from "./db";

type Participant = { id: string; name: string };
type BookingStatus = "booked" | "attended";

export type ActivityImage = {
  imageUrl: string;
  imageAlt: string;
  position: number;
};

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

export type Activity = ActivitySummary & {
  shifts: Shift[];
  images: ActivityImage[];
  coverImage: ActivityImage | null;
};

type AlternativeShift = {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  available: number;
};

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
  alternativeShifts: AlternativeShift[];
};

const workshopId = "cubesat-lab";
const workshopTitle = "Taller de integración de un CubeSat";
const workshopLocation = "Aula de prototipado · Campus de Leganés";
const workshopDescription =
  "Monta la estructura de un CubeSat didáctico y comprueba el encaje de sus placas. " +
  "En grupos pequeños, conectaréis los subsistemas y repasaréis la lista de verificación antes de la integración. " +
  "Los dos turnos cubren la misma práctica.";

const visitId = "propulsion-visit";
const visitTitle = "Visita guiada al banco de ensayos";
const visitLocation = "Laboratorio de propulsión · Campus de Leganés";
const visitDescription =
  "Recorrido técnico por la bancada de pruebas de propulsión y la instrumentación de telemetría de Ad Astra UC3M. " +
  "Sesión única con explicación del protocolo de seguridad y demostración en frío.";

const avionicsId = "avionics-lab";
const avionicsTitle = "Práctica de telemetría y aviónica";
const avionicsLocation = "Laboratorio de electrónica · Campus de Leganés";
const avionicsDescription =
  "Configura una estación receptora LoRa y valida las tramas de telemetría de un cohete experimental. " +
  "Puedes reservar cualquiera de los dos grupos equivalentes y cambiar de turno si lo necesitas antes del inicio.";

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

  CREATE TABLE IF NOT EXISTS demo_activity_images (
    workspace_id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_alt TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position > 0),
    PRIMARY KEY (workspace_id, activity_id, position),
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

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function seedWorkspace(workspaceId: string) {
  const existing = db.prepare(
    "SELECT COUNT(*) AS count FROM demo_activities WHERE workspace_id = ? AND id IN (?, ?, ?)",
  ).get(workspaceId, workshopId, visitId, avionicsId) as { count: number };
  if (existing.count === 3) return;

  writeTransaction(() => {
    const now = new Date();
    const dayWorkshop = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10] as const;
    const dayVisit = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 12] as const;
    const dayAvionics = [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 14] as const;

    const insertActivity = db.prepare(`
      INSERT INTO demo_activities (workspace_id, id, title, description, location)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id, id) DO NOTHING
    `);
    const insertShift = db.prepare(`
      INSERT INTO demo_activity_shifts (workspace_id, id, activity_id, name, starts_at, ends_at, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id, id) DO NOTHING
    `);
    const insertImage = db.prepare(`
      INSERT INTO demo_activity_images (workspace_id, activity_id, image_url, image_alt, position)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (workspace_id, activity_id, position) DO NOTHING
    `);

    const workshop = insertActivity.run(
      workspaceId, workshopId, workshopTitle, workshopDescription, workshopLocation,
    );
    if (workshop.changes > 0) {
      insertShift.run(
        workspaceId, "cubesat-lab-early", workshopId, "Turno de mañana",
        Date.UTC(...dayWorkshop, 9, 30), Date.UTC(...dayWorkshop, 11), 8,
      );
      insertShift.run(
        workspaceId, "cubesat-lab-late", workshopId, "Turno de tarde",
        Date.UTC(...dayWorkshop, 15, 30), Date.UTC(...dayWorkshop, 17), 1,
      );
      db.prepare(`
        INSERT INTO demo_activity_reservations (workspace_id, shift_id, person_id, person_name, reserved_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (workspace_id, shift_id, person_id) DO NOTHING
      `).run(workspaceId, "cubesat-lab-late", "demo-attendee", "Participante de demostración", now.getTime());
    }

    const visit = insertActivity.run(
      workspaceId, visitId, visitTitle, visitDescription, visitLocation,
    );
    if (visit.changes > 0) {
      insertShift.run(
        workspaceId, "propulsion-visit-main", visitId, "Sesión única",
        Date.UTC(...dayVisit, 11, 0), Date.UTC(...dayVisit, 12, 30), 20,
      );
      insertImage.run(
        workspaceId,
        visitId,
        "https://www.adastrauc3m.es/og-image.png",
        "Vista general del banco de ensayos de propulsión de Ad Astra UC3M",
        1,
      );
      insertImage.run(
        workspaceId,
        visitId,
        "https://www.adastrauc3m.es/logo.png",
        "Instrumentación y panel de telemetría del laboratorio",
        2,
      );
    }

    const avionics = insertActivity.run(
      workspaceId, avionicsId, avionicsTitle, avionicsDescription, avionicsLocation,
    );
    if (avionics.changes > 0) {
      insertShift.run(
        workspaceId, "avionics-lab-a", avionicsId, "Grupo A",
        Date.UTC(...dayAvionics, 10, 0), Date.UTC(...dayAvionics, 11, 30), 6,
      );
      insertShift.run(
        workspaceId, "avionics-lab-b", avionicsId, "Grupo B",
        Date.UTC(...dayAvionics, 16, 0), Date.UTC(...dayAvionics, 17, 30), 6,
      );
    }
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

function readImages(workspaceId: string, activityId: string): ActivityImage[] {
  const images = db.prepare(`
    SELECT image_url AS imageUrl, image_alt AS imageAlt, position
    FROM demo_activity_images
    WHERE workspace_id = ? AND activity_id = ?
    ORDER BY position ASC
  `).all(workspaceId, activityId) as unknown as ActivityImage[];

  return images.map((image) => ({ ...image }));
}

export function addActivityImage(
  workspaceId: string,
  activityId: string,
  input: ActivityImage,
): "saved" | "invalid_url" | "missing_alt" | "invalid_position" | "duplicate_position" | "missing_activity" {
  seedWorkspace(workspaceId);
  const imageUrl = input.imageUrl.trim();
  const imageAlt = input.imageAlt.trim();
  if (!isValidHttpsUrl(imageUrl)) return "invalid_url";
  if (!imageAlt) return "missing_alt";
  if (!Number.isInteger(input.position) || input.position <= 0) return "invalid_position";

  return writeTransaction(() => {
    const activity = db.prepare(
      "SELECT 1 FROM demo_activities WHERE workspace_id = ? AND id = ?",
    ).get(workspaceId, activityId);
    if (!activity) return "missing_activity";

    const duplicate = db.prepare(
      "SELECT 1 FROM demo_activity_images WHERE workspace_id = ? AND activity_id = ? AND position = ?",
    ).get(workspaceId, activityId, input.position);
    if (duplicate) return "duplicate_position";

    db.prepare(`
      INSERT INTO demo_activity_images (workspace_id, activity_id, image_url, image_alt, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, activityId, imageUrl, imageAlt, input.position);
    return "saved";
  });
}

export function listActivities(workspaceId: string, personId: string): Activity[] {
  seedWorkspace(workspaceId);
  const activities = db.prepare(`
    SELECT id, title, description, location
    FROM demo_activities WHERE workspace_id = ? ORDER BY title, id
  `).all(workspaceId) as ActivitySummary[];

  return activities.map((activity) => {
    const images = readImages(workspaceId, activity.id);
    return {
      ...activity,
      shifts: readShifts(workspaceId, activity.id, personId),
      images,
      coverImage: images[0] ?? null,
    };
  });
}

export function getActivity(workspaceId: string, activityId: string, personId: string): Activity | undefined {
  seedWorkspace(workspaceId);
  const activity = db.prepare(`
    SELECT id, title, description, location
    FROM demo_activities WHERE workspace_id = ? AND id = ?
  `).get(workspaceId, activityId) as ActivitySummary | undefined;

  if (activity) {
    const images = readImages(workspaceId, activityId);
    return {
      ...activity,
      shifts: readShifts(workspaceId, activityId, personId),
      images,
      coverImage: images[0] ?? null,
    };
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
  `).all(workspaceId, personId) as unknown as Omit<Reservation, "canCancel" | "alternativeShifts">[];

  return rows.map((row) => {
    const canModify = row.status === "booked" && row.startsAt > now;
    const alternativeShifts = canModify
      ? readShifts(workspaceId, row.activityId, personId)
          .filter((shift) => shift.id !== row.shiftId && !shift.booking && shift.startsAt > now && shift.available > 0)
          .map(({ id, name, startsAt, endsAt, available }) => ({ id, name, startsAt, endsAt, available }))
      : [];

    return {
      ...row,
      canCancel: canModify,
      alternativeShifts,
    };
  });
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

export function changeReservation(
  workspaceId: string,
  personId: string,
  fromShiftId: string,
  toShiftId: string,
): "changed" | "same_shift" | "different_activity" | "missing" | "attended" | "closed" | "duplicate" | "full" {
  if (fromShiftId === toShiftId) return "same_shift";

  return writeTransaction(() => {
    const source = db.prepare(`
      SELECT shift.activity_id AS activityId, shift.starts_at AS startsAt,
        reservation.person_name AS personName, reservation.attended_at AS attendedAt
      FROM demo_activity_reservations AS reservation
      JOIN demo_activity_shifts AS shift
        ON shift.workspace_id = reservation.workspace_id AND shift.id = reservation.shift_id
      WHERE reservation.workspace_id = ? AND reservation.shift_id = ? AND reservation.person_id = ?
    `).get(workspaceId, fromShiftId, personId) as {
      activityId: string;
      startsAt: number;
      personName: string;
      attendedAt: number | null;
    } | undefined;

    if (!source) return "missing";
    if (source.attendedAt !== null) return "attended";

    const now = Date.now();
    if (source.startsAt <= now) return "closed";

    const target = db.prepare(`
      SELECT shift.activity_id AS activityId, shift.starts_at AS startsAt,
        shift.capacity - COUNT(reservation.person_id) AS available,
        MAX(CASE WHEN reservation.person_id = ? THEN 1 ELSE 0 END) AS alreadyBooked
      FROM demo_activity_shifts AS shift
      LEFT JOIN demo_activity_reservations AS reservation
        ON reservation.workspace_id = shift.workspace_id AND reservation.shift_id = shift.id
      WHERE shift.workspace_id = ? AND shift.id = ?
      GROUP BY shift.workspace_id, shift.id
    `).get(personId, workspaceId, toShiftId) as {
      activityId: string;
      startsAt: number;
      available: number;
      alreadyBooked: number;
    } | undefined;

    if (!target) return "missing";
    if (target.activityId !== source.activityId) return "different_activity";
    if (target.alreadyBooked === 1) return "duplicate";
    if (target.startsAt <= now) return "closed";
    if (target.available < 1) return "full";

    db.prepare(`
      DELETE FROM demo_activity_reservations
      WHERE workspace_id = ? AND shift_id = ? AND person_id = ?
    `).run(workspaceId, fromShiftId, personId);
    db.prepare(`
      INSERT INTO demo_activity_reservations (workspace_id, shift_id, person_id, person_name, reserved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, toShiftId, personId, source.personName, now);
    return "changed";
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
