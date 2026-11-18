import { BackLink } from "../components/back-link";

export default function NotFound() {
  return <main className="shell stack">
    <p className="eyebrow">404</p>
    <h1>Página no encontrada</h1>
    <BackLink href="/">Volver al inicio</BackLink>
  </main>;
}
