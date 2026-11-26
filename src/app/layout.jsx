/**
 * @file Layout raíz de App Router. Envuelve todas las rutas con la navegación institucional y resuelve la
 * sesión en el servidor antes de mostrar sus controles.
 */

import { Navbar, Footer } from "../components/original-layout";
import { CommunityBottomNav } from "../institutional/components/layout/CommunityBottomNav";
import { currentUser } from "../server/auth/access";
import { buildOwnAvatarUrl } from "../server/profiles/avatar-validation";
import "./globals.css";

export const metadata = {
  title: { default: "Comunidad Ad Astra UC3M", template: "%s · Ad Astra UC3M" },
  description: "Actividades, reservas, oportunidades y tarjeta de asistencia de Comunidad Ad Astra UC3M.",
};

// Con sesión y por debajo de 1080 px, la barra inferior fija ocupa unos 3,5 rem más la zona segura. El relleno
// del cuerpo deja ver el final de la página y el de desplazamiento evita que tape el elemento enfocado.
const bottomNavBodyClassName = " pb-[calc(3.5rem+env(safe-area-inset-bottom))] min-[1080px]:pb-0";
const bottomNavScrollClassName = "scroll-pb-[calc(4.5rem+env(safe-area-inset-bottom))] min-[1080px]:scroll-pb-0";

/**
 * Al renderizar el layout, Next.js ejecuta este Server Component. Usa currentUser para que Navbar muestre la
 * navegación de la sesión y el menú de cuenta, y monta la barra inferior móvil después del pie para respetar el
 * orden de tabulación. App Router puede conservar el layout al navegar entre páginas que lo comparten.
 *
 * @param props.children - Contenido de la ruta que Next.js inserta en el layout.
 * @returns Documento HTML con navegación, contenido, pie y, con sesión, accesos rápidos móviles.
 */
export default async function RootLayout({ children }) {
  const user = await currentUser();
  const hasAdmin = Boolean(user && user.capabilities.length > 0);
  const account = user
    ? { name: user.name, email: user.email, avatarUrl: buildOwnAvatarUrl(user.avatarUpdatedAt) }
    : null;

  return (
    <html lang="es" className={user ? bottomNavScrollClassName : undefined}>
      <body
        className={`bg-brand-surface pt-24 font-serif text-brand-ink print:pt-0 print:pb-0${user ? bottomNavBodyClassName : ""}`}
      >
        <a
          className="fixed top-3 left-6 z-[1000] -translate-y-[200%] bg-brand-surface px-4 py-2.5 text-brand-primary underline underline-offset-4 focus:translate-y-0 print:hidden"
          href="#main-content"
        >
          Saltar al contenido
        </a>
        <div className="print:hidden">
          <Navbar authenticated={Boolean(user)} hasAdmin={hasAdmin} account={account} />
        </div>
        <div id="main-content" tabIndex={-1}>{children}</div>
        <div className="print:hidden">
          <Footer />
        </div>
        {user && <CommunityBottomNav />}
      </body>
    </html>
  );
}
