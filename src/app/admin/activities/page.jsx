import { BackLink } from "../../../components/back-link";
import { listAdminActivities } from "../../../server/activities/admin";
import {
  addActivityImageAction,
  addActivityShiftAction,
  createAdminActivityAction,
  deleteShiftAction,
  setActivityStatusAction,
  updateShiftCapacityAction,
} from "./actions";

export const metadata = { title: "Gestión de actividades" };

const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const statusLabels = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
};

const statusMessages = new Map([
  ["created", "Actividad creada correctamente."],
  ["shift_added", "Turno añadido a la actividad."],
  ["image_added", "Imagen añadida a la galería de la actividad."],
  ["capacity_updated", "Aforo del turno actualizado."],
  ["shift_deleted", "Turno eliminado."],
  ["activity_published", "Actividad publicada."],
  ["activity_draft", "Actividad pasada a borrador."],
  ["activity_archived", "Actividad archivada. Se conserva el historial de reservas y asistencias."],
]);

const errorMessages = new Map([
  ["missing_actor", "No se pudo identificar a la persona editora."],
  ["missing_fields", "Completa título, descripción y ubicación."],
  ["invalid_status", "El estado indicado para la actividad no es válido."],
  ["invalid_slug", "El identificador de la actividad no es válido."],
  ["duplicate_slug", "Ya existe una actividad con ese identificador."],
  ["invalid_external_url", "La URL de inscripción externa debe empezar por https://."],
  ["invalid_schedule", "La fecha de fin debe ser posterior a la fecha de inicio."],
  ["invalid_capacity", "El aforo debe ser un número entero mayor que cero."],
  ["invalid_image_url", "Las imágenes deben usar una URL HTTPS válida."],
  ["invalid_url", "Las imágenes deben usar una URL HTTPS válida."],
  ["missing_image_alt", "Cada imagen requiere un texto alternativo descriptivo."],
  ["missing_alt", "Cada imagen requiere un texto alternativo descriptivo."],
  ["invalid_image_position", "La posición de imagen debe ser un entero positivo único."],
  ["invalid_position", "La posición de imagen debe ser un entero positivo único."],
  ["duplicate_position", "Ya existe una imagen en esa posición."],
  ["below_reserved", "No se puede reducir el aforo por debajo de las reservas vigentes."],
  ["has_participants", "No se puede borrar un turno que ya tiene participantes inscritos o historial registrado."],
  ["no_valid_shifts", "Para publicar una actividad es necesario al menos un turno válido."],
  ["missing_activity", "No se encontró la actividad indicada."],
  ["missing_shift", "No se encontró el turno indicado."],
]);

function defaultDateTimeInput(offsetHours) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";
const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";
const textareaClass = `${inputClass} resize-y`;
const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";
const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

