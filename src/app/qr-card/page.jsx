/**
 * @file Página de App Router para `/qr-card`. Genera en servidor la imagen QR de la tarjeta personal.
 */

import { QrCodeIcon, RepeatIcon } from "@hugeicons/core-free-icons";
import QRCode from "qrcode";
import { primaryButtonClass } from "../../components/form-styles";
import { PageHeading, pageClassName } from "../../components/page-layout";
import {
  OrbitalMotif,
  portalBlueprintPanelClassName,
  portalFeedbackClassName,
  portalPanelClassName,
  PortalIcon,
} from "../../components/portal-ui";
import AnimatedWordmark from "../../institutional/components/brand/AnimatedWordmark";
import TextSpanWrapper2 from "../../institutional/components/ui/TextSpanWrapper2";
import { issueMyCard } from "../../server/activities/card";
import { reissueMyCard } from "./actions";
import { CardTools } from "./tools";

/**
 * Next.js llama a la página. `issueMyCard` obtiene el JWT vigente y `QRCode.toDataURL` lo convierte en
 * imagen. `CardTools` mantiene la impresión y el acceso al código manual.
 * @param props.searchParams Promesa con la consulta. `status=reissued` activa el aviso.
 * @returns La credencial física con titular, versión y formulario de reemisión.
 */
export default async function CardPage({ searchParams }) {
  const [{ status }, { token, version, holderName }] = await Promise.all([searchParams, issueMyCard()]);
  const image = await QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 4, width: 360 });

  return (
    <main className={pageClassName + " print:block print:p-0"}>
      <PageHeading
        title="Mi tarjeta QR"
        description="Muéstrala al equipo de asistencia cuando llegues a tu turno."
        className="print:hidden"
        actions={<OrbitalMotif className="hidden h-12 w-24 text-brand-primary/60 sm:block" />}
      />
      {status === "reissued" && (
        <p className={portalFeedbackClassName + " print:hidden"} role="status">
          Se ha reemitido tu tarjeta QR (versión v{version}). Las tarjetas anteriores ya no son válidas.
        </p>
      )}
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-2 print:block">
        <section
          className="grid min-w-0 overflow-hidden rounded-xl border-2 border-brand-ink bg-brand-surface text-center shadow-xs print:mx-auto print:max-w-sm print:break-inside-avoid print:border-black print:bg-white print:text-black"
          aria-label="Tarjeta de asistencia"
        >
          <p className="flex flex-wrap items-center justify-center gap-x-1.5 border-b border-brand-line bg-brand-soft/45 px-5 py-3 font-serif text-lg font-bold text-brand-ink print:border-black print:bg-white print:text-black">
            <span>Comunidad</span>{" "}
            <AnimatedWordmark inline ariaLabel="Ad Astra" className="h-[0.82em] align-[-0.06em]" />{" "}
            <span>UC3M</span>
          </p>
          <div className="astra-blueprint-grid grid justify-items-center gap-4 p-6 sm:p-7 print:bg-none">
            <strong className="text-2xl text-brand-ink [overflow-wrap:anywhere] print:text-black">
              {holderName}
            </strong>
            <div className="relative rounded-lg border border-brand-line bg-white p-3 print:border-black">
              <span aria-hidden="true" className="pointer-events-none absolute top-1.5 left-1.5 size-4 border-t-[3px] border-s-[3px] border-brand-accent print:hidden" />
              <span aria-hidden="true" className="pointer-events-none absolute top-1.5 right-1.5 size-4 border-t-[3px] border-e-[3px] border-brand-accent print:hidden" />
              <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 left-1.5 size-4 border-b-[3px] border-s-[3px] border-brand-accent print:hidden" />
              <span aria-hidden="true" className="pointer-events-none absolute right-1.5 bottom-1.5 size-4 border-e-[3px] border-b-[3px] border-brand-accent print:hidden" />
              <img
                src={image}
                width="300"
                height="300"
                className="h-auto w-full max-w-[16.5rem]"
                alt="Código QR personal de asistencia"
              />
            </div>
            <p className="rounded-sm bg-brand-panel px-3 py-1 text-sm font-bold text-brand-ink print:bg-white print:text-black">
              Versión vigente: v{version}
            </p>
          </div>
        </section>
        <section className={portalPanelClassName + " print:hidden"} aria-labelledby="reissue-heading">
          <h2 id="reissue-heading" className="flex items-center gap-2.5 border-b border-brand-line pb-2.5">
            <PortalIcon icon={QrCodeIcon} className="text-brand-primary" size={22} />
            <TextSpanWrapper2 as="span" className="min-w-0">
              Reemitir tarjeta
            </TextSpanWrapper2>
          </h2>
          <p>Si necesitas una tarjeta nueva, puedes reemitirla desde tu cuenta. El código anterior dejará de ser válido.</p>
          <form action={reissueMyCard}>
            <button className={primaryButtonClass} type="submit">
              <PortalIcon icon={RepeatIcon} size={16} />
              Reemitir tarjeta QR
            </button>
          </form>
          <div className={portalBlueprintPanelClassName + " mt-1"}>
            <CardTools token={token} />
          </div>
        </section>
      </div>
    </main>
  );
}
