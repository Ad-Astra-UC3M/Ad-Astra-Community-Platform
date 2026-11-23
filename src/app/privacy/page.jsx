/**
 * @file Ruta pública con el aviso de privacidad. Usa la misma versión que el servicio registra al aceptar
 * el aviso durante el alta.
 */

import Link from "next/link";
import { PageHeading } from "../../components/page-layout";
import { BackLink } from "../../components/back-link";
import { OrbitalMotif, portalPanelClassName } from "../../components/portal-ui";
import AnimatedWordmark from "../../institutional/components/brand/AnimatedWordmark";
import TextSpanWrapper2 from "../../institutional/components/ui/TextSpanWrapper2";
import { currentUser } from "../../server/auth/access";
import { PRIVACY_VERSION } from "../../server/auth/service";

export const metadata = { title: "Aviso de privacidad" };

const panelClass = portalPanelClassName + " md:p-7";

/**
 * Next.js renderiza el aviso y adapta el enlace superior de retorno según exista una sesión activa
 * (`currentUser`): vuelve a `/profile/privacy` cuando hay sesión o a `/sign-up` para visitantes.
 *
 * @returns Vista pública `<main>` con las cuatro secciones informativas del tratamiento de datos.
 */
export default async function PrivacyNoticePage() {
  const user = await currentUser();

  return (
    <main className="mx-auto grid w-full max-w-[52rem] gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-12 md:pb-20">
      {user ? (
        <BackLink href="/profile/privacy">Volver a difusión y privacidad</BackLink>
      ) : (
        <BackLink href="/sign-up">Volver al registro</BackLink>
      )}
      <PageHeading
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-x-1">
            Comunidad <AnimatedWordmark inline ariaLabel="Ad Astra" className="h-[0.86em] align-[-0.06em]" /> UC3M · Versión {PRIVACY_VERSION}
          </span>
        }
        title="Aviso de privacidad"
        description={
          <>
            Este aviso resume qué datos trata la Comunidad{" "}
            <AnimatedWordmark inline ariaLabel="Ad Astra" className="mx-0.5 h-[0.76em] align-[-0.05em]" />{" "}
            UC3M y qué controles tienes disponibles sobre tu cuenta y tu perfil.
          </>
        }
        actions={<OrbitalMotif className="hidden h-12 w-24 text-brand-primary/60 sm:block" />}
      />

      <section className={panelClass}>
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          1. Datos básicos y cuenta UC3M
        </TextSpanWrapper2>
        <p>
          Al crear una cuenta recogemos tu nombre, apellidos, correo institucional UC3M, titulación
          y curso para gestionar tu acceso al portal, tus reservas en actividades y el registro de
          asistencia con tarjeta QR.
        </p>
        <p>
          El correo institucional verificado identifica tu cuenta y permanece inmutable tras el alta
          para conservar tu identidad y tu historial de participación.
        </p>
      </section>

      <section className={panelClass}>
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          2. Perfil de talento voluntario
        </TextSpanWrapper2>
        <p>
          De forma completamente opcional puedes completar un perfil de talento con tu universidad,
          año de graduación, experiencia, proyecto destacado, habilidades, herramientas, intereses,
          sectores, tipos de oportunidad, idiomas y enlaces externos (CV, LinkedIn, GitHub,
          portfolio u otros).
        </p>
        <p>
          La plataforma no admite subida de archivos ni descarga o inspecciona el contenido de tus
          enlaces: solo acepta direcciones web seguras (<code>http://</code> o <code>https://</code>
          ) y puedes editarlas o retirarlas en cualquier momento.
        </p>
      </section>

      <section className={panelClass}>
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          3. Decisión de difusión separada
        </TextSpanWrapper2>
        <p>
          La autorización de difusión profesional (versión <code>talent-diffusion-v1</code>) es
          independiente del uso del portal y permanece no concedida por defecto. Negarte o retirarla
          no bloquea tu acceso ni borra tu perfil de talento.
        </p>
        <p>
          Cada cambio de decisión queda registrado con su finalidad, versión y fecha. En esta fase
          del portal no están habilitadas las exportaciones ni el acceso de empresas externas.
        </p>
      </section>

      <section className={panelClass}>
        <TextSpanWrapper2 as="h2" className="border-b border-brand-line pb-2.5 text-xl">
          4. Solicitud de supresión de cuenta
        </TextSpanWrapper2>
        <p>
          Puedes presentar una solicitud de supresión desde el apartado{" "}
          <Link href="/profile/privacy">Difusión y privacidad</Link> de tu perfil. Presentar la
          solicitud genera una referencia trazable para su revisión por el equipo responsable y no
          ejecuta un borrado automático inmediato.
        </p>
      </section>

      <p className="rounded-[4px] bg-brand-soft/25 px-4 py-3.5 text-brand-ink">
        Puedes consultar y actualizar tus datos básicos, tu perfil de talento voluntario y tus
        preferencias de privacidad en cualquier momento desde tu cuenta.
      </p>
    </main>
  );
}
