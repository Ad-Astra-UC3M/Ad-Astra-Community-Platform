/**
 * @file Campos de cuenta compartidos por las pantallas de acceso. Sus nombres coinciden con las claves
 * de FormData que lee auth-actions.ts.
 */

import { Mail01Icon, SecurityCheckIcon, ShieldKeyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { inputClass } from "./form-styles";

const labelClass = "grid min-w-0 gap-1.5 font-bold";

function FieldName({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <HugeiconsIcon icon={icon} size={18} aria-hidden="true" className="shrink-0 text-brand-primary" />
      {children}
    </span>
  );
}

/**
 * Renderiza el campo email del formulario de cuenta.
 *
 * @param props.defaultValue - Correo sugerido que la página puede leer de la cookie temporal.
 * @param props.className - Clases de disposición para el formulario que contiene el campo.
 */
export function InstitutionalEmailField({ defaultValue, className = "" }) {
  return (
    <label className={`${labelClass} ${className}`}>
      <FieldName icon={Mail01Icon}>Correo institucional UC3M</FieldName>
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
 * Campo de contraseña para las acciones de acceso, registro y recuperación.
 * @param props.name - Clave de FormData que distingue la contraseña y su confirmación.
 * @param props.label - Etiqueta del campo.
 * @param props.autoComplete - Indica al navegador si debe recuperar o sugerir una contraseña.
 * @param props.className - Clases de disposición para el formulario que contiene el campo.
 */
export function PasswordField({
  name = "password",
  label = "Contraseña",
  autoComplete = "current-password",
  className = "",
}) {
  return (
    <label className={`${labelClass} ${className}`}>
      <FieldName icon={ShieldKeyIcon}>{label}</FieldName>
      <input
        name={name}
        type="password"
        autoComplete={autoComplete}
        minLength={8}
        maxLength={128}
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
    <label className={labelClass}>
      <FieldName icon={SecurityCheckIcon}>{label}</FieldName>
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
