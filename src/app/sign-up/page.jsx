import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { signUp } from "../../demo/session";

export const metadata = { title: "Crear cuenta de prueba" };

const errors = {
  privacy: "Acepta el aviso de privacidad para continuar.",
  email: "Introduce un correo ficticio con dominio uc3m.es o uno de sus subdominios.",
  password: "Elige una contraseña de prueba de entre 8 y 128 caracteres.",
  fields: "Completa el nombre, los apellidos, la titulación y el curso.",
  duplicate: "Ya existe un alta con ese correo en este navegador.",
};

export default async function SignUpPage({ searchParams }) {
  const { error } = await searchParams;
  const message = typeof error === "string" && Object.hasOwn(errors, error)
    ? errors[error]
    : null;

  return (
    <main className="shell">
      <p className="eyebrow">Comunidad Ad Astra UC3M</p>
      <h1>Crear cuenta de prueba</h1>
      <div className="panel stack">
        <p className="notice">
          Usa datos inventados y una contraseña exclusiva de esta demo. Puedes editar los ejemplos.
        </p>
        {message && <p className="notice" role="alert">{message}</p>}
        {error === "duplicate" && (
          <BackLink href="/verify-email">Volver a la verificación</BackLink>
        )}
        <form action={signUp} className="stack" autoComplete="off">
          <label className="field">
            Nombre
            <input name="firstName" defaultValue="Lucía" maxLength={80} required />
          </label>
          <label className="field">
            Apellidos
            <input name="lastName" defaultValue="Ejemplo" maxLength={120} required />
          </label>
          <label className="field">
            Correo UC3M de prueba
            <input name="email" type="email" defaultValue="demo@alumnos.uc3m.es" maxLength={254} required />
          </label>
          <label className="field">
            Titulación
            <input name="degree" defaultValue="Ingeniería Aeroespacial" maxLength={120} required />
          </label>
          <label className="field">
            Curso
            <input name="course" defaultValue="2.º" maxLength={40} required />
          </label>
          <label className="field">
            Contraseña de prueba
            <input
              name="password"
              type="password"
              defaultValue="ComunidadDemo2026!"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <div id="privacy-notice">
            El prototipo guarda los datos de prueba en este equipo para que puedas retomar el recorrido desde el
            mismo navegador. La verificación del correo es simulada.
          </div>
          <label>
            <input type="checkbox" name="privacy" value="accepted" aria-describedby="privacy-notice" required />{" "}
            Acepto el aviso de privacidad de esta demostración.
          </label>
          <button type="submit" className="button">Crear cuenta</button>
        </form>
        <Link href="/sign-in">Ya tengo una cuenta de prueba</Link>
      </div>
    </main>
  );
}
