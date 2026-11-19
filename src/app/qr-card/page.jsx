import QRCode from "qrcode";
import { getCardVersion, issueCard } from "../../demo/card";
import { requireUser } from "../../demo/session";
import { reissueMyCard } from "./actions";
import { CardTools } from "./tools";

export default async function CardPage({ searchParams }) {
  const user = await requireUser("/qr-card");
  const { status } = await searchParams;
  const token = await issueCard(user.workspaceId, user.id);
  const version = getCardVersion(user.workspaceId, user.id);
  const image = await QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 4, width: 360 });

  return (
    <main className="shell stack">
      <p className="eyebrow">Acreditación personal</p>
      <h1>Mi tarjeta QR</h1>
      <p>Presenta esta tarjeta en la entrada de cada turno que hayas reservado.</p>
      {status === "reissued" && (
        <p className="notice" role="status">
          Se ha reemitido tu tarjeta QR (versión v{version}). Las tarjetas anteriores ya no son válidas.
        </p>
      )}
      <section className="panel ticket stack" aria-label="Tarjeta de asistencia">
        <strong>Ad Astra UC3M · Comunidad</strong>
        <img
          src={image}
          width="300"
          height="300"
          style={{ maxWidth: "100%", height: "auto" }}
          alt="Código QR personal de asistencia"
        />
        <strong>{user.name}</strong>
        <p>Versión vigente: v{version}</p>
      </section>
      <form action={reissueMyCard}>
        <button className="button" type="submit">Reemitir tarjeta QR</button>
      </form>
      <CardTools token={token} />
    </main>
  );
}
