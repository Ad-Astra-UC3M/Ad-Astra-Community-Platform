import { demoOrganizer, demoStudent, signOut } from "../demo/session";
import { CommunityNavigation } from "./community-navigation";

type Role = "student" | "organizer";

export function CommunityBar({ role }: { role: Role }) {
  const organizer = role === "organizer";

  return (
    <aside className="community-bar" aria-label="Portal de Comunidad">
      <CommunityNavigation role={role} />
      <div className="session-bar">
        <div className="frame session-row">
          <p><strong>Modo demo</strong> · {organizer ? "Organizador" : "Estudiante"}</p>
          <div className="session-actions">
            <form action={organizer ? demoStudent : demoOrganizer}>
              <button type="submit" className="text-button">
                {organizer ? "Volver a estudiante" : "Probar como organizador"}
              </button>
            </form>
            <form action={signOut}>
              <button type="submit" className="text-button">Cerrar sesión</button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
