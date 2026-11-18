import Link from "next/link";
import { demoOrganizer, demoStudent, signIn } from "../../demo/session";

export const metadata = { title: "Acceder a la comunidad" };

export default async function SignInPage({ searchParams }) {
  const { error } = await searchParams;

  return (
    <main className="shell">
      <p className="eyebrow">Comunidad Ad Astra UC3M</p>
      <h1>Acceder a la comunidad</h1>
      <div className="panel stack">
        <p className="notice">Usa una cuenta de prueba creada y verificada en este navegador.</p>
        {error === "credentials" && (
          <p className="notice" role="alert">Comprueba el correo y la contraseña de prueba y verifica tu cuenta.</p>
        )}
        <form action={signIn} className="stack" autoComplete="off">
          <label className="field">
            Correo UC3M de prueba
            <input name="email" type="email" defaultValue="demo@alumnos.uc3m.es" maxLength={254} required />
          </label>
          <label className="field">
            Contraseña de prueba
            <input
              name="password"
              type="password"
              defaultValue="ComunidadDemo2026!"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <button type="submit" className="button">Acceder</button>
        </form>
        <Link href="/sign-up">Crear cuenta de prueba</Link>
      </div>
      <div className="panel stack">
        <h2>Acceso directo a la demo</h2>
        <form action={demoStudent}>
          <button type="submit" className="button secondary">Entrar como estudiante</button>
        </form>
        <form action={demoOrganizer}>
          <button type="submit" className="button secondary">Entrar como organizador</button>
        </form>
      </div>
    </main>
  );
}
