import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { hasPendingVerification, verifyEmail } from "../../demo/session";

export const metadata = { title: "Verificar correo" };

const primaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-primary px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-surface no-underline transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-brand-surface";

export default async function VerifyEmailPage() {
  const pending = await hasPendingVerification();

  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M</p>
        <h1>Verificar correo</h1>
      </div>
      <div className="grid min-w-0 gap-4 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8">
        {pending ? (
          <>
            <p>En esta demostración puedes confirmar tu cuenta directamente desde aquí.</p>
            <form action={verifyEmail}>
              <button type="submit" className={primaryButtonClass}>Simular verificación</button>
            </form>
          </>
        ) : (
          <>
            <p>No hay ninguna verificación pendiente en este navegador.</p>
            <p>Si la verificación ha caducado, puedes volver a registrarte con el mismo correo de prueba.</p>
            <BackLink href="/sign-up">Volver al registro</BackLink>
            <Link href="/sign-in">Acceder a la comunidad</Link>
          </>
        )}
      </div>
    </main>
  );
}
