/**
 * @file Contexto temporal de los formularios OTP y destinos internos de vuelta. Las páginas leen con
 * cookies() y las Server Actions actualizan el correo sugerido. Identidad y códigos se validan por separado
 * en el servicio.
 */

import { cookies } from "next/headers";
import { normalizeUc3mEmail, sanitizeNextPath } from "./uc3m";

const accountCodeCookies = {
  verification: { name: "ada-verification-email", path: "/verify-email" },
  recovery: { name: "ada-recovery-email", path: "/reset-password" },
};

type AccountCodeFlow = keyof typeof accountCodeCookies;

/**
 * Lee el correo sugerido que muestra la página de verificación o de recuperación.
 *
 * @param flow - Determina qué cookie de formulario se lee.
 * @returns Correo UC3M normalizado o una cadena vacía.
 */
export async function readAccountCodeEmail(flow: AccountCodeFlow): Promise<string> {
  const jar = await cookies();
  return normalizeUc3mEmail(jar.get(accountCodeCookies[flow].name)?.value) ?? "";
}

/**
 * Guarda el correo durante diez minutos. Las Server Actions lo llaman al avanzar y lo vacían al terminar.
 *
 * @param flow - Determina el nombre y ámbito de la cookie.
 * @param rawEmail - Dirección que se valida antes de guardar. Una dirección vacía o inválida caduca la
 * cookie.
 */
export async function setAccountCodeEmail(flow: AccountCodeFlow, rawEmail: string): Promise<void> {
  const email = normalizeUc3mEmail(rawEmail);
  const jar = await cookies();
  jar.set({
    ...accountCodeCookies[flow],
    value: email ?? "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: email ? 10 * 60 : 0,
  });
}

/**
 * Filtra un destino recibido por URL o formulario antes de usarlo en una redirección.
 *
 * @param value - Valor que puede llegar como cadena, lista o undefined.
 * @returns La ruta interna válida o una cadena vacía para usar el destino normal.
 */
export function readOptionalNextPath(value: unknown): string {
  if (typeof value !== "string") return "";
  const path = value.trim();
  return sanitizeNextPath(path) === path ? path : "";
}
