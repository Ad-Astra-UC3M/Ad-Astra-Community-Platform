import Link from "next/link";
import { hasPendingVerification, verifyEmail } from "../../demo/session";

export const metadata = { title: "Verificar correo" };

export default async function VerifyEmailPage() {
  const pending = await hasPendingVerification();

  return (
    <main className="shell">
      <p className="eyebrow">Comunidad Ad Astra UC3M</p>
      <h1>Verificar correo</h1>
      <div className="panel stack">
        {pending ? (
          <>
            <p>En esta demostración puedes confirmar tu cuenta directamente desde aquí.</p>
            <form action={verifyEmail}>
              <button type="submit" className="button">Simular verificación</button>
            </form>
          </>
        ) : (
          <>
            <p>No hay ninguna verificación pendiente en este navegador.</p>
            <Link href="/sign-up">Volver al registro</Link>
            <Link href="/sign-in">Acceder a la comunidad</Link>
          </>
        )}
      </div>
    </main>
  );
}
