import Image from "next/image";
import Link from "next/link";
import { demoOrganizer, demoStudent, signOut } from "../demo/session";
import { CommunityNavigation } from "./community-navigation";

type Role = "student" | "organizer";

export function Navbar({ role }: { role?: Role }) {
  const organizer = role === "organizer";

  return (
    <header className="site-header">
      <div className="frame header-row">
        <Link href={role ? "/home" : "/"} className="brand-link">
          <Image src="/brand/ad-astra.svg" alt="Ad Astra UC3M" width={144} height={50} unoptimized />
          <span>Comunidad</span>
        </Link>
        <CommunityNavigation role={role} />
        {!role && <Link className="navbar-action" href="/sign-in">Acceder</Link>}
      </div>
      {role && (
        <div className="session-bar">
          <div className="frame session-row">
            <p><strong>Modo demo</strong> · {organizer ? "Organizador" : "Estudiante"}</p>
            <div className="session-actions">
              <form action={organizer ? demoStudent : demoOrganizer}>
                <button type="submit" className="text-button">
                  {organizer ? "Volver a estudiante" : "Probar como organizador"}
                </button>
              </form>
              <form action={signOut}>
                <button type="submit" className="text-button">Cerrar sesión</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
