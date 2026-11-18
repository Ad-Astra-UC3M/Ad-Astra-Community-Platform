import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/site-header";
import { currentUser } from "../demo/session";
import "./globals.css";

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
        <SiteHeader role={user?.role} />
        <div id="main-content" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
