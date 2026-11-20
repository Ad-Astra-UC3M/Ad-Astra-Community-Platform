/**
 * @file Entrada de App Router para verificar la dirección institucional. Lee la cookie de contexto en el
 * servidor y entrega los valores a la vista.
 */

import { readAccountCodeEmail } from "../../server/auth/form-context";
import { VerifyEmailView } from "./view";

export const metadata = { title: "Verificar correo" };

/**
 * Obtiene el correo de verificación con readAccountCodeEmail y renderiza VerifyEmailView. El código se
 * comprueba cuando se envía su formulario.
 *
 * @param props.searchParams - Promesa con los avisos de envío, reenvío, error o destino del recorrido.
 */
export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams;
  const email = await readAccountCodeEmail("verification");

  return <VerifyEmailView params={params} email={email} />;
}
