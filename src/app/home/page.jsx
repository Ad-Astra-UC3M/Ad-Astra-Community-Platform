/**
 * @file Pantalla de inicio del portal. Muestra la siguiente reserva de la sesión y accesos directos
 * según las capacidades de la cuenta.
 */

import {
  ArrowRight01Icon,
  Bookmark01Icon,
  Briefcase01Icon,
  Calendar03Icon,
  DashboardSquare01Icon,
  GridViewIcon,
  QrCodeIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { accentButtonClass, secondaryButtonClass } from "../../components/form-styles";
import { pageClassName } from "../../components/page-layout";
import { portalPanelClassName, PortalIcon } from "../../components/portal-ui";
import { ReservationAgendaCard } from "../../components/reservation-agenda";
import { loadMyHome } from "../../server/activities/portal";

export const metadata = { title: "Inicio" };

const studentLinks = [
  {
    href: "/qr-card",
    label: "Tarjeta QR",
    description: "Para validar tu asistencia",
    icon: QrCodeIcon,
  },
  {
    href: "/opportunities",
    label: "Oportunidades",
    description: "Prácticas e investigación",
    icon: Briefcase01Icon,
  },
  {
    href: "/bookmarks",
    label: "Mis marcadores",
    description: "Oportunidades guardadas",
    icon: Bookmark01Icon,
  },
  {
    href: "/profile",
    label: "Mi perfil",
    description: "Datos y preferencias",
    icon: UserIcon,
  },
];

const adminLink = {
  href: "/admin",
  label: "Panel de gestión",
  description: "Herramientas de administración",
  icon: DashboardSquare01Icon,
};

const sectionHeadingClass = "flex items-center gap-3 border-b border-brand-line pb-2.5 text-[clamp(1.05rem,2.2vw,1.5rem)]";

const heroImageClass = [
  "relative isolate min-h-[221px] [--diagonal:clamp(56px,9vw,124px)] sm:min-h-[390px]",
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-7 before:bg-brand-ink before:[clip-path:polygon(0_0,100%_0,0_87%)]",
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:z-10 after:h-7 after:bg-brand-accent after:[clip-path:polygon(0_87%,100%_0,100%_14%,0_100%)]",
  "sm:before:inset-y-0 sm:before:right-auto sm:before:h-auto sm:before:w-(--diagonal) sm:before:[clip-path:polygon(0_0,100%_0,0_100%)]",
  "sm:after:inset-y-0 sm:after:right-auto sm:after:h-auto sm:after:w-[calc(var(--diagonal)_+_6px)] sm:after:[clip-path:polygon(calc(100%_-_6px)_0,100%_0,6px_100%,0_100%)]",
].join(" ");

/**
 * Next.js ejecuta la página tras acceder al portal. Carga la sesión y muestra la primera próxima
 * reserva de la misma persona. Incluye el panel de gestión para las cuentas con capacidades.
 * @returns El inicio autenticado con la agenda y los accesos disponibles.
 */
export default async function HomePage() {
  const { user, upcoming } = await loadMyHome();
  const links = user.capabilities.length > 0 ? [...studentLinks, adminLink] : studentLinks;
  const agendaLink = (
    <Link href="/my-activities" className={secondaryButtonClass}>
      <PortalIcon icon={ArrowRight01Icon} size={16} />
      Ver mis actividades
    </Link>
  );

  return (
    <main className={pageClassName}>
      <section className="grid overflow-hidden rounded-lg bg-brand-ink text-brand-surface sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <div className="grid min-w-0 content-center gap-4 p-[clamp(1.5rem,4vw,3.375rem)] sm:gap-6">
          <h1 className="text-[clamp(1.55rem,3.35vw,3rem)] text-brand-surface after:h-[7px] after:w-[clamp(92px,13vw,176px)]">
            Hola, {user.firstName}
          </h1>
          <p className="max-w-[46ch] text-[1.04rem]">
            Consulta tus próximos talleres y encuentra tu siguiente oportunidad.
          </p>
          <Link href="/activities" className={accentButtonClass + " hover:text-brand-ink focus-visible:outline-brand-accent"}>
            <PortalIcon icon={Calendar03Icon} size={16} />
            Explorar actividades
          </Link>
        </div>
        <figure className={heroImageClass}>
          <Image
            src="/brand/rocket-sunset.webp"
            alt="Cohete universitario sobre una rampa al atardecer"
            fill
            preload
            sizes="(min-width: 1280px) 640px, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-[50%_30%]"
          />
        </figure>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-labelledby="home-agenda-heading" className="grid min-w-0 gap-4">
          <h2 id="home-agenda-heading" className={sectionHeadingClass}>
            <PortalIcon icon={Calendar03Icon} size={23} className="text-brand-primary" />
            Próximas actividades
          </h2>
          {upcoming ? (
            <ReservationAgendaCard reservation={upcoming}>{agendaLink}</ReservationAgendaCard>
          ) : (
            <div className={portalPanelClassName + " bg-brand-panel"}>
              <p>No tienes próximas reservas.</p>
              {agendaLink}
            </div>
          )}
        </section>
        <nav aria-labelledby="home-shortcuts-heading" className="grid min-w-0 gap-4">
          <h2 id="home-shortcuts-heading" className={sectionHeadingClass}>
            <PortalIcon icon={GridViewIcon} size={23} className="text-brand-primary" />
            Accesos directos
          </h2>
          <ul className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 sm:gap-3">
            {links.map(({ href, label, description, icon }) => (
              <li key={href} className="min-w-0">
                <Link
                  href={href}
                  className="grid h-full min-h-[5.2rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-sm border border-brand-line p-3.5 text-brand-ink no-underline transition-colors hover:border-brand-primary hover:bg-brand-panel sm:p-4"
                >
                  <PortalIcon icon={icon} className="text-brand-primary" />
                  <span className="grid gap-0.5">
                    <strong className="underline underline-offset-4">{label}</strong>
                    <span className="text-[0.92rem]">{description}</span>
                  </span>
                  <PortalIcon icon={ArrowRight01Icon} className="text-brand-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
