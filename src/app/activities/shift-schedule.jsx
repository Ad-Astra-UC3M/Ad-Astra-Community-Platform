/**
 * @file Componente de presentación del horario compartido por el detalle de actividad y Mis
 * actividades.
 */

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const timeFormat = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Madrid",
});

/**
 * Representa el inicio y el fin en horario de Madrid y conserva los instantes ISO en los atributos
 * `dateTime`.
 * @param props Datos del turno que se muestra.
 * @param props.startsAt Instante de inicio usado para mostrar la fecha y la hora.
 * @param props.endsAt Instante de fin usado para mostrar la hora de cierre.
 * @returns Un párrafo con dos elementos `time`.
 */
export function ShiftSchedule({ startsAt, endsAt }) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return (
    <p className="text-brand-ink">
      <time dateTime={start.toISOString()}>{dateFormat.format(start)}, {timeFormat.format(start)}</time>
      {"–"}
      <time dateTime={end.toISOString()}>{timeFormat.format(end)}</time>
    </p>
  );
}
