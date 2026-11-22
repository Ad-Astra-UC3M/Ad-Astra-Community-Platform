/**
 * @file Página de App Router para `/qr-card`. Genera en servidor la imagen QR de la tarjeta personal.
 */

import { QrCodeIcon, RepeatIcon } from "@hugeicons/core-free-icons";
import QRCode from "qrcode";
import { primaryButtonClass } from "../../components/form-styles";
import { PageHeading, pageClassName } from "../../components/page-layout";
import { portalFeedbackClassName, portalPanelClassName, PortalIcon } from "../../components/portal-ui";
import { issueMyCard } from "../../server/activities/card";
import { reissueMyCard } from "./actions";
import { CardTools } from "./tools";

/**
 * Next.js llama a la página. `issueMyCard` obtiene el JWT vigente y `QRCode.toDataURL` lo convierte en
 * imagen. `CardTools` mantiene la impresión y el acceso al código manual.
 * @param props.searchParams Promesa con la consulta. `status=reissued` activa el aviso.
 * @returns La tarjeta con titular, versión y formulario de reemisión.
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
      />
      {status === "reissued" && (
        <p className={portalFeedbackClassName + " print:hidden"} role="status">
          Se ha reemitido tu tarjeta QR (versión v{version}). Las tarjetas anteriores ya no son válidas.
        </p>
      )}
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-2 print:block">
        <section
          className={portalPanelClassName + " justify-items-center text-center print:mx-auto print:max-w-sm print:break-inside-avoid print:border-black print:bg-white print:text-black"}
          aria-label="Tarjeta de asistencia"
        >
          <p className="w-full max-w-[18.75rem] border-b border-brand-line pb-2.5 font-bold text-brand-primary print:text-black">
            Comunidad Ad Astra UC3M
          </p>
          <strong className="text-xl [overflow-wrap:anywhere]">{holderName}</strong>
          <img
            src={image}
            width="300"
            height="300"
            className="h-auto w-full max-w-[18.75rem]"
            alt="Código QR personal de asistencia"
          />
          <p>Versión vigente: v{version}</p>
        </section>
        <section className={portalPanelClassName + " print:hidden"} aria-labelledby="reissue-heading">
          <h2 id="reissue-heading" className="flex items-center gap-2.5 border-b border-brand-line pb-2.5">
            <PortalIcon icon={QrCodeIcon} className="text-brand-primary" size={22} />
            Reemitir tarjeta
          </h2>
          <p>Si necesitas una tarjeta nueva, puedes reemitirla desde tu cuenta. El código anterior dejará de ser válido.</p>
          <form action={reissueMyCard}>
            <button className={primaryButtonClass} type="submit">
              <PortalIcon icon={RepeatIcon} size={16} />
              Reemitir tarjeta QR
            </button>
          </form>
          <div className="border-t border-brand-line pt-4">
            <CardTools token={token} />
          </div>
        </section>
      </div>
    </main>
  );
}
