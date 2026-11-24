/**
 * @file Primitivas visuales compartidas del portal y administración de Comunidad. Reúnen paneles,
 * metadatos con iconos Hugeicons, motivos orbitales y rangos de fecha uniformes.
 */

import { HugeiconsIcon } from "@hugeicons/react";

const panelBaseClassName =
  "grid min-w-0 content-start gap-4 rounded-lg border border-brand-line p-4 sm:p-6";

export const portalPanelClassName = panelBaseClassName + " bg-brand-surface";

export const portalMutedPanelClassName = panelBaseClassName + " bg-brand-panel";

export const portalBlueprintPanelClassName =
  "astra-blueprint-grid grid min-w-0 content-start gap-4 rounded-lg border border-brand-line bg-brand-panel p-4 sm:p-6";

export const portalFeedbackClassName =
  "rounded-sm border-s-4 border-brand-primary bg-brand-panel px-4 py-3 text-brand-ink";

export const portalAlertClassName =
  "rounded-sm border-s-4 border-[#b79b30] bg-[#fff1b8] px-4 py-3 text-brand-ink";

export const accentRibbonBaseClassName =
  "inline-flex w-fit max-w-full items-center gap-2 bg-brand-accent font-display uppercase text-brand-ink [clip-path:polygon(10px_0,100%_0,calc(100%-10px)_100%,0_100%)]";

export const accentRibbonClassName = accentRibbonBaseClassName + " px-4 py-1.5 text-sm";

export const portalDateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

/**
 * Icono decorativo basado en `@hugeicons/react` con atributos accesibles ocultos por defecto.
 * @param props Propiedades de renderizado del icono.
 * @param props.icon Descriptor del pictograma de `@hugeicons/core-free-icons`.
 * @param props.size Tamaño cuadrado en píxeles.
 * @param props.className Clases Tailwind adicionales para color o alineación.
 * @returns Icono SVG decorativo listo para integrarse junto a etiquetas o botones.
 */
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

/**
 * Muestra un dato breve (fecha, lugar, aforo) precedido por su icono institucional en azul primario.
 * @param props Propiedades del elemento de metadato.
 * @param props.icon Descriptor de pictograma Hugeicons que acompaña al dato.
 * @param props.children Contenido textual o temporal del metadato.
 * @returns Línea compacta de metadato reutilizada por tarjetas y cabeceras del portal.
 */
export function PortalMeta({ icon, children }) {
  return (
    <span className="inline-flex min-w-0 items-start gap-2 [overflow-wrap:anywhere]">
      <PortalIcon icon={icon} className="mt-0.5 text-brand-primary" />
      <span>{children}</span>
    </span>
  );
}

/**
 * Trazo orbital técnico y estrella de cuatro puntas propio de la estética de cuaderno aeroespacial.
 * Decorativo (`aria-hidden="true"`).
 * @param props Propiedades de presentación del motivo.
 * @param props.className Clases de tamaño, opacidad o color aplicadas al SVG.
 * @returns Ilustración SVG orbital usada en cabeceras de acceso, privacidad, tarjeta QR y 404.
 */
export function OrbitalMotif({ className = "h-12 w-24 text-brand-primary/55" }) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      className={`pointer-events-none shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="60" cy="30" rx="50" ry="16" transform="rotate(-14 60 30)" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="60" cy="30" rx="42" ry="12" transform="rotate(11 60 30)" stroke="currentColor" strokeDasharray="3 4" strokeWidth="1" />
      <circle cx="60" cy="30" r="3.5" fill="currentColor" />
      <circle cx="96" cy="18" r="3" fill="#ffdb5a" stroke="currentColor" strokeWidth="1" />
      <path d="M18 14v8M14 18h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Formatea la fecha única o el rango de fechas de los turnos de una actividad.
 * @param props Propiedades del rango temporal.
 * @param props.shifts Lista ordenada de turnos con campo `startsAt`.
 * @returns Elemento `<time>` cuando es un día o rango legible para tarjetas de actividades.
 */
export function ActivityDates({ shifts }) {
  const first = new Date(shifts[0].startsAt);
  const last = new Date(shifts.at(-1).startsAt);
  const start = portalDateFormat.format(first);
  if (start === portalDateFormat.format(last)) {
    return <time dateTime={first.toISOString()}>{start}</time>;
  }
  return portalDateFormat.formatRange(first, last);
}

/**
 * Tarjeta visual para fotografías y planos conceptuales de actividades, con pie enmarcado.
 * @param props Propiedades de la lámina visual.
 * @param props.image Objeto con `imageUrl` y `imageAlt`.
 * @param props.caption Pie editorial mostrado bajo la imagen (puede incluir nodos JSX).
 * @param props.eager Activa carga inmediata cuando la figura preside el catálogo o el detalle.
 * @param props.className Clases adicionales aplicadas al elemento `<figure>`.
 * @returns Contenedor `<figure>` enmarcado para catálogo y detalle de actividades.
 */
export function PortalFigure({ image, caption = image.imageAlt, eager = false, className = "" }) {
  return (
    <figure className={"overflow-hidden rounded-lg border border-brand-line bg-brand-surface " + className}>
      <img
        src={image.imageUrl}
        alt={image.imageAlt}
        loading={eager ? "eager" : "lazy"}
        className="aspect-[16/8.2] w-full object-cover"
      />
      <figcaption className="border-t border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-ink">
        {caption}
      </figcaption>
    </figure>
  );
}
