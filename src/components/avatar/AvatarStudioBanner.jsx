import { ArrowUpRight } from "lucide-react";
import TextSpanWrapper2 from "../../institutional/components/ui/TextSpanWrapper2";
import FaceMarquee from "./FaceMarquee";

// Banner de Avatar Studio de la landing, apilado para el diálogo de foto de perfil.
export default function AvatarStudioBanner() {
  return (
    <aside
      className="relative isolate grid min-w-0 gap-4 overflow-hidden border-t border-brand-primary/20 bg-brand-surface py-6 text-brand-ink lg:gap-5 lg:py-8"
      aria-label="Crea tu avatar Ad Astra"
    >
      <svg
        className="pointer-events-none absolute -right-[170px] -bottom-[50px] -z-10 h-[360px] w-[720px] max-w-none stroke-brand-primary/16"
        viewBox="0 0 680 300"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <ellipse cx="425" cy="155" rx="245" ry="85" transform="rotate(-18 425 155)" />
        <ellipse cx="425" cy="155" rx="225" ry="100" transform="rotate(23 425 155)" />
        <circle cx="220" cy="104" r="4" className="fill-brand-accent stroke-none" />
      </svg>
      <img
        className="pointer-events-none absolute right-[2%] bottom-[70px] -z-10 h-auto w-[90%] -rotate-12 opacity-[.055]"
        src="/brand/avatar-studio/logo_no_text.svg"
        alt=""
        aria-hidden="true"
        width="3001"
        height="1043"
      />
      <div>
        <TextSpanWrapper2
          as="h2"
          animateOnLoad
          collapseWhitespace
          className="max-w-[15ch] text-balance font-display text-[clamp(1.75rem,3vw,2.25rem)] font-normal text-brand-primary"
        >
          Tu cara. Tu universo.
        </TextSpanWrapper2>
        <p className="mt-4 mb-5 max-w-[32ch] text-lg leading-relaxed sm:text-xl">
          Crea tu avatar y dale tu toque al universo Ad Astra.
        </p>
        <a
          href="https://avatar.adastrauc3m.es/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-3.5 rounded-lg bg-brand-accent px-4 py-3 font-serif text-xl font-normal text-brand-ink no-underline transition-colors hover:bg-brand-primary hover:text-brand-surface motion-reduce:transition-none"
        >
          Crear mi avatar <ArrowUpRight size={19} aria-hidden="true" />
        </a>
      </div>
      <FaceMarquee />
    </aside>
  );
}
