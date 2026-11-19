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
    <main className="mx-auto grid w-full max-w-[58rem] gap-7 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-3 rounded-lg bg-brand-ink p-6 text-brand-surface md:p-8 [&_:focus-visible]:outline-brand-accent">
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-surface md:text-[2.5rem]">
          Hola, {user.name}
        </h1>
        <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
          {organizer
            ? "Desde aquí puedes registrar la asistencia a los turnos de la demo."
            : "Reserva tu próximo turno, explora oportunidades y gestiona tu perfil desde la comunidad."}
        </p>
      </div>
      <nav aria-label="Accesos directos">
        <ul className="m-0 list-none border-t border-brand-primary/30 p-0">
          {links.map(({ href, label, description }) => (
            <li key={href} className="border-b border-brand-primary/30">
              <Link
                href={href}
                className="flex items-center justify-between gap-5 px-3 py-4 text-brand-ink no-underline transition-colors hover:bg-brand-soft/20"
              >
                <span className="grid gap-0.5">
                  <span className="text-[1.18rem] font-bold text-brand-primary underline underline-offset-[0.22em]">
                    {label}
                  </span>
                  <span>{description}</span>
                </span>
                <HugeiconsIcon
                  className="shrink-0 text-brand-primary"
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
