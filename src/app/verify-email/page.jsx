/**
 * @file Entrada de App Router para verificar la dirección institucional. Lee la cookie de contexto en el
 * servidor y entrega los valores a la vista.
 */

import { redirectIfAuthenticated } from "../../server/auth/access";
import { readAccountCodeEmail } from "../../server/auth/form-context";
import { VerifyEmailView } from "./view";

export const metadata = { title: "Verificar correo" };

/**
 * Comprueba que no exista sesión activa y obtiene el correo de verificación con `readAccountCodeEmail`
 * para renderizar `VerifyEmailView`. Si hay sesión vigente, redirige a `/home`.
 *
 * @param props Propiedades de ruta suministradas por Next.js.
 * @param props.searchParams Promesa con los avisos de envío, reenvío, error o destino del recorrido.
 * @returns Vista de verificación OTP cuando la petición no tiene sesión activa.
 */
export default async function VerifyEmailPage({ searchParams }) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const email = await readAccountCodeEmail("verification");

  return <VerifyEmailView params={params} email={email} />;
}
