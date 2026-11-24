import { Clock01Icon, Location01Icon, Tick01Icon, Ticket01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { PortalIcon, PortalMeta, portalDateFormat } from "./portal-ui";

const monthFormat = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "Europe/Madrid" });
const dayFormat = new Intl.DateTimeFormat("es-ES", { day: "2-digit", timeZone: "Europe/Madrid" });
const timeFormat = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Madrid",
});

function ReservationDate({ date, upcoming }) {
  const dateClass = upcoming
    ? "border-t-4 border-brand-accent bg-brand-ink text-brand-surface"
    : "border border-brand-line bg-brand-panel text-brand-ink";

  return (
    <time
      className={`grid min-w-[3.75rem] justify-items-center gap-1 rounded-md px-2 py-2.5 leading-tight sm:min-w-[4.5rem] ${dateClass}`}
      dateTime={date.toISOString()}
    >
      <span className="sr-only">{portalDateFormat.format(date)}</span>
      <strong aria-hidden="true" className="text-2xl leading-none tabular-nums sm:text-[1.75rem]">
        {dayFormat.format(date)}
      </strong>
      <span aria-hidden="true" className="capitalize">{monthFormat.format(date)}</span>
    </time>
  );
}

function ReservationStatus({ status, agendaSection }) {
  const attended = status === "attended";
  const active = agendaSection !== "history";
  const label = attended
    ? "Asistencia registrada"
    : {
        upcoming: "Reserva confirmada",
        ongoing: "En curso",
        history: "Sin asistencia registrada",
      }[agendaSection];

  return (
    <span className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm font-bold ${attended || active ? "bg-brand-accent" : "bg-brand-panel"}`}>
      <PortalIcon icon={attended ? Tick01Icon : Ticket01Icon} size={16} />
      {label}
    </span>
  );
}

function ReservationSummary({ reservation, start, end }) {
  const endDate = portalDateFormat.format(end);
  const endsSameDay = portalDateFormat.format(start) === endDate;

  return (
    <>
      <h3 className="font-serif text-[1.35rem] leading-tight font-bold normal-case sm:text-[1.5rem]">
        {reservation.activityStatus === "published" ? (
          <Link href={`/activities/${reservation.activityId}`} className="text-brand-ink hover:text-brand-primary">
            {reservation.activityTitle}
          </Link>
        ) : reservation.activityTitle}
      </h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.95rem]">
        <PortalMeta icon={Clock01Icon}>
          {reservation.shiftName},{" "}
          <time dateTime={start.toISOString()}>{timeFormat.format(start)}</time>
          {"–"}
          <time dateTime={end.toISOString()}>
            {endsSameDay ? timeFormat.format(end) : `${endDate}, ${timeFormat.format(end)}`}
          </time>
        </PortalMeta>
        <PortalMeta icon={Location01Icon}>{reservation.location}</PortalMeta>
      </div>
    </>
  );
}

export function ReservationAgendaCard({ reservation, children }) {
  const start = new Date(reservation.startsAt);
  const end = new Date(reservation.endsAt);

  return (
    <article className="grid min-w-0 content-start gap-5 rounded-lg border border-s-[5px] border-brand-control border-s-brand-primary bg-brand-panel p-4 sm:p-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        <ReservationDate date={start} upcoming />
        <div className="grid min-w-0 gap-2">
          <ReservationStatus status={reservation.status} agendaSection={reservation.agendaSection} />
          <ReservationSummary reservation={reservation} start={start} end={end} />
        </div>
      </div>
      {children}
    </article>
  );
}

export function ReservationHistoryRow({ reservation }) {
  const start = new Date(reservation.startsAt);
  const end = new Date(reservation.endsAt);

  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-2 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-4">
      <ReservationDate date={start} />
      <div className="grid min-w-0 gap-1.5">
        <ReservationSummary reservation={reservation} start={start} end={end} />
      </div>
      <div className="col-start-2 sm:col-start-auto">
        <ReservationStatus status={reservation.status} agendaSection={reservation.agendaSection} />
      </div>
    </div>
  );
}
