import Image from "next/image";
import Link from "next/link";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

export function CommunityLanding() {
  return (
    <main className="mx-auto w-full max-w-[80rem] px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-12">
        <div className="grid content-center gap-5 [&_h1]:text-2xl sm:[&_h1]:text-[2rem] md:[&_h1]:text-[2.5rem] lg:[&_h1]:text-[2.375rem] xl:[&_h1]:text-5xl [&_h1>span]:block">
          <h1>Comunidad <span>Ad Astra UC3M</span></h1>
          <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
            Explora los talleres y encuentros de Ad Astra, reserva tu turno, descubre oportunidades y lleva tu tarjeta QR al evento.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className={primaryButtonClass} href="/sign-up">Crear cuenta</Link>
            <Link className={secondaryButtonClass} href="/sign-in">Acceder</Link>
          </div>
          <p className="text-[0.95rem] text-brand-ink/85">
            Exclusivo para correos institucionales de la UC3M. Consulta el{" "}
            <Link href="/privacy">aviso de privacidad</Link>.
          </p>
        </div>
        <figure className="m-0">
          <Image
            src="/brand/community.webp"
            alt="Estudiantes conversan con integrantes de Ad Astra en el campus"
            width={1206}
            height={905}
            sizes="(min-width: 62rem) 44vw, 100vw"
            className="block aspect-[4/3] h-auto w-full rounded-t-lg object-cover"
            preload
          />
          <figcaption className="border-t-[3px] border-brand-accent pt-2 text-[0.9rem]">
            Encuentro de Ad Astra en el campus
          </figcaption>
        </figure>
      </div>
    </main>
  );
}
