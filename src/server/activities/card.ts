/**
 * @file Operaciones de tarjeta QR de la cuenta conectada. El módulo `server-only` obtiene el perfil de
 * la sesión y delega en `card-data.ts`.
 */

import "server-only";

import { requireUser } from "../auth/access";
import { issueCard, reissueCard } from "./card-data";

/**
 * Carga la acreditación vigente para `CardPage` con la identidad de la sesión.
 * @returns El token emitido por `issueCard`, la versión vigente y el nombre que se imprime en la
 * tarjeta.
 */
export async function issueMyCard() {
  const user = await requireUser("/qr-card");
  const card = await issueCard(user.personId);
  return { ...card, holderName: user.name };
}

/**
 * Atiende a la acción de reemisión de `/qr-card`. `reissueCard` incrementa la versión del perfil
 * conectado y revoca las tarjetas previas.
 * @returns El token firmado y su nueva versión.
 */
export async function reissueMyCard() {
  const user = await requireUser();
  return reissueCard(user.personId);
}
