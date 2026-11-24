/**
 * @file Portada pública de Comunidad Ad Astra UC3M. Combina el hero en tinta con corte diagonal amarillo
 * de la landing y el acceso directo al registro e inicio de sesión institucional.
 */

import { Mail01Icon, Shield01Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import AnimatedWordmark from "../institutional/components/brand/AnimatedWordmark";
import TextSpanWrapper2 from "../institutional/components/ui/TextSpanWrapper2";
import { accentButtonClass, secondaryButtonClass } from "./form-styles";
import { pageClassName } from "./page-layout";
import { PortalIcon } from "./portal-ui";

const heroMediaClass = [
  "relative isolate aspect-[16/10] min-w-0 md:aspect-auto md:min-h-[25rem] [--diagonal:clamp(56px,9vw,118px)]",
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-7 before:bg-brand-ink before:[clip-path:polygon(0_0,100%_0,0_87%)]",
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:z-10 after:h-7 after:bg-brand-accent after:[clip-path:polygon(0_87%,100%_0,100%_14%,0_100%)]",
  "md:before:hidden",
  "md:after:inset-y-0 md:after:left-0 md:after:right-auto md:after:h-auto md:after:w-[calc(var(--diagonal)+6px)] md:after:[clip-path:polygon(calc(100%-6px)_0,100%_0,6px_100%,0_100%)]",
].join(" ");

/**
 * Renderiza la portada de bienvenida con fotografía en campus, llamada a la acción y enlace de privacidad.
 * @returns Portada `<main>` pública para visitantes sin sesión activa.
 */
export function CommunityLanding() {
  return (
    <main className={pageClassName}>
      <section className="grid overflow-hidden rounded-lg bg-brand-ink text-brand-surface md:grid-cols-[minmax(0,1.06fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-center gap-5 p-6 sm:p-8 lg:p-12 [&_h1]:text-2xl sm:[&_h1]:text-[2rem] xl:[&_h1]:text-[2.65rem] [&_h1]:text-brand-surface [&_:focus-visible]:outline-brand-accent">
          <h1>
            <TextSpanWrapper2 as="span" animateOnLoad className="block">
              Comunidad
            </TextSpanWrapper2>{" "}
            <span className="mt-1.5 inline-flex flex-wrap items-center gap-x-[0.28em] gap-y-1">
              <AnimatedWordmark
                ariaLabel="Ad Astra"
                animateOnLoad
                inline
                className="h-[0.94em] text-brand-surface"
              />{" "}
              <TextSpanWrapper2 as="span" animateOnLoad>
                UC3M
              </TextSpanWrapper2>
            </span>
          </h1>
          <p className="max-w-[46ch] text-[1.15rem] leading-relaxed">
            Explora los talleres y encuentros de{" "}
            <AnimatedWordmark inline ariaLabel="Ad Astra" className="ms-0.5 h-[0.76em] align-[-0.05em]" />, reserva tu turno, descubre oportunidades y lleva tu tarjeta QR al evento.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className={accentButtonClass} href="/sign-up">Crear cuenta</Link>
            <Link className={secondaryButtonClass} href="/sign-in">Acceder</Link>
          </div>
        </div>
        <figure className={heroMediaClass + " m-0"}>
          <Image
            src="/brand/community.webp"
            alt="Estudiantes conversan con integrantes de Ad Astra en el campus"
            fill
            sizes="(min-width: 48rem) 50vw, 100vw"
            className="object-cover md:[clip-path:polygon(var(--diagonal)_0,100%_0,100%_100%,0_100%)]"
            preload
          />
        </figure>
      </section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-brand-line pb-4 text-[0.98rem]">
        <span className="inline-flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-soft/45 text-brand-primary">
            <PortalIcon icon={Mail01Icon} size={18} />
          </span>
          <span>Acceso con correo institucional UC3M.</span>
        </span>
        <span aria-hidden="true" className="hidden text-brand-line sm:inline">|</span>
        <span className="inline-flex items-center gap-1.5">
          <PortalIcon icon={Shield01Icon} size={16} className="text-brand-primary" />
          <Link href="/privacy">aviso de privacidad</Link>
        </span>
      </div>
    </main>
  );
}
