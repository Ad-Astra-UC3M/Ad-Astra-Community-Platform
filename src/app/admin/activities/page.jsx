/**
 * @file Página de App Router para `/admin/activities`. Muestra las actividades y los formularios de
 * edición tras comprobar la capacidad correspondiente.
 */

import { BackLink } from "../../../components/back-link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../components/form-styles";
import { PageHeading, pageClassName } from "../../../components/page-layout";
import { portalAlertClassName, portalFeedbackClassName, portalPanelClassName } from "../../../components/portal-ui";
import TextSpanWrapper2 from "../../../institutional/components/ui/TextSpanWrapper2";
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

/**
 * Propone a `AdminActivitiesPage` las horas de inicio y fin para los formularios de turno.
 * @param offsetHours Horas que se suman al instante actual antes de leer la fecha y hora locales del
 * servidor.
 * @returns Una fecha con precisión de hora en el formato de `datetime-local`.
 */
function defaultDateTimeInput(offsetHours) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  /**
   * Añade el cero inicial a los valores de fecha y hora de `defaultDateTimeInput`.
   * @param value Mes, día u hora que se convierte a texto.
   * @returns La cadena con un mínimo de dos dígitos.
   */
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

const fieldClass = "grid min-w-0 gap-1.5 font-bold";
const textareaClass = `${inputClass} min-h-[5.5rem] resize-y`;

/**
 * Next.js llama a esta página de servidor. `listAdminActivities` exige `content_editing` antes de
 * cargar actividades, turnos y galerías. Los formularios enlazan a las Server Actions del panel.
 * @param props Propiedades de la página que proporciona Next.js.
 * @param props.searchParams Promesa con `status` o `error`, códigos que se traducen a avisos de la
 * operación.
 * @returns Los formularios de creación y edición y el listado de actividades y turnos.
 */
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
    <main className={pageClassName}>
      <BackLink href="/admin">Volver al panel</BackLink>
      <PageHeading
        eyebrow="Edición de contenido"
        title="Actividades y turnos"
        description="Crea actividades con turno «normal» por defecto o turnos múltiples, ajusta aforos sin afectar reservas existentes y gestiona su estado de publicación."
      />

      {statusMessage && (
        <p className={portalFeedbackClassName + " empty:hidden"} role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className={portalAlertClassName} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <section className={portalPanelClassName} aria-label="Crear nueva actividad">
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            Nueva actividad
          </TextSpanWrapper2>
          <form action={createAdminActivityAction} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className={fieldClass + " sm:col-span-2"}>
              Título
              <input className={inputClass} name="title" type="text" required maxLength={160} placeholder="Ejemplo: Seminario de propulsión" />
            </label>
            <label className={fieldClass + " sm:col-span-2"}>
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
              Aforo del turno
              <input className={inputClass} name="capacity" type="number" min={1} max={1000} required defaultValue={20} />
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
            <div className="sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>Crear actividad</button>
            </div>
          </form>
        </section>

        <section className="grid min-w-0 gap-4" aria-label="Listado administrativo de actividades">
          <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
            {`Actividades existentes (${activities.length})`}
          </TextSpanWrapper2>
          {activities.map((activity) => (
            <article className={portalPanelClassName} key={activity.id}>
              <header className="grid min-w-0 gap-2 border-b border-brand-line pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={
                      "inline-block rounded-sm border px-2.5 py-0.5 text-sm font-bold " +
                      (activity.status === "published"
                        ? "border-brand-line bg-brand-soft/45 text-brand-ink"
                        : activity.status === "draft"
                          ? "border-[#b79b30] bg-brand-accent text-brand-ink"
                          : "border-brand-line bg-brand-panel text-brand-ink")
                    }
                  >
                    {statusLabels[activity.status]}
                  </span>
                  <span className="text-sm font-bold text-brand-primary">{activity.location}</span>
                </div>
                <h3 className="text-xl text-brand-ink">{activity.title}</h3>
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

              <div className="grid min-w-0 gap-3 rounded-md border border-brand-line bg-brand-panel p-4">
                <h4 className="text-base text-brand-ink">Turnos ({activity.shifts.length})</h4>
                {activity.shifts.length > 0 ? (
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {activity.shifts.map((shift) => (
                      <li className="grid gap-3 rounded-md border border-brand-line bg-brand-surface p-3.5" key={shift.id}>
                        <div className="grid gap-0.5">
                          <p>
                            <strong>{shift.name}</strong> · {dateTimeFormat.format(new Date(shift.startsAt))} –{" "}
                            {dateTimeFormat.format(new Date(shift.endsAt))}
                          </p>
                          <p className="text-sm">
                            {shift.capacity === null
                              ? `${shift.reservedCount} plazas ocupadas (aforo ilimitado)`
                              : `${shift.reservedCount}/${shift.capacity} plazas ocupadas`}{" "}
                            · {shift.attendedCount} asistencias
                          </p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <form action={updateShiftCapacityAction} className="flex flex-wrap items-end gap-3">
                            <input type="hidden" name="shiftId" value={shift.id} />
                            <label className={fieldClass}>
                              <span className="text-sm">Nuevo aforo ({shift.name})</span>
                              <input
                                className={inputClass + " max-w-36"}
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

                <details className="grid min-w-0 gap-3 border-t border-brand-line pt-2">
                  <summary className="w-fit cursor-pointer py-2 font-bold text-brand-primary hover:text-brand-ink">
                    Añadir turno o imagen a «{activity.title}»
                  </summary>
                  <div className="grid min-w-0 gap-5 pt-2">
                    <form action={addActivityShiftAction} className="grid min-w-0 gap-3 rounded-md border border-brand-line bg-brand-surface p-4 sm:grid-cols-2">
                      <input type="hidden" name="activityId" value={activity.id} />
                      <label className={fieldClass}>
                        Nombre del nuevo turno
                        <input className={inputClass} name="name" type="text" required maxLength={80} placeholder="Turno adicional" />
                      </label>
                      <label className={fieldClass}>
                        Aforo
                        <input className={inputClass} name="capacity" type="number" min={1} max={1000} required defaultValue={10} />
                      </label>
                      <label className={fieldClass}>
                        Inicio
                        <input className={inputClass} name="startsAt" type="datetime-local" required defaultValue={defaultStart} />
                      </label>
                      <label className={fieldClass}>
                        Fin
                        <input className={inputClass} name="endsAt" type="datetime-local" required defaultValue={defaultEnd} />
                      </label>
                      <div className="sm:col-span-2">
                        <button type="submit" className={secondaryButtonClass}>Añadir turno</button>
                      </div>
                    </form>

                    <form action={addActivityImageAction} className="grid min-w-0 gap-3 rounded-md border border-brand-line bg-brand-surface p-4 sm:grid-cols-2">
                      <input type="hidden" name="activityId" value={activity.id} />
                      <label className={fieldClass + " sm:col-span-2"}>
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
                      <div className="sm:col-span-2">
                        <button type="submit" className={secondaryButtonClass}>Añadir imagen</button>
                      </div>
                    </form>
                  </div>
                </details>
              </div>

              {activity.images.length > 0 && (
                <p className="text-sm">
                  <strong>Imágenes ({activity.images.length}):</strong>{" "}
                  {activity.images.map((img) => `#${img.position} ${img.imageAlt}`).join(" · ")}
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
