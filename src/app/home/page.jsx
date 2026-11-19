import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { requireUser } from "../../demo/session";

export const metadata = { title: "Inicio" };

const sharedLinks = [
  {
    href: "/activities",
    label: "Actividades",
    description: "Explora los talleres y encuentros y elige un turno.",
  },
  {
    href: "/opportunities",
    label: "Oportunidades",
    description: "Descubre prácticas aeroespaciales y líneas de investigación en la UC3M.",
  },
  {
    href: "/bookmarks",
    label: "Mis marcadores",
    description: "Consulta las oportunidades que has guardado para revisar más adelante.",
  },
  {
    href: "/profile",
    label: "Mi perfil",
    description: "Actualiza tus datos básicos, tu perfil de talento voluntario y tus preferencias de privacidad.",
  },
];

const studentLinks = [
  sharedLinks[0],
  {
    href: "/my-activities",
    label: "Mis actividades",
    description: "Consulta tus reservas, cambia de turno o revisa el estado de tu asistencia.",
  },
  {
    href: "/qr-card",
    label: "Tarjeta QR",
    description: "Muestra tu código al llegar al evento o reemítelo si lo necesitas.",
  },
  ...sharedLinks.slice(1),
];

const organizerLinks = [
  {
    href: "/admin",
    label: "Gestión de asistencia",
    description: "Selecciona un turno y valida las tarjetas de los asistentes.",
  },
  ...sharedLinks,
];

export default async function HomePage() {
  const user = await requireUser("/home");
  const organizer = user.role === "organizer";
  const links = organizer ? organizerLinks : studentLinks;

  return (
    <main className="shell home">
      <div className="home-banner">
        <h1>Hola, {user.name}</h1>
        <p className="lead">
          {organizer
            ? "Desde aquí puedes registrar la asistencia a los turnos de la demo."
            : "Reserva tu próximo turno, explora oportunidades y gestiona tu perfil desde la comunidad."}
        </p>
      </div>
      <nav className="home-links" aria-label="Accesos directos">
        <ul>
          {links.map(({ href, label, description }) => (
            <li key={href}>
              <Link href={href}>
                <span className="home-link-text">
                  <span className="home-link-title">{label}</span>
                  <span>{description}</span>
                </span>
                <HugeiconsIcon
                  className="home-link-arrow"
                  icon={ArrowRight02Icon}
                  size={20}
                  strokeWidth={2}
                  aria-hidden="true"
                  focusable="false"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
