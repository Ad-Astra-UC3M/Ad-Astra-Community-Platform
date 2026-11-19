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
