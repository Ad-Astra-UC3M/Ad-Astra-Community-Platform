import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";
import { currentUser } from "../demo/session";
import "./globals.css";
import "../components/navigation-links.css";
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
        <Navbar role={user?.role} />
        <div id="main-content" tabIndex={-1}>{children}</div>
        <Footer />
      </body>
    </html>
  );
}
