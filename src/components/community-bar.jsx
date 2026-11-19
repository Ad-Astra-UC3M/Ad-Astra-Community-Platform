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

const textButtonClass =
  "min-h-[44px] cursor-pointer border-0 bg-transparent py-2 text-left text-brand-primary underline underline-offset-4 transition-colors hover:text-brand-ink";

export async function CommunityBar({ role }) {
  const user = await currentUser();
  const effectiveRole = user?.role ?? role;
  const organizer = effectiveRole === "organizer";
  const capabilities = user?.capabilities ?? [];
  const showCapabilities = organizer || capabilities.length > 0;

  return (
    <aside
      className="border-t border-brand-primary/30 bg-brand-soft/20 print:hidden"
      aria-label="Sesión de demostración"
    >
      <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-x-6 px-6 py-1.5 text-[0.94rem] md:px-8">
        <p><strong>Modo demo</strong> · {organizer ? "Organizador" : "Estudiante"}</p>
        <div className="flex flex-wrap items-center gap-x-6">
          <form action={organizer ? demoStudent : demoOrganizer}>
            <button type="submit" className={textButtonClass}>
              {organizer ? "Volver a estudiante" : "Probar como organizador"}
            </button>
          </form>
          <form action={signOut}>
            <button type="submit" className={textButtonClass}>Cerrar sesión</button>
          </form>
        </div>
      </div>
      {showCapabilities && (
        <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-x-6 border-t border-brand-primary/15 px-6 py-1.5 text-[0.94rem] md:px-8">
          <p><strong>Capacidades</strong></p>
          <div className="flex flex-wrap items-center gap-x-6" role="group" aria-label="Capacidades de administración">
            {CAPABILITY_LABELS.map(({ id, label }) => {
              const active = capabilities.includes(id);
              return (
                <form key={id} action={toggleCurrentCapability}>
                  <input type="hidden" name="capability" value={id} />
                  <input type="hidden" name="enabled" value={active ? "false" : "true"} />
                  <button
                    type="submit"
                    className={textButtonClass}
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
