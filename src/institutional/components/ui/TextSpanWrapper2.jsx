"use client";

/**
 * @file Envolvente tipográfica animada por grafema (`TextSpanWrapper2`) alineada con `Ad-Astra-Landing-page`.
 * Acepta tamaños de texto personalizados por el llamador mediante `className` y conserva lectura accesible.
 */

import { useEffect, useState } from "react";

/**
 * Convierte nodos de texto simples, numéricos o arrays anidados de React en una sola cadena plana sin comas.
 *
 * @param node Contenido pasado como hijo al componente (`string`, `number`, `Array` o nulo).
 * @returns Cadena concatenada y lista para segmentar por grafemas.
 */
export function flattenText(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((item) => flattenText(item)).join("");
  }
  return String(node);
}

/**
 * Aplica el efecto de deslizamiento vertical escalonado por grafema sin imponer tamaños fijos de titular.
 * Expone el texto íntegro en un nodo `sr-only` y marca las capas animadas como `aria-hidden="true"`.
 *
 * @param props Propiedades de presentación del texto animado.
 * @param props.children Contenido textual o interpolado que se anima letra a letra.
 * @param props.as Etiqueta raíz a renderizar (`h1`, `h2`, `span`, etc.).
 * @param props.animateOnLoad Anima la entrada hacia arriba al montarse en el navegador.
 * @param props.collapseWhitespace Usa espacios que el navegador contrae al ajustar las líneas del texto visible.
 * @param props.className Clases Tailwind de tamaño, color o trazado que sobreescriben la base.
 * @param props.classname Alias retrocompatible de `className`.
 * @param props.headingProps Resto de atributos HTML (`id`, etc.) reenviados al elemento raíz.
 * @returns Elemento tipográfico con doble capa vertical animada con `ease-astra`.
 */
export default function TextSpanWrapper2({
  children,
  as: Heading = "h1",
  animateOnLoad = false,
  collapseWhitespace = false,
  className = "",
  classname = "",
  ...headingProps
}) {
  const [hasRevealed, setHasRevealed] = useState(!animateOnLoad);

  useEffect(() => {
    if (!animateOnLoad) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      setHasRevealed(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [animateOnLoad]);

  const text = flattenText(children);
  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;

  let staggerIndex = 0;
  const textGroups = text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((group, groupIndex) => {
      if (/^\s+$/.test(group)) {
        return {
          key: `space-${groupIndex}`,
          isWhitespace: true,
          value: group,
        };
      }

      const letters = segmenter
        ? Array.from(segmenter.segment(group))
        : [...group].map((ch) => ({ segment: ch }));

      return {
        key: `word-${groupIndex}`,
        isWhitespace: false,
        letters: letters.map(({ segment }) => ({
          segment,
          staggerIndex: staggerIndex++,
        })),
      };
    });

  const letterContainerClasses =
    "inline-block relative h-[1lh] align-top overflow-hidden overflow-x-clip transition-colors duration-300";

  const layerClasses =
    "block h-full overflow-clip transition-transform duration-300 ease-astra motion-reduce:transition-none";

  const revealClasses =
    animateOnLoad && !hasRevealed ? "motion-safe:translate-y-full" : "translate-y-0";

  const resolvedClassName = className || classname;
  const headingClasses =
    `group leading-[1.18] sm:leading-[1.14] md:leading-[1.12] ${resolvedClassName}`.trim();

  return (
    <Heading {...headingProps} aria-label={text} className={headingClasses}>
      <span className="sr-only select-none">{text}</span>
      <span aria-hidden="true" className="inline">
        {textGroups.map((group) => {
          if (group.isWhitespace) {
            if (collapseWhitespace) return " ";
            return (
              <span
                key={group.key}
                aria-hidden="true"
                className="whitespace-pre-wrap"
              >
                {group.value}
              </span>
            );
          }

          const WordWrapperClass =
            group.letters.length >= 12 ? "inline" : "inline-block whitespace-nowrap";

          return (
            <span key={group.key} className={WordWrapperClass}>
              {group.letters.map(({ segment, staggerIndex: index }) => {
                const delay = `${index * 0.01}s`;

                return (
                  <span key={segment + index} className={letterContainerClasses}>
                    <span
                      className={`${layerClasses} ${revealClasses} group-hover:-translate-y-full motion-reduce:translate-y-0 motion-reduce:group-hover:translate-y-0 print:translate-y-0`}
                      style={{ transitionDelay: delay }}
                    >
                      {segment}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`${layerClasses} ${revealClasses} group-hover:-translate-y-full motion-reduce:group-hover:translate-y-full print:hidden`}
                      style={{ transitionDelay: delay }}
                    >
                      {segment}
                    </span>
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </Heading>
  );
}
