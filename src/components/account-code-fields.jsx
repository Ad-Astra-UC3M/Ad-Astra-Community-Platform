const inputClass =
  "min-h-12 w-full min-w-0 rounded-[4px] border border-brand-primary bg-brand-surface px-3 py-2.5 font-normal text-brand-ink";

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
