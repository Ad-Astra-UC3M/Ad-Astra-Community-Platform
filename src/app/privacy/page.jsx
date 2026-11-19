import Link from "next/link";
import { BackLink } from "../../components/back-link";

export const metadata = { title: "Aviso de privacidad" };

export default function PrivacyNoticePage() {
  return (
    <main className="shell stack">
      <BackLink href="/sign-up">Volver al registro</BackLink>
      <p className="eyebrow">Comunidad Ad Astra UC3M · Versión demo-1</p>
      <h1>Aviso de privacidad</h1>
      <p className="lead">
        Este aviso resume qué datos trata la Comunidad Ad Astra UC3M en este prototipo y qué controles
        tienes disponibles sobre tu cuenta y tu perfil.
      </p>

      <section className="panel stack">
        <h2>1. Datos básicos y cuenta UC3M</h2>
        <p>
          Al crear una cuenta recogemos tu nombre, apellidos, correo institucional UC3M, titulación y
          curso para gestionar tu acceso al portal, tus reservas en actividades y el registro de
          asistencia con tarjeta QR.
        </p>
        <p>
          El correo institucional verificado identifica tu cuenta y permanece inmutable tras el alta para
          conservar tu identidad y tu historial de participación.
        </p>
      </section>

      <section className="panel stack">
        <h2>2. Perfil de talento voluntario</h2>
        <p>
          De forma completamente opcional puedes completar un perfil de talento con tu universidad, año
          de graduación, experiencia, proyecto destacado, habilidades, herramientas, intereses, sectores,
          idiomas y enlaces externos (CV, LinkedIn, GitHub, portfolio u otros).
        </p>
        <p>
          La plataforma no admite subida de archivos ni descarga o inspecciona el contenido de tus
          enlaces: solo acepta direcciones web seguras (<code>http://</code> o <code>https://</code>) y
          puedes editarlas o retirarlas en cualquier momento.
        </p>
      </section>

      <section className="panel stack">
        <h2>3. Decisión de difusión separada</h2>
        <p>
          La autorización de difusión profesional (versión <code>talent-diffusion-v1</code>) es
          independiente del uso del portal y permanece no concedida por defecto. Negarte o retirarla no
          bloquea tu acceso ni borra tu perfil de talento.
        </p>
        <p>
          Cada cambio de decisión queda registrado con su finalidad, versión y fecha. En este MVP no
          están habilitadas las exportaciones ni el acceso de empresas externas.
        </p>
      </section>

      <section className="panel stack">
        <h2>4. Solicitud de supresión de cuenta</h2>
        <p>
          Puedes presentar una solicitud de supresión desde el apartado{" "}
          <Link href="/profile/privacy">Difusión y privacidad</Link> de tu perfil. Presentar la solicitud
          genera una referencia trazable para su revisión por el equipo responsable y no ejecuta un
          borrado automático inmediato.
        </p>
      </section>

      <p className="notice">
        Entorno de demostración: los datos introducidos en este prototipo son sintéticos y se guardan en
        local para permitir probar los recorridos completos.
      </p>
    </main>
  );
}
