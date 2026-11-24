/**
 * @file Página de App Router para `/qr-card`. Genera en servidor la imagen QR de la tarjeta personal y
 * ofrece reemisión e impresión.
 */

import QRCode from "qrcode";
import { issueMyCard } from "../../server/activities/card";
import { reissueMyCard } from "./actions";
import { CardTools } from "./tools";

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface disabled:cursor-default disabled:border-brand-primary/30 disabled:bg-brand-soft/20 disabled:text-brand-ink";

/**
 * Next.js llama a la página. `issueMyCard` obtiene el JWT vigente y `QRCode.toDataURL` lo convierte en
 * imagen. `CardTools` permite imprimir o consultar el código manual.
 * @param props Propiedades de la página que proporciona Next.js.
 * @param props.searchParams Promesa con la consulta. `status=reissued` activa el aviso de reemisión.
 * @returns La tarjeta con su titular, versión y formulario de reemisión.
 */
export default async function CardPage({ searchParams }) {
  const { status } = await searchParams;
  const { token, version, holderName } = await issueMyCard();
  const image = await QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 4, width: 360 });

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20 print:p-0">
      <p className="text-[0.9rem] font-bold text-brand-primary print:hidden">
        Acreditación personal
      </p>
      <h1 className="font-display text-[1.75rem] leading-[1.12] font-normal uppercase text-brand-primary md:text-[2.5rem] print:hidden">
        Mi tarjeta QR
      </h1>
      <p className="print:hidden">
        Presenta esta tarjeta en la entrada de cada turno que hayas reservado.
      </p>
      {status === "reissued" && (
        <p
          className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink print:hidden"
          role="status"
        >
          Se ha reemitido tu tarjeta QR (versión v{version}). Las tarjetas anteriores ya no son válidas.
        </p>
      )}
      <section
        className="grid w-full max-w-[23rem] justify-items-center gap-3 rounded-lg border border-brand-primary/30 bg-brand-surface p-5 text-center print:break-inside-avoid print:border-black print:bg-white print:text-black"
        aria-label="Tarjeta de asistencia"
      >
        <strong>Ad Astra UC3M · Comunidad</strong>
        <img
          src={image}
          width="300"
          height="300"
          className="h-auto w-full max-w-[18.75rem]"
          alt="Código QR personal de asistencia"
        />
        <strong>{holderName}</strong>
        <p>Versión vigente: v{version}</p>
      </section>
      <form action={reissueMyCard} className="print:hidden">
        <button className={primaryButtonClass} type="submit">Reemitir tarjeta QR</button>
      </form>
      <CardTools token={token} />
    </main>
  );
}
