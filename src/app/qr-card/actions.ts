/**
 * @file Server Action que conecta el formulario de reemisión con el módulo de tarjetas propias.
 */

"use server";

import { redirect } from "next/navigation";
import { reissueMyCard as reissueCard } from "../../server/activities/card";

/**
 * Responde al formulario de `CardPage`, que no envía campos. `reissueCard` usa la cuenta de la sesión
 * para generar una nueva versión que invalida los tokens anteriores.
 * @returns Redirige a `/qr-card?status=reissued` tras completar la reemisión.
 */
export async function reissueMyCard() {
  await reissueCard();
  redirect("/qr-card?status=reissued");
}
