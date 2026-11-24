"use client";

import { useState } from "react";

/**
 * @file Componente visual reutilizable para mostrar la foto de perfil privada o, en su ausencia, un
 * monograma circular con las iniciales del titular. Sin dependencias de servidor para funcionar en
 * Server Components, Client Components y pruebas `renderToStaticMarkup`.
 */

const sizeClasses = {
  xs: "h-7 w-7 text-[0.72rem]",
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-xl",
  lg: "h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl",
};

/**
 * Calcula las iniciales en mayúsculas a partir de nombre y apellidos separados o de un nombre
 * completo en cadena única.
 *
 * @param nameOrFirstName - Nombre de pila o nombre completo en una cadena.
 * @param lastName - Apellidos opcionales cuando se pasan por separado.
 * @returns Iniciales de una o dos letras en mayúsculas, o `"AA"` si no hay caracteres útiles.
 */
export function buildInitials(nameOrFirstName = "", lastName) {
  if (lastName !== undefined) {
    const first = String(nameOrFirstName).trim().charAt(0);
    const last = String(lastName ?? "").trim().charAt(0);
    return `${first}${last}`.toUpperCase() || "AA";
  }

  const parts = String(nameOrFirstName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "AA";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() || "AA";
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase() || "AA";
}

/**
 * Compone el nombre legible para atributos accesibles a partir de `name` o `firstName`/`lastName`.
 *
 * @param props - Identificadores nominales recibidos por `ProfileAvatar`.
 * @param props.name - Nombre completo opcional.
 * @param props.firstName - Nombre de pila opcional.
 * @param props.lastName - Apellidos opcionales.
 * @returns Nombre recortado o `"perfil"` cuando falta.
 */
function resolveDisplayName({ name, firstName, lastName }) {
  const combined = [firstName, lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  if (combined) return combined;
  if (typeof name === "string" && name.trim()) return name.trim();
  return "perfil";
}

/**
 * Renderiza una foto circular cuando `src` está definida o el monograma de iniciales como respaldo.
 *
 * @param props - Propiedades de tamaño, accesibilidad y origen de la imagen.
 * @param props.src - URL privada de la imagen (`/api/profile/avatar?v=...` o administrativa), o `null`.
 * @param props.name - Nombre completo de la persona cuando no se pasa desglosado.
 * @param props.firstName - Nombre de pila de la persona.
 * @param props.lastName - Apellidos de la persona.
 * @param props.size - Escala visual (`"xs"`, `"sm"`, `"md"` o `"lg"`).
 * @param props.decorative - Oculta el nodo al árbol accesible cuando acompaña al nombre en texto.
 * @param props.className - Clases Tailwind adicionales opcionales.
 * @returns Elemento `<img>` circular enmarcado o `<span>` con las iniciales del titular.
 */
export function ProfileAvatar({
  src = null,
  name,
  firstName,
  lastName,
  size = "md",
  decorative = false,
  className = "",
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const dims = sizeClasses[size] ?? sizeClasses.md;
  const displayName = resolveDisplayName({ name, firstName, lastName });
  const initials =
    lastName !== undefined
      ? buildInitials(firstName, lastName)
      : buildInitials(firstName || displayName);

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        onError={() => setFailedSrc(src)}
        alt={decorative ? "" : `Foto de perfil de ${displayName}`}
        aria-hidden={decorative ? "true" : undefined}
        className={`${dims} shrink-0 rounded-full border border-brand-line bg-brand-surface object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : `Iniciales de ${displayName}`}
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full border border-brand-line bg-brand-surface font-serif font-bold tracking-tight text-brand-ink ${className}`}
    >
      {initials}
    </span>
  );
}
