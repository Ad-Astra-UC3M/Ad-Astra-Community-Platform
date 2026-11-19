import {
  currentUser,
  demoOrganizer,
  demoStudent,
  signOut,
  toggleCurrentCapability,
} from "../demo/session";

const CAPABILITY_LABELS = [
  { id: "general_admin", label: "Admin general" },
  { id: "content_editing", label: "Edición de contenido" },
  { id: "attendance_validation", label: "Validación de asistencia" },
  { id: "talent_consultation", label: "Consulta de talento" },
];

export async function CommunityBar({ role }) {
  const user = await currentUser();
  const effectiveRole = user?.role ?? role;
  const organizer = effectiveRole === "organizer";
  const capabilities = user?.capabilities ?? [];
  const showCapabilities = organizer || capabilities.length > 0;

  return (
    <aside className="community-bar session-bar" aria-label="Sesión de demostración">
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
      {showCapabilities && (
        <div className="frame session-row">
          <p><strong>Capacidades</strong></p>
          <div className="session-actions" role="group" aria-label="Capacidades de administración">
            {CAPABILITY_LABELS.map(({ id, label }) => {
              const active = capabilities.includes(id);
              return (
                <form key={id} action={toggleCurrentCapability}>
                  <input type="hidden" name="capability" value={id} />
                  <input type="hidden" name="enabled" value={active ? "false" : "true"} />
                  <button
                    type="submit"
                    className="text-button"
                    aria-pressed={active}
                    data-capability={id}
                  >
                    {active ? "✓" : "○"} {label}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
