import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { requireUser } from "../../demo/session";

export const metadata = { title: "Inicio" };

const activities = {
  href: "/activities",
  label: "Actividades",
  description: "Explora los talleres y encuentros y elige un turno.",
};

const studentLinks = [
  activities,
  {
    href: "/my-activities",
    label: "Mis actividades",
    description: "Consulta tus reservas y el estado de tu asistencia.",
  },
  {
    href: "/qr-card",
    label: "Tarjeta QR",
    description: "Muestra tu código al llegar al evento.",
  },
];

const organizerLinks = [
  {
    href: "/admin",
    label: "Gestión de asistencia",
    description: "Selecciona un turno y valida las tarjetas de los asistentes.",
  },
  activities,
];

export default async function HomePage() {
  const user = await requireUser();
  const organizer = user.role === "organizer";
  const links = organizer ? organizerLinks : studentLinks;

  return (
    <main className="shell home">
      <div className="home-banner">
        <h1>Hola, {user.name}</h1>
        <p className="lead">
          {organizer
            ? "Desde aquí puedes registrar la asistencia a los turnos de la demo."
            : "Reserva tu próximo turno y ten a mano tu QR para acreditar la asistencia."}
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
