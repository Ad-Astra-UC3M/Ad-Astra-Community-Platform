/**
 * @file Layout raíz de App Router. Envuelve todas las rutas con la navegación institucional y resuelve la
 * sesión en el servidor antes de mostrar sus controles.
 */

import { Navbar, Footer } from "../components/original-layout";
import { currentUser } from "../server/auth/access";
import { buildOwnAvatarUrl } from "../server/profiles/avatar-validation";
import "./globals.css";

export const metadata = {
  title: { default: "Comunidad Ad Astra UC3M", template: "%s · Ad Astra UC3M" },
  description: "Actividades, reservas, oportunidades y tarjeta de asistencia de Comunidad Ad Astra UC3M.",
};

/**
 * Al renderizar el layout, Next.js ejecuta este Server Component. Usa currentUser para que Navbar muestre la
 * navegación de la sesión, el menú de cuenta y la barra inferior móvil. App Router puede conservar el layout
 * al navegar entre páginas que lo comparten.
 *
 * @param props.children - Contenido de la ruta que Next.js inserta en el layout.
 * @returns Documento HTML con navegación, contenido y pie.
 */
export default async function RootLayout({ children }) {
  const user = await currentUser();
  const hasAdmin = Boolean(user && user.capabilities.length > 0);
  const account = user
    ? { name: user.name, email: user.email, avatarUrl: buildOwnAvatarUrl(user.avatarUpdatedAt) }
    : null;
  const bottomNavSpace = user ? " pb-[calc(3.5rem+env(safe-area-inset-bottom))] min-[890px]:pb-0" : "";

  return (
    <html lang="es">
      <body className={`bg-brand-surface pt-24 font-serif text-brand-ink print:pt-0 print:pb-0${bottomNavSpace}`}>
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
      </body>
    </html>
  );
}
