/**
 * @file Campos JSX que comparten verificación y recuperación. Sus nombres coinciden con las claves FormData
 * que lee auth-actions.ts.
 */

const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

/**
 * Renderiza el campo email del formulario de cuenta.
 *
 * @param props.defaultValue - Correo sugerido que la página puede leer de la cookie temporal.
 */
export function InstitutionalEmailField({ defaultValue }) {
  return (
    <label className="grid min-w-0 gap-1.5 font-bold">
      Correo institucional UC3M
      <input
        name="email"
        type="email"
        placeholder="nombre@alumnos.uc3m.es"
        autoComplete="email"
        maxLength={254}
        defaultValue={defaultValue}
        required
        className={inputClass}
      />
    </label>
  );
}

/**
 * Renderiza el campo otp con teclado numérico y autocompletado de código. El servicio comprueba el valor al
 * recibirlo.
 *
 * @param props.label - Texto visible que identifica si el código es de verificación o recuperación.
 */
export function AccountCodeField({ label }) {
  return (
    <label className="grid min-w-0 gap-1.5 font-bold">
      {label}
      <input
        name="otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        className={inputClass + " max-w-48"}
      />
    </label>
  );
}
