"use client";

/**
 * @file Contenedor animado escalonado para composiciones vectoriales SVG en dos capas verticales.
 */

import { Children, useEffect, useState } from "react";

/**
 * Aplica un desplazamiento vertical escalonado en dos capas a una serie de glifos o SVGs.
 * Mantiene una alternativa accesible mediante `ariaLabel` cuando las piezas son puramente visuales.
 *
 * @param props Propiedades de configuración del contenedor.
 * @param props.svgs Elementos SVG explícitos; tiene prioridad sobre `children`.
 * @param props.children Nodos SVG hijos cuando no se usa `svgs`.
 * @param props.as Etiqueta o componente envolvente del conjunto (por defecto `"span"`).
 * @param props.ariaLabel Texto accesible anunciado a lectores de pantalla cuando los SVG son decorativos.
 * @param props.animateOnLoad Activa el revelado vertical progresivo al montar el componente en cliente.
 * @param props.className Clases adicionales aplicadas al elemento raíz.
 * @param props.itemClassName Clases adicionales aplicadas a cada ranura de letra o SVG.
 * @param props.layerPaddingClass Espaciado vertical interno de cada capa animada (`py-0.5` en display, `py-0` en línea).
 * @param props.staggerDelay Retraso en segundos acumulado entre elementos consecutivos.
 * @param props.duration Duración de la transición en milisegundos.
 * @param props.easing Función temporal CSS aplicada a cada transición.
 * @returns Envolvente con texto accesible y glifos animados al pasar el cursor o cargar.
 */
export default function SVGAnimationWrapper({
  svgs,
  children,
  as: Wrapper = "span",
  ariaLabel,
  animateOnLoad = false,
  className = "",
  itemClassName = "",
  layerPaddingClass = "py-0.5",
  staggerDelay = 0.04,
  duration = 480,
  easing = "cubic-bezier(0.16, 1, 0.3, 1)",
  ...wrapperProps
}) {
  const [hasRevealed, setHasRevealed] = useState(!animateOnLoad);

  useEffect(() => {
    if (!animateOnLoad) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      setHasRevealed(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [animateOnLoad]);

  const items = Children.toArray(svgs ?? children);
  const revealClasses =
    animateOnLoad && !hasRevealed ? "motion-safe:translate-y-full" : "translate-y-0";

  const layerClasses =
    "block h-full transition-transform motion-reduce:transition-none";

  return (
    <Wrapper
      {...wrapperProps}
      className={`group inline-flex items-stretch leading-none ${className}`}
    >
      {ariaLabel && <span className="sr-only select-none">{ariaLabel}</span>}

      {items.map((svg, index) => {
        const delay = `${index * staggerDelay}s`;
        const transitionStyle = {
          transitionDelay: delay,
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: easing,
        };

        return (
          <span
            key={svg.key ?? index}
            className={`relative inline-block h-full shrink-0 -ml-px overflow-x-visible overflow-y-clip ${itemClassName}`}
          >
            <span
              aria-hidden={ariaLabel ? "true" : undefined}
              className={`${layerClasses} ${revealClasses} group-hover:-translate-y-full motion-reduce:translate-y-0 motion-reduce:group-hover:translate-y-0 print:translate-y-0 ${layerPaddingClass}`.trim()}
              style={transitionStyle}
            >
              {svg}
            </span>

            <span
              aria-hidden="true"
              className={`${layerClasses} absolute inset-0 translate-y-full group-hover:translate-y-0 motion-reduce:group-hover:translate-y-full print:hidden ${layerPaddingClass}`.trim()}
              style={transitionStyle}
            >
              {svg}
            </span>
          </span>
        );
      })}
    </Wrapper>
  );
}
