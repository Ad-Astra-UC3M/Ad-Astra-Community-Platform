import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navbar, Footer } from "../components/original-layout";
import { CommunityBar } from "../components/community-bar";
import { currentUser } from "../demo/session";
import "./globals.css";
import "../components/navigation-links.css";
import "../institutional/institutional.css";
import "../components/institutional-shell.css";

export const metadata: Metadata = {
  title: { default: "Comunidad Ad Astra UC3M", template: "%s · Ad Astra UC3M" },
  description: "Actividades, reservas y tarjeta de asistencia de Comunidad Ad Astra UC3M.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main-content">Saltar al contenido</a>
        <div className="institutional"><Navbar /></div>
        {user && <CommunityBar role={user.role} />}
        <div id="main-content" tabIndex={-1}>{children}</div>
        <div className="institutional"><Footer /></div>
      </body>
    </html>
  );
}
