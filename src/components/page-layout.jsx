/**
 * @file Componentes de diseño de página compartidos para mantener anchura, espaciado y cabeceras
 * consistentes en todo Comunidad.
 */

import TextSpanWrapper2 from "../institutional/components/ui/TextSpanWrapper2";

export const pageClassName =
  "mx-auto grid w-full max-w-[80rem] gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12 lg:pb-20";

/**
 * Renderiza la cabecera principal de cada pantalla con título, descripción opcional y acciones o motivo
 * visual en el extremo derecho.
 * @param props Propiedades de configuración de la cabecera.
 * @param props.title Título principal en `h1` (animado con `TextSpanWrapper2` cuando es cadena de texto).
 * @param props.eyebrow Línea corta sobre el título para ubicar el módulo o sección.
 * @param props.description Párrafo descriptivo bajo la barra amarilla del titular.
 * @param props.actions Enlaces, botones o motivo gráfico alineados al extremo derecho en escritorio.
 * @param props.className Clases adicionales aplicadas al `<header>`.
 * @param props.titleClassName Clases adicionales aplicadas al titular `<h1>`.
 * @returns Elemento `<header>` compartido para abrir las vistas de Comunidad.
 */
export function PageHeading({ title, eyebrow, description, actions, className = "", titleClassName = "" }) {
  return (
    <header className={`flex min-w-0 flex-col gap-4 border-b border-brand-line pb-5 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="grid min-w-0 gap-2">
        {eyebrow && (
          <p className="font-serif text-sm font-bold tracking-wide text-brand-primary uppercase">
            {eyebrow}
          </p>
        )}
        {typeof title === "string" ? (
          <TextSpanWrapper2 as="h1" animateOnLoad className={titleClassName}>
            {title}
          </TextSpanWrapper2>
        ) : (
          <h1 className={titleClassName}>{title}</h1>
        )}
        {description && <p className="max-w-[68ch]">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 sm:shrink-0">{actions}</div>}
    </header>
  );
}
