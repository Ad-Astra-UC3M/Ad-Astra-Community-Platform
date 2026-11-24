/**
 * @file Portada pública de Comunidad en la ruta /. Usa la sesión de servidor para decidir si mostrar la
 * presentación o continuar al portal.
 */

import { redirect } from "next/navigation";
import { CommunityLanding } from "../components/community-landing";
import { currentUser } from "../server/auth/access";

/**
 * Next.js renderiza esta ruta en el servidor. Si currentUser encuentra sesión, redirect lleva a /home. En
 * otro caso devuelve CommunityLanding.
 */
export default async function CommunityPage() {
  if (await currentUser()) redirect("/home");
  return <CommunityLanding />;
}
