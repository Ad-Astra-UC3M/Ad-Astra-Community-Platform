/**
 * @file Vista de error de App Router. Next.js la presenta en rutas inexistentes o cuando una página u
 * operación llama a notFound().
 */

import Image from "next/image";
import { BackLink } from "../components/back-link";
import { pageClassName } from "../components/page-layout";
import { OrbitalMotif, portalBlueprintPanelClassName } from "../components/portal-ui";
import TextSpanWrapper2 from "../institutional/components/ui/TextSpanWrapper2";

/**
 * Devuelve la pantalla 404 de Comunidad y el enlace para regresar a la portada. Los controles
 * administrativos reutilizan esta misma vista.
 * @returns Página `<main>` con cinta `404`, titular animado e ilustración con motivo orbital.
 */
export default function NotFound() {
  return (
    <main className={pageClassName}>
      <div className="grid min-h-[24rem] items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="grid content-center gap-4">
          <p className="w-fit bg-brand-accent px-3 py-0.5 font-bold text-brand-ink [clip-path:polygon(6px_0,100%_0,calc(100%-6px)_100%,0_100%)]">
            404
          </p>
          <TextSpanWrapper2 as="h1" animateOnLoad>
            Página no encontrada
          </TextSpanWrapper2>
          <BackLink href="/">Volver al inicio</BackLink>
        </div>
        <div className={portalBlueprintPanelClassName + " relative place-items-center px-6 py-10"}>
          <OrbitalMotif className="ms-auto h-10 w-20 text-brand-primary/55" />
          <Image
            src="/brand/page-not-found.webp"
            width={720}
            height={360}
            sizes="(min-width: 48rem) 44vw, 100vw"
            alt=""
            className="h-auto w-full max-w-lg"
          />
        </div>
      </div>
    </main>
  );
}
