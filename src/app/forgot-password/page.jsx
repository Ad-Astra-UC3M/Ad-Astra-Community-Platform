import Link from "next/link";
import { BackLink } from "../../components/back-link";
import {
  hasPendingBrowserPasswordReset,
  submitPasswordResetRequest,
} from "../../demo/session";

export const metadata = { title: "Recuperar contraseña" };

export default async function ForgotPasswordPage({ searchParams }) {
  const { sent } = await searchParams;
  const pending = await hasPendingBrowserPasswordReset();

  return (
    <main className="shell">
      <p className="eyebrow">Comunidad Ad Astra UC3M</p>
      <h1>Recuperar contraseña</h1>
      <div className="panel stack">
        <p className="notice">
          Introduce el correo UC3M de tu cuenta de prueba para generar un enlace de recuperación de un solo uso.
        </p>
        {sent === "1" && (
          <p className="notice" role="status">
            Si el correo corresponde a una cuenta verificada, hemos preparado el enlace de recuperación.
          </p>
        )}
        <form action={submitPasswordResetRequest} className="stack" autoComplete="off">
          <label className="field">
            Correo UC3M de prueba
            <input name="email" type="email" defaultValue="demo@alumnos.uc3m.es" maxLength={254} required />
          </label>
          <button type="submit" className="button">Solicitar recuperación</button>
        </form>
        <BackLink href="/sign-in">Volver al acceso</BackLink>
      </div>
      {pending && (
        <div className="panel stack">
          <h2>Enlace de recuperación en la demo</h2>
          <p>En esta demostración puedes abrir directamente el enlace de un solo uso desde aquí.</p>
          <Link className="button" href="/reset-password">Abrir enlace de recuperación</Link>
        </div>
      )}
    </main>
  );
}
