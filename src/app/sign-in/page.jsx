/**
 * @file Entrada de App Router para el acceso al portal. Redirige a `/home` si ya existe una sesión
 * activa y, en caso contrario, delega el formulario en `SignInView`.
 */

import { redirectIfAuthenticated } from "../../server/auth/access";
import { SignInView } from "./view";

export const metadata = { title: "Acceder a la comunidad" };

/**
 * Comprueba la sesión mediante `redirectIfAuthenticated` y renderiza `SignInView` con los parámetros
 * de consulta recibidos por Next.js.
 *
 * @param props Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams Promesa con `next`, `error` o avisos tras verificar o restablecer clave.
 * @returns Vista de inicio de sesión cuando la petición no tiene sesión activa.
 */
export default async function SignInPage({ searchParams }) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  return <SignInView params={params} />;
}
