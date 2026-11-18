import QRCode from "qrcode";
import { requireUser } from "../../demo/session";
import { issueCard } from "../../demo/card";
import { CardTools } from "./tools";

export default async function CardPage() {
  const user = await requireUser();
  const token = await issueCard(user.workspaceId, user.id);
  const image = await QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 4, width: 360 });
  return <main className="shell stack">
    <p className="eyebrow">Acreditación personal</p>
    <h1>Mi tarjeta QR</h1>
    <p>Presenta esta tarjeta en la entrada de cada turno que hayas reservado.</p>
    <section className="panel ticket stack" aria-label="Tarjeta de asistencia">
      <strong>Ad Astra UC3M · Comunidad</strong>
      <img src={image} width="300" height="300" style={{maxWidth:"100%",height:"auto"}} alt="Código QR personal de asistencia" />
      <strong>{user.name}</strong>
    </section>
    <CardTools token={token} />
  </main>;
}
