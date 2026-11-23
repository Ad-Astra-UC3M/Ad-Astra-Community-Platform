/**
 * @file Contenedor editorial compartido por todas las pantallas de autenticación y recuperación.
 * Combina el formulario enmarcable de v2 con la columna editorial de la plataforma, motivo orbital
 * e ilustración de v1.
 */

import Image from "next/image";
import AnimatedWordmark from "../institutional/components/brand/AnimatedWordmark";
import { PageHeading, pageClassName } from "./page-layout";
import { OrbitalMotif, portalBlueprintPanelClassName } from "./portal-ui";

const illustrations = {
  access: { src: "/brand/auth-team.webp", width: 720, height: 360 },
  registration: { src: "/brand/auth-community.webp", width: 600, height: 554 },
};

/**
 * Dispone el contenido de acceso junto a la lámina editorial de Comunidad Ad Astra UC3M.
 * @param props Propiedades de composición de la vista de acceso.
 * @param props.title Título principal de la vista.
 * @param props.children Formulario y enlaces de navegación contextual.
 * @param props.artwork Ilustración temática (`access` o `registration`).
 * @returns Contenedor `<main>` de dos columnas compartido por las rutas de autenticación.
 */
export function AccessPage({ title, children, artwork = "access" }) {
  return (
    <main className={pageClassName}>
      <div className="mx-auto grid w-full max-w-[68rem] items-stretch gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.88fr)] lg:gap-10">
        <div className="grid min-w-0 content-start gap-6 rounded-lg border border-brand-line bg-brand-surface p-5 sm:p-8">
          <PageHeading title={title} />
          {children}
        </div>
        <aside className={portalBlueprintPanelClassName + " content-between gap-6 p-6 sm:p-8"}>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-3">
              <p className="inline-flex w-fit flex-wrap items-center gap-x-1 bg-brand-accent px-3.5 py-1 font-serif text-sm font-bold text-brand-ink [clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)]">
                <span>Comunidad</span>{" "}
                <AnimatedWordmark inline ariaLabel="Ad Astra" className="h-[0.86em] align-[-0.06em]" />{" "}
                <span>UC3M</span>
              </p>
              <p className="border-s-[3px] border-brand-primary ps-3 text-[0.98rem] text-brand-ink">
                La plataforma gestionada por{" "}
                <AnimatedWordmark inline ariaLabel="Ad Astra" className="mx-0.5 h-[0.76em] align-[-0.05em]" />{" "}
                para apuntarte a las actividades que organizamos, descubrir prácticas e investigación de nuestros partners y mostrar tu perfil para conectar con empresas del sector.
              </p>
            </div>
            <OrbitalMotif className="hidden h-11 w-20 text-brand-primary/65 sm:block" />
          </div>
          <div className="grid place-items-center py-2">
            <Image
              {...illustrations[artwork]}
              sizes="(min-width: 64rem) 38vw, 100vw"
              alt=""
              className="h-auto max-h-48 w-full object-contain md:max-h-[24rem]"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