export default async function AdminActivitiesPage({ searchParams }) {
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";

  const activities = await listAdminActivities();
  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);
  const defaultStart = defaultDateTimeInput(48);
  const defaultEnd = defaultDateTimeInput(50);

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="grid min-w-0 gap-4">
        <p className="text-[0.9rem] font-bold text-brand-primary">Edición de contenido</p>
        <h1>Actividades y turnos</h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-[1.55]">
          Crea actividades con turno «normal» por defecto o turnos múltiples, ajusta aforos sin afectar reservas
          existentes y gestiona su estado de publicación.
        </p>
      </header>

      {statusMessage && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink empty:hidden" role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-[4px] bg-brand-accent/35 px-4 py-3.5 text-brand-ink" role="alert">
          {errorMessage}
        </p>
      )}

      <section className={panelClass} aria-label="Crear nueva actividad">
        <h2>Nueva actividad</h2>
        <form action={createAdminActivityAction} className="grid min-w-0 gap-4">
          <label className={fieldClass}>
            Título
            <input className={inputClass} name="title" type="text" required maxLength={160} placeholder="Ejemplo: Seminario de propulsión" />
          </label>
          <label className={fieldClass}>
            Descripción
            <textarea className={textareaClass} name="description" required rows={3} maxLength={2000} />
          </label>
          <label className={fieldClass}>
            Ubicación
            <input className={inputClass} name="location" type="text" required maxLength={160} placeholder="Campus de Leganés" />
          </label>
          <label className={fieldClass}>
            Estado inicial
            <select className={inputClass} name="status" defaultValue="published">
              <option value="published">Publicada</option>
              <option value="draft">Borrador</option>
            </select>
          </label>
          <label className={fieldClass}>
            Nombre del turno (opcional; si se deja vacío se crea como «normal»)
            <input className={inputClass} name="shiftName" type="text" maxLength={80} placeholder="normal" />
          </label>
          <label className={fieldClass}>
            Inicio del turno
            <input className={inputClass} name="startsAt" type="datetime-local" required defaultValue={defaultStart} />
          </label>
          <label className={fieldClass}>
            Fin del turno
            <input className={inputClass} name="endsAt" type="datetime-local" required defaultValue={defaultEnd} />
          </label>
          <label className={fieldClass}>
            Aforo del turno
            <input className={inputClass} name="capacity" type="number" min={1} max={1000} required defaultValue={20} />
          </label>
          <label className={fieldClass}>
            Imagen de portada (URL HTTPS opcional)
            <input className={inputClass} name="imageUrl1" type="url" placeholder="https://www.adastrauc3m.es/og-image.png" />
          </label>
          <label className={fieldClass}>
            Texto alternativo de la portada (obligatorio si indicas imagen)
            <input className={inputClass} name="imageAlt1" type="text" maxLength={200} />
          </label>
          <label className={fieldClass}>
            Segunda imagen (URL HTTPS opcional)
            <input className={inputClass} name="imageUrl2" type="url" placeholder="https://www.adastrauc3m.es/logo.png" />
          </label>
          <label className={fieldClass}>
            Texto alternativo de la segunda imagen
            <input className={inputClass} name="imageAlt2" type="text" maxLength={200} />
          </label>
          <div>
            <button type="submit" className={primaryButtonClass}>Crear actividad</button>
          </div>
        </form>
      </section>

      <section className="grid min-w-0 gap-4" aria-label="Listado administrativo de actividades">
        <h2>Actividades existentes ({activities.length})</h2>
        {activities.map((activity) => (
          <article className={panelClass} key={activity.id}>
            <header className="grid min-w-0 gap-4">
              <p className="text-[0.9rem] font-bold text-brand-primary">{statusLabels[activity.status]} · {activity.location}</p>
              <h3>{activity.title}</h3>
              <p>{activity.description}</p>
            </header>

            <div className="flex flex-wrap items-center gap-3">
              {activity.status !== "published" && (
                <form action={setActivityStatusAction}>
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className={secondaryButtonClass}>Publicar</button>
                </form>
              )}
              {activity.status !== "draft" && (
                <form action={setActivityStatusAction}>
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className={secondaryButtonClass}>Pasar a borrador</button>
                </form>
              )}
              {activity.status !== "archived" && (
                <form action={setActivityStatusAction}>
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input type="hidden" name="status" value="archived" />
                  <button type="submit" className={secondaryButtonClass}>Archivar</button>
                </form>
              )}
            </div>

            <div className="grid min-w-0 gap-4">
              <h4>Turnos ({activity.shifts.length})</h4>
              {activity.shifts.length > 0 ? (
                <ul className="m-0 grid list-none gap-4 p-0">
                  {activity.shifts.map((shift) => (
                    <li className={panelClass} key={shift.id}>
                      <p>
                        <strong>{shift.name}</strong> · {dateTimeFormat.format(new Date(shift.startsAt))} –{" "}
                        {dateTimeFormat.format(new Date(shift.endsAt))}
                      </p>
                      <p>
                        {shift.capacity === null
                          ? `${shift.reservedCount} plazas ocupadas (aforo ilimitado)`
                          : `${shift.reservedCount}/${shift.capacity} plazas ocupadas`}{" "}
                        · {shift.attendedCount} asistencias
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <form action={updateShiftCapacityAction} className="flex flex-wrap items-end gap-3">
                          <input type="hidden" name="shiftId" value={shift.id} />
                          <label className={fieldClass}>
                            Nuevo aforo ({shift.name})
                            <input
                              className={inputClass}
                              name="capacity"
                              type="number"
                              min={1}
                              max={1000}
                              defaultValue={shift.capacity ?? ""}
                              placeholder="Ilimitado"
                            />
                          </label>
                          <button type="submit" className={secondaryButtonClass}>Actualizar aforo</button>
                        </form>
                        <form action={deleteShiftAction}>
                          <input type="hidden" name="shiftId" value={shift.id} />
                          <button type="submit" className={secondaryButtonClass}>Eliminar turno</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sin turnos configurados.</p>
              )}

              <details className="grid min-w-0 gap-3">
                <summary className="w-fit cursor-pointer py-2.5 font-bold text-brand-primary hover:text-brand-ink">
                  Añadir turno o imagen a «{activity.title}»
                </summary>
                <div className="grid min-w-0 gap-4 pt-2">
                  <form action={addActivityShiftAction} className="grid min-w-0 gap-4">
                    <input type="hidden" name="activityId" value={activity.id} />
                    <label className={fieldClass}>
                      Nombre del nuevo turno
                      <input className={inputClass} name="name" type="text" required maxLength={80} placeholder="Turno adicional" />
                    </label>
                    <label className={fieldClass}>
                      Inicio
                      <input className={inputClass} name="startsAt" type="datetime-local" required defaultValue={defaultStart} />
                    </label>
                    <label className={fieldClass}>
                      Fin
                      <input className={inputClass} name="endsAt" type="datetime-local" required defaultValue={defaultEnd} />
                    </label>
                    <label className={fieldClass}>
                      Aforo
                      <input className={inputClass} name="capacity" type="number" min={1} max={1000} required defaultValue={10} />
                    </label>
                    <div>
                      <button type="submit" className={secondaryButtonClass}>Añadir turno</button>
                    </div>
                  </form>

                  <form action={addActivityImageAction} className="grid min-w-0 gap-4">
                    <input type="hidden" name="activityId" value={activity.id} />
                    <label className={fieldClass}>
                      URL HTTPS de la imagen
                      <input className={inputClass} name="imageUrl" type="url" required placeholder="https://www.adastrauc3m.es/og-image.png" />
                    </label>
                    <label className={fieldClass}>
                      Texto alternativo
                      <input className={inputClass} name="imageAlt" type="text" required maxLength={200} />
                    </label>
                    <label className={fieldClass}>
                      Posición (1 = portada)
                      <input
                        className={inputClass}
                        name="position"
                        type="number"
                        min={1}
                        required
                        defaultValue={activity.images.length + 1}
                      />
                    </label>
                    <div>
                      <button type="submit" className={secondaryButtonClass}>Añadir imagen</button>
                    </div>
                  </form>
                </div>
              </details>
            </div>

            {activity.images.length > 0 && (
              <p>
                Imágenes ({activity.images.length}):{" "}
                {activity.images.map((img) => `#${img.position} ${img.imageAlt}`).join(" · ")}
              </p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
