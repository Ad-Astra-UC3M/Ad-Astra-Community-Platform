import Link from "next/link";
import { listActivities } from "../../demo/activities";
import { requireUser } from "../../demo/session";

export default async function ActivitiesPage() {
  const user = await requireUser();
  const activities = listActivities(user.workspaceId, user.id);

  return (
    <main className="shell stack">
      <h1>Actividades</h1>
      {activities.map((activity) => (
        <article className="panel stack" key={activity.id}>
          <header>
            <h2>{activity.title}</h2>
            <p>{activity.location}</p>
          </header>
          <p>{activity.description}</p>
          <div>
            <Link className="button" href={`/activities/${activity.id}`}>Ver turnos</Link>
          </div>
        </article>
      ))}
    </main>
  );
}
