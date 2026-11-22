import { HugeiconsIcon } from "@hugeicons/react";

export const portalPanelClassName =
  "grid min-w-0 content-start gap-4 rounded-lg border border-brand-line p-4 sm:p-6";

export const portalFeedbackClassName =
  "rounded-sm border-s-4 border-brand-primary bg-brand-panel px-4 py-3 text-brand-ink";

export const portalDateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

export function PortalIcon({ icon, size = 18, className = "" }) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={1.6}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export function PortalMeta({ icon, children }) {
  return (
    <span className="inline-flex min-w-0 items-start gap-2 [overflow-wrap:anywhere]">
      <PortalIcon icon={icon} className="mt-0.5 text-brand-primary" />
      <span>{children}</span>
    </span>
  );
}

export function ActivityDates({ shifts }) {
  const first = new Date(shifts[0].startsAt);
  const last = new Date(shifts.at(-1).startsAt);
  const start = portalDateFormat.format(first);
  if (start === portalDateFormat.format(last)) {
    return <time dateTime={first.toISOString()}>{start}</time>;
  }
  return portalDateFormat.formatRange(first, last);
}

export function PortalFigure({ image, caption = image.imageAlt, eager = false, className = "" }) {
  return (
    <figure className={"overflow-hidden rounded-lg border border-brand-line " + className}>
      <img
        src={image.imageUrl}
        alt={image.imageAlt}
        loading={eager ? "eager" : "lazy"}
        className="aspect-[16/8.2] w-full object-cover"
      />
      <figcaption className="border-t border-brand-line px-3 py-2 text-sm">
        {caption}
      </figcaption>
    </figure>
  );
}
