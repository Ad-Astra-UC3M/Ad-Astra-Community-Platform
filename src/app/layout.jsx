import { Navbar, Footer } from "../components/original-layout";
import { CommunityBar } from "../components/community-bar";
import { currentUser } from "../lib/auth/session";
import "./globals.css";

export const metadata = {
  title: { default: "Comunidad Ad Astra UC3M", template: "%s · Ad Astra UC3M" },
  description: "Actividades, reservas, oportunidades y tarjeta de asistencia de Comunidad Ad Astra UC3M.",
};

export default async function RootLayout({ children }) {
  const user = await currentUser();
  const hasAdmin = Boolean(user && user.capabilities.length > 0);

  return (
    <html lang="es">
      <body className="bg-brand-surface pt-24 font-serif text-brand-ink print:pt-0">
        <a
          className="fixed top-3 left-6 z-[1000] -translate-y-[200%] bg-brand-surface px-4 py-2.5 text-brand-primary underline underline-offset-4 focus:translate-y-0 print:hidden"
          href="#main-content"
        >
          Saltar al contenido
        </a>
        <div className="print:hidden">
          <Navbar authenticated={Boolean(user)} hasAdmin={hasAdmin} />
        </div>
        {user && (
          <div className="print:hidden">
            <CommunityBar user={user} />
          </div>
        )}
        <div id="main-content" tabIndex={-1}>{children}</div>
        <div className="print:hidden">
          <Footer />
        </div>
      </body>
    </html>
  );
}
