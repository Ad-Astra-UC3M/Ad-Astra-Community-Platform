import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { accentButtonClass, secondaryButtonClass } from "./form-styles";
import { pageClassName } from "./page-layout";

export function CommunityLanding() {
  return (
    <main className={pageClassName}>
      <section className="grid overflow-hidden rounded-lg bg-brand-ink text-brand-surface md:grid-cols-2">
        <div className="grid min-w-0 content-center gap-5 p-6 sm:p-8 lg:p-12 [&_h1]:text-2xl sm:[&_h1]:text-[2rem] xl:[&_h1]:text-[2.65rem] [&_h1]:text-brand-surface [&_h1>span]:block [&_:focus-visible]:outline-brand-accent">
          <h1>Comunidad <span>Ad Astra UC3M</span></h1>
          <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
            Explora los talleres y encuentros de Ad Astra, reserva tu turno, descubre oportunidades y lleva tu tarjeta QR al evento.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className={accentButtonClass} href="/sign-up">Crear cuenta</Link>
            <Link className={secondaryButtonClass} href="/sign-in">Acceder</Link>
          </div>
        </div>
        <figure className="relative m-0 aspect-[16/10] min-w-0 md:aspect-auto md:min-h-96">
          <Image
            src="/brand/community.webp"
            alt="Estudiantes conversan con integrantes de Ad Astra en el campus"
            fill
            sizes="(min-width: 48rem) 50vw, 100vw"
            className="object-cover"
            preload
          />
        </figure>
      </section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-brand-line pb-4">
        <span className="inline-flex items-center gap-2">
          <HugeiconsIcon icon={Mail01Icon} size={18} aria-hidden="true" className="shrink-0 text-brand-primary" />
          Acceso con correo institucional UC3M.
        </span>
        <Link href="/privacy">aviso de privacidad</Link>
      </div>
    </main>
  );
}
