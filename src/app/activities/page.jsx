import Link from "next/link";
import { listActivities } from "../../demo/activities";
import { requireUser } from "../../demo/session";

export default async function ActivitiesPage() {
  const user = await requireUser();
  const activities = listActivities(user.workspaceId, user.id);

  return (
    <main className="shell stack">
      <h1>Actividades</h1>
      {activities.map((activity) => {
        const singleShift = activity.shifts.length === 1;
        return (
          <article className="panel stack" key={activity.id}>
            {activity.coverImage && (
              <img
                src={activity.coverImage.imageUrl}
                alt={activity.coverImage.imageAlt}
                loading="lazy"
                style={{ width: "100%", maxHeight: "14rem", objectFit: "cover", borderRadius: "4px" }}
              />
            )}
            <header>
              <h2>{activity.title}</h2>
              <p>
                {activity.location}
                {singleShift ? " · Sesión única" : ` · ${activity.shifts.length} turnos`}
              </p>
            </header>
            <p>{activity.description}</p>
            <div>
              <Link className="button" href={`/activities/${activity.id}`}>
                {singleShift ? "Ver actividad" : "Ver turnos"}
              </Link>
            </div>
          </article>
        );
      })}
    </main>
  );
}
