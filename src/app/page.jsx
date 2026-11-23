/**
 * @file Portada pública de Comunidad en la ruta /. Redirige a `/home` si existe sesión activa y, en
 * caso contrario, presenta `CommunityLanding`.
 */

import { CommunityLanding } from "../components/community-landing";
import { redirectIfAuthenticated } from "../server/auth/access";

/**
 * Next.js renderiza esta ruta en el servidor. Si `redirectIfAuthenticated` encuentra sesión activa,
 * redirige a `/home`; en otro caso devuelve `CommunityLanding`.
 *
 * @returns Portada pública cuando la petición no tiene sesión activa.
 */
export default async function CommunityPage() {
  await redirectIfAuthenticated();
  return <CommunityLanding />;
}
