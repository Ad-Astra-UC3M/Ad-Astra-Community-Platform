import { BackLink } from "../../../components/back-link";
import { listAdminActivities } from "../../../demo/admin";
import { requireCapability } from "../access";
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
  ["missing_fields", "Completa título, descripción y ubicación."],
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
  ["has_participants", "No se puede borrar un turno que ya tiene participantes inscritos."],
  ["no_valid_shifts", "Para publicar una actividad es necesario al menos un turno válido."],
  ["missing_activity", "No se encontró la actividad indicada."],
  ["missing_shift", "No se encontró el turno indicado."],
]);

function defaultDateTimeInput(offsetHours) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

export default async function AdminActivitiesPage({ searchParams }) {
  const editor = await requireCapability("content_editing");
  const resolvedSearch = await searchParams;
  const statusCode = typeof resolvedSearch?.status === "string" ? resolvedSearch.status : "";
  const errorCode = typeof resolvedSearch?.error === "string" ? resolvedSearch.error : "";

  const activities = listAdminActivities(editor.workspaceId);
  const statusMessage = statusMessages.get(statusCode);
  const errorMessage = errorMessages.get(errorCode);
  const defaultStart = defaultDateTimeInput(48);
  const defaultEnd = defaultDateTimeInput(50);

  return (
    <main className="shell stack">
      <BackLink href="/admin">Volver al panel</BackLink>
      <header className="stack">
        <p className="eyebrow">Edición de contenido</p>
        <h1>Actividades y turnos</h1>
        <p className="lead">
          Crea actividades con turno «normal» por defecto o turnos múltiples, ajusta aforos sin afectar reservas
          existentes y gestiona su estado de publicación.
        </p>
      </header>

      {statusMessage && <p className="notice" role="status">{statusMessage}</p>}
      {errorMessage && <p className="notice" role="alert">{errorMessage}</p>}

      <section className="panel stack" aria-label="Crear nueva actividad">
        <h2>Nueva actividad</h2>
        <form action={createAdminActivityAction} className="stack">
          <label className="field">
            Título
            <input name="title" type="text" required maxLength={160} placeholder="Ejemplo: Seminario de propulsión" />
          </label>
          <label className="field">
            Descripción
            <textarea name="description" required rows={3} maxLength={2000} />
          </label>
          <label className="field">
            Ubicación
            <input name="location" type="text" required maxLength={160} placeholder="Campus de Leganés" />
          </label>
          <label className="field">
            Estado inicial
            <select name="status" defaultValue="published">
              <option value="published">Publicada</option>
              <option value="draft">Borrador</option>
            </select>
          </label>
          <label className="field">
            Nombre del turno (opcional; si se deja vacío se crea como «normal»)
            <input name="shiftName" type="text" maxLength={80} placeholder="normal" />
          </label>
          <label className="field">
            Inicio del turno
            <input name="startsAt" type="datetime-local" required defaultValue={defaultStart} />
          </label>
          <label className="field">
            Fin del turno
            <input name="endsAt" type="datetime-local" required defaultValue={defaultEnd} />
          </label>
          <label className="field">
            Aforo del turno
            <input name="capacity" type="number" min={1} max={1000} required defaultValue={20} />
          </label>
          <label className="field">
            Imagen de portada (URL HTTPS opcional)
            <input name="imageUrl1" type="url" placeholder="https://www.adastrauc3m.es/og-image.png" />
          </label>
          <label className="field">
            Texto alternativo de la portada (obligatorio si indicas imagen)
            <input name="imageAlt1" type="text" maxLength={200} />
          </label>
          <label className="field">
            Segunda imagen (URL HTTPS opcional)
            <input name="imageUrl2" type="url" placeholder="https://www.adastrauc3m.es/logo.png" />
          </label>
          <label className="field">
            Texto alternativo de la segunda imagen
            <input name="imageAlt2" type="text" maxLength={200} />
          </label>
          <div>
            <button type="submit" className="button">Crear actividad</button>
          </div>
        </form>
      </section>

      <section className="stack" aria-label="Listado administrativo de actividades">
        <h2>Actividades existentes ({activities.length})</h2>
        {activities.map((activity) => (
          <article className="panel stack" key={activity.id}>
            <header className="stack">
              <p className="eyebrow">{statusLabels[activity.status]} · {activity.location}</p>
              <h3>{activity.title}</h3>
              <p>{activity.description}</p>
            </header>

            <div className="action-row">
              {activity.status !== "published" && (
                <form action={setActivityStatusAction}>
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className="button secondary">Publicar</button>
                </form>
              )}
              {activity.status !== "draft" && (
                <form action={setActivityStatusAction}>
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className="button secondary">Pasar a borrador</button>
                </form>
              )}
              {activity.status !== "archived" && (
                <form action={setActivityStatusAction}>
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input type="hidden" name="status" value="archived" />
                  <button type="submit" className="button secondary">Archivar</button>
                </form>
              )}
            </div>

            <div className="stack">
              <h4>Turnos ({activity.shifts.length})</h4>
              {activity.shifts.length > 0 ? (
                <ul className="stack">
                  {activity.shifts.map((shift) => (
                    <li className="panel stack" key={shift.id}>
                      <p>
                        <strong>{shift.name}</strong> · {dateTimeFormat.format(new Date(shift.startsAt))} –{" "}
                        {dateTimeFormat.format(new Date(shift.endsAt))}
                      </p>
                      <p>
                        {shift.reservedCount}/{shift.capacity} plazas ocupadas · {shift.attendedCount} asistencias
                      </p>
                      <div className="action-row">
                        <form action={updateShiftCapacityAction} className="action-row">
                          <input type="hidden" name="shiftId" value={shift.id} />
                          <label className="field">
                            Nuevo aforo ({shift.name})
                            <input
                              name="capacity"
                              type="number"
                              min={1}
                              max={1000}
                              defaultValue={shift.capacity}
                              required
                            />
                          </label>
                          <button type="submit" className="button secondary">Actualizar aforo</button>
                        </form>
                        <form action={deleteShiftAction}>
                          <input type="hidden" name="shiftId" value={shift.id} />
                          <button type="submit" className="button secondary">Eliminar turno</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sin turnos configurados.</p>
              )}

              <details className="card-tools">
                <summary>Añadir turno o imagen a «{activity.title}»</summary>
                <div className="stack">
                  <form action={addActivityShiftAction} className="stack">
                    <input type="hidden" name="activityId" value={activity.id} />
                    <label className="field">
                      Nombre del nuevo turno
                      <input name="name" type="text" required maxLength={80} placeholder="Turno adicional" />
                    </label>
                    <label className="field">
                      Inicio
                      <input name="startsAt" type="datetime-local" required defaultValue={defaultStart} />
                    </label>
                    <label className="field">
                      Fin
                      <input name="endsAt" type="datetime-local" required defaultValue={defaultEnd} />
                    </label>
                    <label className="field">
                      Aforo
                      <input name="capacity" type="number" min={1} max={1000} required defaultValue={10} />
                    </label>
                    <div>
                      <button type="submit" className="button secondary">Añadir turno</button>
                    </div>
                  </form>

                  <form action={addActivityImageAction} className="stack">
                    <input type="hidden" name="activityId" value={activity.id} />
                    <label className="field">
                      URL HTTPS de la imagen
                      <input name="imageUrl" type="url" required placeholder="https://www.adastrauc3m.es/og-image.png" />
                    </label>
                    <label className="field">
                      Texto alternativo
                      <input name="imageAlt" type="text" required maxLength={200} />
                    </label>
                    <label className="field">
                      Posición (1 = portada)
                      <input
                        name="position"
                        type="number"
                        min={1}
                        required
                        defaultValue={activity.images.length + 1}
                      />
                    </label>
                    <div>
                      <button type="submit" className="button secondary">Añadir imagen</button>
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
