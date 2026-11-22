/**
 * @file Vista de error de App Router. Next.js la presenta en rutas inexistentes o cuando una página u
 * operación llama a notFound().
 */

import Image from "next/image";
import { BackLink } from "../components/back-link";
import { pageClassName } from "../components/page-layout";

/**
 * Devuelve la pantalla 404 de Comunidad y el enlace para regresar a la portada. Los controles
 * administrativos reutilizan esta misma vista.
 */
export default function NotFound() {
  return (
    <main className={pageClassName}>
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="grid content-center gap-4">
          <p className="w-fit rounded-[4px] bg-brand-accent px-2 font-bold">404</p>
          <h1>Página no encontrada</h1>
          <BackLink href="/">Volver al inicio</BackLink>
        </div>
        <div className="grid place-items-center rounded-lg bg-brand-panel px-6 py-10">
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
