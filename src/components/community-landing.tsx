import Image from "next/image";
import Link from "next/link";

export function CommunityLanding({ enterDemo }: { enterDemo: () => Promise<void> }) {
  return (
    <main className="shell landing">
      <div className="landing-hero">
        <div className="landing-intro">
          <h1>Comunidad <span>Ad Astra UC3M</span></h1>
          <p className="lead">
            Explora los talleres y encuentros de Ad Astra, reserva tu turno y lleva tu tarjeta QR al evento.
          </p>
          <div className="action-row">
            <Link className="button" href="/sign-up">Crear cuenta de prueba</Link>
            <Link className="button secondary" href="/sign-in">Acceder</Link>
          </div>
        </div>
        <figure className="landing-photo">
          <Image
            src="/brand/community.webp"
            alt="Estudiantes conversan con integrantes de Ad Astra en el campus"
            width={1206}
            height={905}
            sizes="(min-width: 62rem) 44vw, 100vw"
            preload
          />
          <figcaption>Encuentro de Ad Astra en el campus</figcaption>
        </figure>
      </div>
      <section className="demo-entry" aria-labelledby="demo-entry-title">
        <div>
          <h2 id="demo-entry-title">Prueba la comunidad</h2>
          <p>La demo funciona con datos ficticios. Si creas una cuenta, usa un correo y una contraseña inventados.</p>
        </div>
        <form action={enterDemo}>
          <button className="button secondary" type="submit">Entrar como estudiante</button>
        </form>
      </section>
    </main>
  );
}
