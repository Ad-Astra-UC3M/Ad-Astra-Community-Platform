"use client";

const secondaryButtonClass =
  "inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center justify-self-start rounded-[4px] border border-brand-primary bg-brand-surface px-5 py-2.5 text-center font-display text-[0.79rem] leading-snug uppercase text-brand-primary no-underline transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-ink";

export function CardTools({ token }) {
  return (
    <div className="grid min-w-0 gap-4 print:hidden">
      <button type="button" className={secondaryButtonClass} onClick={() => window.print()}>
        Imprimir tarjeta
      </button>
      <details className="grid gap-2">
        <summary className="w-fit cursor-pointer list-item py-2.5 text-brand-primary underline underline-offset-[0.22em] hover:text-brand-ink">
          Usar el código sin cámara
        </summary>
        <label className="my-2 grid min-w-0 gap-1.5 font-bold">
          Código de la tarjeta
          <textarea
            readOnly
            rows={3}
            value={token}
            onFocus={(event) => event.target.select()}
            className="min-h-12 w-full min-w-0 resize-y rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink"
          />
        </label>
        <p>Si el lector de cámara no está disponible, puedes mostrar o copiar este código al equipo organizador para validar tu asistencia.</p>
      </details>
    </div>
  );
}
