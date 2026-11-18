import Link from "next/link";
import { listShifts } from "../../demo/activities";
import { requireOrganizer } from "./access";

export default async function AdminPage() {
  const organizer = await requireOrganizer();
  const shifts = listShifts(organizer.workspaceId);
  return <main className="shell stack">
    <p className="eyebrow">Organización</p>
    <h1>Control de asistencia</h1>
    <p>Elige el turno en el que vas a recibir a los participantes.</p>
    <ul className="stack">{shifts.map(shift =>
      <li className="panel" key={shift.id}>
        <strong>{shift.activityTitle}</strong>
        <p>{shift.name}</p>
        <Link className="button" href={`/admin/attendance/${shift.id}`}>Validar {shift.name}</Link>
      </li>
    )}</ul>
  </main>;
}
