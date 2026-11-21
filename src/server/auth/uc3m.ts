/**
 * @file Validación compartida de correos UC3M y destinos internos. El servicio comprueba las direcciones
 * antes de operar con el proveedor. Las acciones y las páginas usan estos helpers al guardar el destino de
 * acceso.
 */

const LOCAL_PART_REGEX =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

const DOMAIN_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const UC3M_DOMAIN_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*uc3m\.es$/;

const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/;

/**
 * Valida la estructura de una dirección y la normaliza para las búsquedas de identidad.
 *
 * @param raw - Entrada sin validar del formulario, SDK o proveedor de pruebas.
 * @returns Correo en minúsculas sin espacios exteriores o null.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (CONTROL_CHARS_REGEX.test(raw)) return null;

  const email = raw.trim().toLowerCase();
  if (!email || email.length > 254) return null;

  const parts = email.split("@");
  if (parts.length !== 2) return null;

  const [local, domain] = parts;
  if (!local || !domain || local.length > 64) return null;
  if (!LOCAL_PART_REGEX.test(local)) return null;
  if (!DOMAIN_REGEX.test(domain)) return null;

  return email;
}

/**
 * Comprueba si normalizeEmail devuelve una dirección cuyo dominio es uc3m.es o un subdominio.
 *
 * @param raw - Valor bruto que se quiere comprobar.
 * @returns true si pertenece a un dominio admitido.
 */
export function isUc3mEmail(raw: unknown): boolean {
  const normalized = normalizeEmail(raw);
  if (!normalized) return false;
  const domain = normalized.slice(normalized.indexOf("@") + 1);
  return UC3M_DOMAIN_REGEX.test(domain);
}

/**
 * Aplica la política de acceso de Comunidad a un correo normalizado.
 *
 * @param raw - Dirección que llega al servicio o a un formulario.
 * @returns Correo UC3M normalizado o null.
 */
export function normalizeUc3mEmail(raw: unknown): string | null {
  const normalized = normalizeEmail(raw);
  if (!normalized) return null;
  const domain = normalized.slice(normalized.indexOf("@") + 1);
  return UC3M_DOMAIN_REGEX.test(domain) ? normalized : null;
}

/**
 * Comprueba que una ruta de destino pertenece al mismo sitio. Lo usa sanitizeNextPath.
 *
 * @param value - Ruta candidata que se analiza como URL interna.
 * @returns true cuando es una ruta interna admitida.
 */
function isSafeInternalPath(value: string): boolean {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return false;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;

  try {
    const parsed = new URL(value, "https://comunidad.local");
    return (
      parsed.origin === "https://comunidad.local" &&
      parsed.pathname.startsWith("/") &&
      !parsed.pathname.startsWith("//")
    );
  } catch {
    return false;
  }
}

/**
 * Selecciona una ruta que se puede entregar a redirect sin cambiar de origen.
 *
 * @param raw - Destino recibido de la URL o formulario.
 * @param fallback - Destino alternativo. También se valida y por defecto es /home.
 * @returns La ruta válida de entrada, la alternativa o /home.
 */
export function sanitizeNextPath(raw: unknown, fallback = "/home"): string {
  const safeFallback = isSafeInternalPath(fallback) ? fallback : "/home";
  if (typeof raw !== "string") return safeFallback;
  if (CONTROL_CHARS_REGEX.test(raw)) return safeFallback;
  const trimmed = raw.trim();
  return isSafeInternalPath(trimmed) ? trimmed : safeFallback;
}
