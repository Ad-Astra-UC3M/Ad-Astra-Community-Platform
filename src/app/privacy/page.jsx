import Link from "next/link";
import { BackLink } from "../../components/back-link";

export const metadata = { title: "Aviso de privacidad" };

const panelClass = "grid min-w-0 gap-3 rounded-lg border border-brand-primary/30 bg-brand-soft/10 p-5 md:p-8";

export default function PrivacyNoticePage() {
  return (
    <main className="mx-auto grid w-full max-w-[58rem] gap-5 px-6 pt-8 pb-16 md:px-8 md:pt-12 md:pb-20">
      <BackLink href="/sign-up">Volver al registro</BackLink>
      <div className="grid gap-2">
        <p className="text-[0.9rem] font-bold text-brand-primary">Comunidad Ad Astra UC3M · Versión demo-1</p>
        <h1>Aviso de privacidad</h1>
      </div>
      <p className="max-w-[48ch] text-[1.2rem] leading-relaxed">
        Este aviso resume qué datos trata la Comunidad Ad Astra UC3M en este prototipo y qué controles
        tienes disponibles sobre tu cuenta y tu perfil.
      </p>

      <section className={panelClass}>
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

      <section className={panelClass}>
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

      <section className={panelClass}>
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

      <section className={panelClass}>
        <h2>4. Solicitud de supresión de cuenta</h2>
        <p>
          Puedes presentar una solicitud de supresión desde el apartado{" "}
          <Link href="/profile/privacy">Difusión y privacidad</Link> de tu perfil. Presentar la solicitud
          genera una referencia trazable para su revisión por el equipo responsable y no ejecuta un
          borrado automático inmediato.
        </p>
      </section>

      <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
        Entorno de demostración: los datos introducidos en este prototipo son sintéticos y se guardan en
        local para permitir probar los recorridos completos.
      </p>
    </main>
  );
}
