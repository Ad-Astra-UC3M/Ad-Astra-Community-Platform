import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrganizer } from "../../access";
import { listShifts, listAttendees } from "../../../../demo/activities";
import { Scanner } from "./scanner";
import { validateCard } from "./actions";

export default async function AttendancePage({params}: {params: Promise<{shiftId: string}>}) {
  const organizer = await requireOrganizer();
  const {shiftId} = await params;
  const shift = listShifts(organizer.workspaceId).find(item => item.id === shiftId);
  if (!shift) notFound();
  const attendees = listAttendees(organizer.workspaceId, shiftId);
  return <main className="shell stack">
    <Link href="/admin">← Volver a turnos</Link>
    <p className="eyebrow">Control de asistencia · {shift.name}</p>
    <h1>{shift.activityTitle}</h1>
    <Scanner action={validateCard.bind(null, shiftId)} />
    <section className="panel stack">
      <h2>Personas inscritas</h2>
      <p>{attendees.filter(person => person.attended).length} de {attendees.length} asistencias confirmadas</p>
      {attendees.length ? <ul>{attendees.map(person =>
        <li key={person.personId}>{person.name} · {person.attended ? "Asistido" : "Apuntado"}</li>)}</ul>
        : <p>Aún no hay reservas para este turno.</p>}
    </section>
  </main>;
}
