import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "../../../components/back-link";
import { getMyVisibleActivity } from "../../../server/activities/portal";
import { ShiftSchedule } from "../shift-schedule";
import { reserveActivityShift } from "./actions";

const messages = new Map([
  ["reserved", "Tu plaza está reservada."],
  ["duplicate", "Ya tienes una reserva en este turno."],
  ["full", "El turno se ha completado."],
  ["closed", "El turno ya ha empezado."],
  ["deactivated", "Tu cuenta está desactivada y no puede realizar reservas."],
  ["missing", "El turno ya no está disponible."],
]);

const panelClass =
  "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

function ShiftCard({ shift, reserve, singleShift, now }) {
  const closed = new Date(shift.startsAt).getTime() <= now;
  const hasCapacity = shift.available === null || shift.available > 0;
  const bookable = !closed && hasCapacity && !shift.booking;

  return (
    <article className={panelClass}>
      <h3 className="text-[1.2rem] leading-[1.3]">{shift.name}</h3>
      {singleShift && (
        <p className="text-[0.9rem] font-bold text-brand-primary">
          Turno único seleccionado automáticamente
        </p>
      )}
      <ShiftSchedule startsAt={shift.startsAt} endsAt={shift.endsAt} />
      {shift.locationOverride && <p>Ubicación del turno: {shift.locationOverride}</p>}
      {closed ? (
        <p>Inscripción cerrada</p>
      ) : shift.capacity === null || shift.available === null ? (
        <p>Aforo ilimitado</p>
      ) : (
        <p>
          {shift.available === 0
            ? "Completo"
            : `${shift.available} de ${shift.capacity} plazas libres`}
        </p>
      )}
      {shift.booking && (
        <div className="grid gap-3">
          <p>{shift.booking === "attended" ? "Asistencia registrada" : "Tienes una plaza reservada"}</p>
          <Link className={secondaryButtonClass} href="/my-activities">Ver mis actividades</Link>
        </div>
      )}
      {bookable && (
        <form action={reserve}>
          <input type="hidden" name="shiftId" value={shift.id} />
          <button className={primaryButtonClass} type="submit" aria-label={`Reservar plaza · ${shift.name}`}>
            Reservar plaza
          </button>
        </form>
      )}
    </article>
  );
}

export default async function ActivityPage({ params, searchParams }) {
  const [{ id }, { status }] = await Promise.all([params, searchParams]);
  const activity = await getMyVisibleActivity(id);
  if (!activity) notFound();

  const message = typeof status === "string" ? messages.get(status) : undefined;
  const reserve = reserveActivityShift.bind(null, activity.id);
  const now = Date.now();
  const singleShift = activity.shifts.length === 1;

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/activities">Volver a actividades</BackLink>
      <header className="grid min-w-0 gap-3">
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem]">
          {activity.title}
        </h1>
        <p>{activity.location}</p>
        <p>{activity.description}</p>
      </header>
      {activity.images.length > 0 && (
        <section className="grid min-w-0 gap-4" aria-label="Imágenes de la actividad">
          {activity.images.map((image, index) => (
            <figure key={image.id} className={`m-0 ${panelClass}`}>
              <img
                src={image.imageUrl}
                alt={image.imageAlt}
                loading={index === 0 ? "eager" : "lazy"}
                className="max-h-80 w-full rounded-[4px] object-cover"
              />
              <figcaption className="text-[0.95rem] text-brand-ink">
                {index === 0 ? `Portada · ${image.imageAlt}` : image.imageAlt}
              </figcaption>
            </figure>
          ))}
        </section>
      )}
      {message && (
        <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink" role="status">
          {message}
        </p>
      )}
      <section className="grid min-w-0 gap-4" aria-labelledby="turnos">
        <h2 id="turnos" className="font-display text-[1.25rem] leading-[1.22] font-normal uppercase">
          {singleShift ? "Inscripción" : "Turnos"}
        </h2>
        {activity.shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            reserve={reserve}
            singleShift={singleShift}
            now={now}
          />
        ))}
      </section>
    </main>
  );
}
